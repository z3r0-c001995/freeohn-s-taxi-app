import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, Alert, ScrollView, Platform } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { RideMap } from "@/components/maps/RideMap";
import { PlaceSearchInput } from "@/components/places/PlaceSearchInput";
import { useAppStore } from "@/lib/store";
import { useRouter } from "expo-router";
import { useColors } from "@/hooks/use-colors";
import { Ionicons } from "@expo/vector-icons";
import { trpc } from "@/lib/trpc";
import { calculateFare } from "@/shared/constants/fare";
import type { LatLng, RouteSummary, PlaceDetails } from "@/lib/google/google-types";
import { createTrip, estimateTrip } from "@/lib/ride-hailing-api";
import { createRide } from "@/lib/db-service";
import { calculateDistance } from "@/lib/ride-utils";
import { IS_SEEKER_APP } from "@/constants/app-variant";

type RideType = "standard" | "premium";

export default function RequestRideScreen() {
  const router = useRouter();
  const colors = useColors();
  const { currentUser, currentLocation } = useAppStore();

  const [pickupLocation, setPickupLocation] = useState<LatLng | null>(null);
  const [dropoffLocation, setDropoffLocation] = useState<LatLng | null>(null);
  const [pickupAddress, setPickupAddress] = useState("");
  const [dropoffAddress, setDropoffAddress] = useState("");
  const [rideType, setRideType] = useState<RideType>("standard");
  const [isRequesting, setIsRequesting] = useState(false);
  const [routeSummary, setRouteSummary] = useState<RouteSummary | null>(null);
  const [farePreview, setFarePreview] = useState<{
    total: number;
    distanceMeters: number;
    etaSeconds: number;
    currency: string;
  } | null>(null);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [scheduleOption, setScheduleOption] = useState<"now" | "15min" | "30min">("now");
  const canRenderNativeMap =
    Platform.OS !== "android" || Boolean(process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY);

  // Set initial pickup to current location
  useEffect(() => {
    if (currentLocation && !pickupLocation) {
      setPickupLocation({ lat: currentLocation.latitude, lng: currentLocation.longitude });
    }
  }, [currentLocation, pickupLocation]);

  useEffect(() => {
    if (!IS_SEEKER_APP) {
      Alert.alert("Unavailable", "Ride request is only available in the Service Seeker app.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    }
  }, [router]);

  // Calculate route when pickup and dropoff are set
  const { data: routeData, isLoading: isCalculatingRoute } = trpc.google.computeRoute.useQuery(
    {
      origin: pickupLocation!,
      destination: dropoffLocation!,
      travelMode: "DRIVE",
    },
    {
      enabled: !!pickupLocation && !!dropoffLocation,
    }
  );

  useEffect(() => {
    if (!pickupLocation || !dropoffLocation) {
      return;
    }
    if (routeData) {
      setRouteSummary(routeData);
      return;
    }

    // Offline route fallback for standalone APK runs
    const fallbackDistanceKm = calculateDistance(
      pickupLocation.lat,
      pickupLocation.lng,
      dropoffLocation.lat,
      dropoffLocation.lng,
    );
    const fallbackDistanceMeters = Math.max(1, Math.round(fallbackDistanceKm * 1000));
    const fallbackDurationSeconds = Math.max(60, Math.round((fallbackDistanceKm / 40) * 3600));
    setRouteSummary({
      distanceMeters: fallbackDistanceMeters,
      durationSeconds: fallbackDurationSeconds,
      encodedPolyline: "",
      steps: [],
    });
  }, [routeData, pickupLocation, dropoffLocation]);

  useEffect(() => {
    const fetchEstimate = async () => {
      if (!pickupLocation || !dropoffLocation || !routeSummary) {
        setFarePreview(null);
        return;
      }
      try {
        const estimate = await estimateTrip({
          pickup: pickupLocation,
          dropoff: dropoffLocation,
          distanceMeters: routeSummary.distanceMeters,
          durationSeconds: routeSummary.durationSeconds,
          rideType,
        });
        setFarePreview({
          total: estimate.fare.total,
          distanceMeters: estimate.distanceMeters,
          etaSeconds: estimate.etaSeconds,
          currency: estimate.fare.currency,
        });
      } catch (error) {
        // fallback to local fare estimate if API estimate fails
        const fallbackTotal = calculateFare(
          routeSummary.distanceMeters / 1000,
          routeSummary.durationSeconds / 60,
          rideType,
        );
        setFarePreview({
          total: fallbackTotal,
          distanceMeters: routeSummary.distanceMeters,
          etaSeconds: routeSummary.durationSeconds,
          currency: "USD",
        });
      }
    };
    void fetchEstimate();
  }, [pickupLocation, dropoffLocation, routeSummary, rideType]);

  const handlePickupSelect = (place: PlaceDetails) => {
    setPickupLocation({ lat: place.geometry.location.lat, lng: place.geometry.location.lng });
    setPickupAddress(place.formatted_address);
  };

  const handleDropoffSelect = (place: PlaceDetails) => {
    setDropoffLocation({ lat: place.geometry.location.lat, lng: place.geometry.location.lng });
    setDropoffAddress(place.formatted_address);
  };

  const handleRequestRide = async () => {
    if (!IS_SEEKER_APP) {
      Alert.alert("Unavailable", "Ride request is only available in the Service Seeker app.");
      return;
    }

    if (!pickupLocation || !dropoffLocation || !currentUser) {
      Alert.alert("Error", "Please select pickup and dropoff locations");
      return;
    }

    setIsRequesting(true);
    try {
      const distanceMeters = routeSummary?.distanceMeters ?? 0;
      const durationSeconds = routeSummary?.durationSeconds ?? 0;
      let trip: any = null;
      let usedOfflineMode = false;
      try {
        trip = await createTrip({
          pickup: pickupLocation,
          dropoff: dropoffLocation,
          pickupAddress,
          dropoffAddress,
          rideType,
          distanceMeters,
          durationSeconds,
          paymentMethod: "CASH",
          idempotencyKey: `trip_${Date.now()}_${currentUser.id}`,
        });
      } catch (apiError) {
        // Standalone APK fallback: keep seeker flow working with local DB if backend is unreachable.
        usedOfflineMode = true;
        setIsOfflineMode(true);
        const localFare =
          farePreview?.total ??
          calculateFare(
            (distanceMeters || 1000) / 1000,
            (durationSeconds || 300) / 60,
            rideType,
          );
        trip = await createRide(
          currentUser.id.toString(),
          pickupLocation.lat,
          pickupLocation.lng,
          dropoffLocation.lat,
          dropoffLocation.lng,
          pickupAddress || "Pickup",
          dropoffAddress || "Dropoff",
          rideType,
          localFare,
          distanceMeters,
          durationSeconds,
          routeSummary?.encodedPolyline,
        );
      }

      Alert.alert("Success", usedOfflineMode ? "Ride requested (offline mode)." : "Ride requested! Finding nearby drivers...", [
        {
          text: "Track Trip",
          onPress: () => router.replace(`/trip/${trip.id}` as never),
        },
      ]);
    } catch (error) {
      console.error("Failed to request ride:", error);
      Alert.alert("Error", "Failed to request ride");
    } finally {
      setIsRequesting(false);
    }
  };

  const estimatedFare = farePreview?.total ?? 0;
  const rideScheduleLabel =
    scheduleOption === "now"
      ? "Now"
      : scheduleOption === "15min"
      ? "In 15 min"
      : "In 30 min";

  return (
    <ScreenContainer className="bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <View className="flex-1 gap-6 pb-8">
          {/* Header */}
          <View className="flex-row items-center justify-between">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-10 h-10 rounded-full items-center justify-center"
              style={{ backgroundColor: colors.surface }}
            >
              <Ionicons name="arrow-back" size={24} color={colors.foreground} />
            </TouchableOpacity>
            <Text className="text-xl font-bold text-foreground">Request a Ride</Text>
            <View className="w-10" />
          </View>

          {/* Map */}
          <View className="h-64 rounded-2xl overflow-hidden">
            {canRenderNativeMap ? (
              <RideMap
                userLocation={currentLocation ? { lat: currentLocation.latitude, lng: currentLocation.longitude } : undefined}
                pickupLocation={pickupLocation || undefined}
                dropoffLocation={dropoffLocation || undefined}
                routePolyline={routeSummary?.encodedPolyline}
                onPickupSelect={(loc) => setPickupLocation(loc)}
                onDropoffSelect={(loc) => setDropoffLocation(loc)}
                style={{ flex: 1 }}
              />
            ) : (
              <View className="flex-1 rounded-2xl p-4 items-center justify-center gap-3" style={{ backgroundColor: colors.surface }}>
                <Text className="text-sm text-center text-muted">
                  Map preview is disabled on this Android build (missing Google Maps key).
                </Text>
                <TouchableOpacity
                  className="bg-primary rounded-lg px-4 py-2"
                  onPress={() => {
                    if (currentLocation) {
                      setPickupLocation({ lat: currentLocation.latitude, lng: currentLocation.longitude });
                    }
                  }}
                >
                  <Text className="text-white font-semibold">Use Current Location as Pickup</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="bg-surface rounded-lg px-4 py-2"
                  onPress={() => {
                    if (pickupLocation) {
                      const fallbackDropoff = {
                        lat: pickupLocation.lat + 0.01,
                        lng: pickupLocation.lng + 0.01,
                      };
                      setDropoffLocation(fallbackDropoff);
                      setDropoffAddress("Demo Dropoff (offline)");
                    }
                  }}
                >
                  <Text className="text-foreground font-semibold">Set Demo Dropoff</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {isOfflineMode && (
            <View className="rounded-lg p-3" style={{ backgroundColor: colors.surface }}>
              <Text className="text-xs text-muted text-center">
                Running in offline mode. Trips are stored locally on this device.
              </Text>
            </View>
          )}

          {/* Location Selection */}
          <View className="gap-4">
            <Text className="text-lg font-bold text-foreground">Locations</Text>

            <View className="gap-3">
              <PlaceSearchInput
                placeholder="Search pickup location"
                onPlaceSelect={handlePickupSelect}
                userLocation={currentLocation ? { lat: currentLocation.latitude, lng: currentLocation.longitude } : undefined}
              />

              <PlaceSearchInput
                placeholder="Search dropoff location"
                onPlaceSelect={handleDropoffSelect}
                userLocation={pickupLocation || undefined}
              />
            </View>
          </View>

          {/* Time and Calendar */}
          <View className="gap-4">
            <Text className="text-lg font-bold text-foreground">Time & Calendar</Text>
            <View className="rounded-lg p-4 gap-3" style={{ backgroundColor: colors.surface }}>
              <Text className="text-sm text-muted">
                Selected pickup time: {rideScheduleLabel}
              </Text>
              <View className="flex-row gap-2">
                <TouchableOpacity
                  onPress={() => setScheduleOption("now")}
                  className={`flex-1 rounded-lg py-2 items-center justify-center ${
                    scheduleOption === "now" ? "bg-primary" : "bg-muted"
                  }`}
                >
                  <Text
                    className={`text-sm font-semibold ${
                      scheduleOption === "now" ? "text-white" : "text-foreground"
                    }`}
                  >
                    Now
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setScheduleOption("15min")}
                  className={`flex-1 rounded-lg py-2 items-center justify-center ${
                    scheduleOption === "15min" ? "bg-primary" : "bg-muted"
                  }`}
                >
                  <Text
                    className={`text-sm font-semibold ${
                      scheduleOption === "15min" ? "text-white" : "text-foreground"
                    }`}
                  >
                    +15 min
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setScheduleOption("30min")}
                  className={`flex-1 rounded-lg py-2 items-center justify-center ${
                    scheduleOption === "30min" ? "bg-primary" : "bg-muted"
                  }`}
                >
                  <Text
                    className={`text-sm font-semibold ${
                      scheduleOption === "30min" ? "text-white" : "text-foreground"
                    }`}
                  >
                    +30 min
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Ride Type Selection */}
          <View className="gap-4">
            <Text className="text-lg font-bold text-foreground">Ride Type</Text>

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setRideType("standard")}
                className={`flex-1 p-4 rounded-lg border-2 ${
                  rideType === "standard" ? "border-primary" : "border-border"
                }`}
                style={{ backgroundColor: colors.surface }}
              >
                <Ionicons
                  name="car"
                  size={24}
                  color={rideType === "standard" ? colors.primary : colors.foreground}
                />
                <Text className="text-sm font-semibold mt-2">Standard</Text>
                <Text className="text-xs text-muted">Basic ride</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setRideType("premium")}
                className={`flex-1 p-4 rounded-lg border-2 ${
                  rideType === "premium" ? "border-primary" : "border-border"
                }`}
                style={{ backgroundColor: colors.surface }}
              >
                <Ionicons
                  name="car-sport"
                  size={24}
                  color={rideType === "premium" ? colors.primary : colors.foreground}
                />
                <Text className="text-sm font-semibold mt-2">Premium</Text>
                <Text className="text-xs text-muted">Luxury ride</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Route Summary */}
          {routeSummary && (
            <View className="gap-4">
              <Text className="text-lg font-bold text-foreground">Route Summary</Text>
              <View
                className="p-4 rounded-lg"
                style={{ backgroundColor: colors.surface }}
              >
                <Text className="text-sm text-muted">
                  Distance: {(routeSummary.distanceMeters / 1000).toFixed(1)} km
                </Text>
                <Text className="text-sm text-muted">
                  Duration: {Math.round(routeSummary.durationSeconds / 60)} min
                </Text>
              </View>
            </View>
          )}

          {/* Fare Estimate */}
          {pickupLocation && dropoffLocation && (
            <View className="gap-4">
              <Text className="text-lg font-bold text-foreground">Fare Estimate</Text>
              <View
                className="p-4 rounded-lg items-center"
                style={{ backgroundColor: colors.surface }}
              >
                <Text className="text-2xl font-bold text-foreground">
                  ${estimatedFare.toFixed(2)}
                </Text>
                <Text className="text-sm text-muted">
                  {isCalculatingRoute ? "Calculating route..." : "Estimated fare"}
                </Text>
                {farePreview && (
                  <Text className="text-xs text-muted mt-1">
                    {(farePreview.distanceMeters / 1000).toFixed(1)} km • {Math.round(farePreview.etaSeconds / 60)} min
                  </Text>
                )}
              </View>
            </View>
          )}

          {/* Payment and Invoice */}
          <View className="gap-4">
            <Text className="text-lg font-bold text-foreground">Payment & Invoice</Text>
            <View className="rounded-lg p-4 gap-2" style={{ backgroundColor: colors.surface }}>
              <Text className="text-sm text-foreground font-semibold">In-app payment method: Cash</Text>
              <Text className="text-xs text-muted">
                Card and wallet support are prepared and can be enabled in a future release.
              </Text>
              <Text className="text-xs text-muted">
                A digital invoice is generated automatically when the ride is completed.
              </Text>
            </View>
          </View>

          {/* Smart booking feature summary */}
          <View className="rounded-lg p-4 gap-2" style={{ backgroundColor: colors.surface }}>
            <Text className="text-sm font-semibold text-foreground">Smart ride booking options</Text>
            <Text className="text-xs text-muted">Vehicle choice, live GPS details, route safety, and transparent fare preview.</Text>
          </View>

          {/* Request Button */}
          <TouchableOpacity
            onPress={handleRequestRide}
            disabled={!pickupLocation || !dropoffLocation || isRequesting}
            className={`p-4 rounded-2xl items-center justify-center ${
              pickupLocation && dropoffLocation && !isRequesting
                ? "bg-primary"
                : "bg-muted"
            }`}
          >
            <Text
              className={`text-lg font-semibold ${
                pickupLocation && dropoffLocation && !isRequesting
                  ? "text-primary-foreground"
                  : "text-muted-foreground"
              }`}
            >
              {isRequesting ? "Requesting..." : "Request Ride"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
