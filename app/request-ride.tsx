import { useEffect, useMemo, useState } from "react";
import { Alert, Platform, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "@/components/screen-container";
import { RideMap } from "@/components/maps/RideMap";
import { PlaceSearchInput } from "@/components/places/PlaceSearchInput";
import { AppBadge } from "@/components/ui/app-badge";
import { AppButton } from "@/components/ui/app-button";
import { AppCard } from "@/components/ui/app-card";
import { radii, shadows } from "@/constants/design-system";
import { IS_SEEKER_APP } from "@/constants/app-variant";
import { useBrandTheme } from "@/hooks/use-brand-theme";
import { trpc } from "@/lib/trpc";
import { useAppStore } from "@/lib/store";
import { createRide, getOnlineDrivers } from "@/lib/db-service";
import { calculateDistance } from "@/lib/ride-utils";
import type { LatLng, NearbyDriverMarker, RouteSummary, PlaceDetails } from "@/lib/maps/map-types";
import { createTrip, estimateTrip, getNearbyDrivers } from "@/lib/ride-hailing-api";
import { calculateFare } from "@/shared/constants/fare";

type RideType = "standard" | "premium";

export default function RequestRideScreen() {
  const router = useRouter();
  const trpcUtils = trpc.useUtils();
  const brand = useBrandTheme();
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
  const [nearbyDrivers, setNearbyDrivers] = useState<NearbyDriverMarker[]>([]);
  const [nearbyUpdatedAt, setNearbyUpdatedAt] = useState<string | null>(null);
  const [scheduleOption, setScheduleOption] = useState<"now" | "15min" | "30min">("now");

  const canRenderNativeMap =
    Platform.OS !== "android" || Boolean(process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY);

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

  const { data: routeData } = trpc.maps.computeRoute.useQuery(
    {
      origin: pickupLocation!,
      destination: dropoffLocation!,
      travelMode: "DRIVE",
    },
    {
      enabled: !!pickupLocation && !!dropoffLocation,
    },
  );

  useEffect(() => {
    if (!pickupLocation || !dropoffLocation) {
      setRouteSummary(null);
      return;
    }

    if (routeData) {
      setRouteSummary(routeData);
      return;
    }

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
      } catch {
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

  useEffect(() => {
    let isCancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const fetchNearby = async () => {
      if (!pickupLocation || !IS_SEEKER_APP) {
        if (!isCancelled) {
          setNearbyDrivers([]);
          setNearbyUpdatedAt(null);
        }
        return;
      }

      try {
        const response = await getNearbyDrivers({
          pickup: pickupLocation,
          radiusKm: 6,
          limit: 20,
        });
        if (isCancelled) return;

        setNearbyDrivers(
          response.drivers.map((driver) => ({
            driverId: driver.driverId,
            lat: driver.location.lat,
            lng: driver.location.lng,
            distanceMeters: driver.distanceMeters,
            etaSeconds: driver.etaSeconds,
          })),
        );
        setNearbyUpdatedAt(response.fetchedAt);
      } catch {
        if (!pickupLocation || isCancelled) return;

        const localDrivers = await getOnlineDrivers();
        if (isCancelled) return;

        const localMarkers = localDrivers
          .map<NearbyDriverMarker | null>((driver) => {
            const lat = Number(driver.currentLat);
            const lng = Number(driver.currentLng);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
            const distanceKm = calculateDistance(pickupLocation.lat, pickupLocation.lng, lat, lng);
            if (distanceKm > 6) return null;
            return {
              driverId: String(driver.userId),
              lat,
              lng,
              distanceMeters: Math.round(distanceKm * 1000),
              etaSeconds: Math.max(60, Math.round((distanceKm / 35) * 3600)),
            } satisfies NearbyDriverMarker;
          })
          .filter((driver): driver is NearbyDriverMarker => driver !== null)
          .slice(0, 20);

        setNearbyDrivers(localMarkers);
        setNearbyUpdatedAt(new Date().toISOString());
      }
    };

    void fetchNearby();

    if (pickupLocation) {
      timer = setInterval(() => {
        void fetchNearby();
      }, 5000);
    }

    return () => {
      isCancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [pickupLocation, trpcUtils]);

  const handlePickupSelect = (place: PlaceDetails) => {
    setPickupLocation({ lat: place.geometry.location.lat, lng: place.geometry.location.lng });
    setPickupAddress(place.formatted_address);
  };

  const handleDropoffSelect = (place: PlaceDetails) => {
    setDropoffLocation({ lat: place.geometry.location.lat, lng: place.geometry.location.lng });
    setDropoffAddress(place.formatted_address);
  };

  const resolveAddress = async (location: LatLng) => {
    try {
      const response = await trpcUtils.maps.reverseGeocode.fetch(location);
      return response.address || `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`;
    } catch {
      return `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`;
    }
  };

  const handlePickupMapSelect = async (location: LatLng) => {
    setPickupLocation(location);
    const address = await resolveAddress(location);
    setPickupAddress(address);
  };

  const handleDropoffMapSelect = async (location: LatLng) => {
    setDropoffLocation(location);
    const address = await resolveAddress(location);
    setDropoffAddress(address);
  };

  const handleRequestRide = async () => {
    if (!IS_SEEKER_APP) {
      Alert.alert("Unavailable", "Ride request is only available in the Service Seeker app.");
      return;
    }

    if (!pickupLocation || !dropoffLocation || !currentUser) {
      Alert.alert("Validation", "Please select pickup and dropoff locations.");
      return;
    }

    setIsRequesting(true);
    try {
      const distanceMeters = routeSummary?.distanceMeters ?? 0;
      const durationSeconds = routeSummary?.durationSeconds ?? 0;
      let trip: any;
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
      } catch {
        usedOfflineMode = true;
        setIsOfflineMode(true);
        const localFare =
          farePreview?.total ??
          calculateFare((distanceMeters || 1000) / 1000, (durationSeconds || 300) / 60, rideType);
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

      if (usedOfflineMode) {
        Alert.alert("Offline Mode", "Ride created locally. Opening trip tracker.");
      }

      router.replace(`/trip/${trip.id}` as never);
    } catch (error) {
      console.error("Failed to request ride:", error);
      Alert.alert("Error", "Failed to request ride");
    } finally {
      setIsRequesting(false);
    }
  };

  const estimatedFare = farePreview?.total ?? 0;
  const rideScheduleLabel =
    scheduleOption === "now" ? "Now" : scheduleOption === "15min" ? "In 15 min" : "In 30 min";

  const etaLabel = useMemo(() => {
    if (!farePreview?.etaSeconds) return "--";
    return `${Math.max(1, Math.round(farePreview.etaSeconds / 60))} min`;
  }, [farePreview?.etaSeconds]);

  return (
    <ScreenContainer className="bg-background" containerClassName="bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <View style={{ gap: 16, paddingBottom: 20 }}>
          <View
            style={{
              borderRadius: radii.xl,
              backgroundColor: "#0A1E49",
              padding: 18,
              ...shadows.md,
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <TouchableOpacity
                onPress={() => router.back()}
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 999,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "rgba(255,255,255,0.14)",
                }}
              >
                <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
              </TouchableOpacity>
              <AppBadge label={`${nearbyDrivers.length} nearby`} tone="primary" />
            </View>
            <Text style={{ marginTop: 16, fontSize: 28, fontWeight: "800", color: "#FFFFFF" }}>Book Your Ride</Text>
            <Text style={{ marginTop: 6, fontSize: 14, color: "#CBD5E1" }}>
              Pickup, destination, ETA, and transparent fare in one flow.
            </Text>
          </View>

          <View style={{ borderRadius: radii.xl, overflow: "hidden", borderWidth: 1, borderColor: brand.border }}>
            {canRenderNativeMap ? (
              <RideMap
                userLocation={currentLocation ? { lat: currentLocation.latitude, lng: currentLocation.longitude } : undefined}
                pickupLocation={pickupLocation || undefined}
                dropoffLocation={dropoffLocation || undefined}
                routePolyline={routeSummary?.encodedPolyline}
                nearbyDrivers={nearbyDrivers}
                onPickupSelect={(location) => {
                  void handlePickupMapSelect(location);
                }}
                onDropoffSelect={(location) => {
                  void handleDropoffMapSelect(location);
                }}
                style={{ height: 320 }}
              />
            ) : (
              <View style={{ height: 320, alignItems: "center", justifyContent: "center", backgroundColor: brand.surfaceMuted, gap: 8 }}>
                <Text style={{ color: brand.textMuted, fontSize: 13, textAlign: "center", paddingHorizontal: 20 }}>
                  Map preview is unavailable in this Android build (missing Google Maps key).
                </Text>
                <AppButton
                  label="Use Current Location"
                  variant="secondary"
                  fullWidth={false}
                  onPress={() => {
                    if (currentLocation) {
                      setPickupLocation({ lat: currentLocation.latitude, lng: currentLocation.longitude });
                    }
                  }}
                />
              </View>
            )}
          </View>

          {isOfflineMode ? (
            <AppCard tone="muted">
              <Text style={{ fontSize: 12, color: brand.textMuted }}>
                Backend unreachable: requests are being stored locally on this device.
              </Text>
            </AppCard>
          ) : null}

          <AppCard>
            <Text style={{ fontSize: 16, fontWeight: "700", color: brand.text }}>Pickup</Text>
            <View style={{ marginTop: 10 }}>
              <PlaceSearchInput
                placeholder="Search pickup location"
                onPlaceSelect={handlePickupSelect}
                userLocation={currentLocation ? { lat: currentLocation.latitude, lng: currentLocation.longitude } : undefined}
              />
            </View>

            <Text style={{ marginTop: 14, fontSize: 16, fontWeight: "700", color: brand.text }}>Destination</Text>
            <View style={{ marginTop: 10 }}>
              <PlaceSearchInput
                placeholder="Search dropoff location"
                onPlaceSelect={handleDropoffSelect}
                userLocation={pickupLocation || undefined}
              />
            </View>
          </AppCard>

          <AppCard tone="muted">
            <Text style={{ fontSize: 14, fontWeight: "700", color: brand.text }}>Pickup Time</Text>
            <Text style={{ marginTop: 4, fontSize: 12, color: brand.textMuted }}>Selected: {rideScheduleLabel}</Text>
            <View style={{ marginTop: 10, flexDirection: "row", gap: 8 }}>
              {[
                { value: "now", label: "Now" },
                { value: "15min", label: "+15m" },
                { value: "30min", label: "+30m" },
              ].map((option) => {
                const selected = scheduleOption === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    onPress={() => setScheduleOption(option.value as "now" | "15min" | "30min")}
                    style={{
                      flex: 1,
                      borderRadius: radii.md,
                      borderWidth: 1,
                      borderColor: selected ? brand.primary : brand.border,
                      backgroundColor: selected ? brand.primary : brand.surface,
                      alignItems: "center",
                      justifyContent: "center",
                      paddingVertical: 10,
                    }}
                  >
                    <Text style={{ fontWeight: "700", color: selected ? "#FFFFFF" : brand.text }}>{option.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </AppCard>

          <AppCard>
            <Text style={{ fontSize: 16, fontWeight: "700", color: brand.text }}>Vehicle</Text>
            <View style={{ marginTop: 10, flexDirection: "row", gap: 10 }}>
              {([
                { key: "standard", label: "Standard", desc: "Economy ride", icon: "car" },
                { key: "premium", label: "Premium", desc: "Comfort ride", icon: "car-sport" },
              ] as const).map((option) => {
                const selected = rideType === option.key;
                return (
                  <TouchableOpacity
                    key={option.key}
                    onPress={() => setRideType(option.key)}
                    style={{
                      flex: 1,
                      borderRadius: radii.md,
                      borderWidth: 1,
                      borderColor: selected ? brand.primary : brand.border,
                      backgroundColor: selected ? brand.primarySoft : brand.surface,
                      padding: 12,
                      gap: 5,
                    }}
                  >
                    <Ionicons name={option.icon} size={19} color={selected ? brand.primary : brand.textMuted} />
                    <Text style={{ fontSize: 14, fontWeight: "700", color: brand.text }}>{option.label}</Text>
                    <Text style={{ fontSize: 12, color: brand.textMuted }}>{option.desc}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </AppCard>

          <AppCard tone="primary">
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View>
                <Text style={{ fontSize: 12, color: brand.textMuted }}>Estimated fare</Text>
                <Text style={{ marginTop: 4, fontSize: 30, fontWeight: "800", color: brand.text }}>
                  ${estimatedFare.toFixed(2)}
                </Text>
                <Text style={{ marginTop: 4, fontSize: 12, color: brand.textMuted }}>Payment: Cash</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ fontSize: 12, color: brand.textMuted }}>Distance</Text>
                <Text style={{ marginTop: 2, fontSize: 15, fontWeight: "700", color: brand.text }}>
                  {farePreview ? `${(farePreview.distanceMeters / 1000).toFixed(1)} km` : "--"}
                </Text>
                <Text style={{ marginTop: 6, fontSize: 12, color: brand.textMuted }}>ETA {etaLabel}</Text>
              </View>
            </View>
            {nearbyUpdatedAt ? (
              <Text style={{ marginTop: 10, fontSize: 11, color: brand.textMuted }}>
                Nearby updated: {new Date(nearbyUpdatedAt).toLocaleTimeString()}
              </Text>
            ) : null}
          </AppCard>

          <AppButton
            label={isRequesting ? "Looking for Drivers..." : "Confirm Ride"}
            loading={isRequesting}
            disabled={!pickupLocation || !dropoffLocation || isRequesting}
            onPress={handleRequestRide}
            leftIcon={<Ionicons name="car-sport" size={18} color="#FFFFFF" />}
          />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
