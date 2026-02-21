import { useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "@/components/screen-container";
import { RideMap } from "@/components/maps/RideMap";
import { PlaceSearchInput } from "@/components/places/PlaceSearchInput";
import { AppButton } from "@/components/ui/app-button";
import { AppCard } from "@/components/ui/app-card";
import { AppBadge } from "@/components/ui/app-badge";
import { radii, shadows } from "@/constants/design-system";
import { useBrandTheme } from "@/hooks/use-brand-theme";
import { trpc } from "@/lib/trpc";
import { useAppStore } from "@/lib/store";
import { createRide } from "@/lib/db-service";
import { calculateDistance } from "@/lib/ride-utils";
import { createTrip, getNearbyDrivers } from "@/lib/ride-hailing-api";
import { calculateFare } from "@/shared/constants/fare";
import type { LatLng, NearbyDriverMarker, PlaceDetails } from "@/lib/maps/map-types";

type RideType = "standard" | "premium";

export default function RequestRideScreenWeb() {
  const router = useRouter();
  const brand = useBrandTheme();
  const trpcUtils = trpc.useUtils();
  const { currentUser, currentLocation, setActiveRide } = useAppStore();

  const [pickupLocation, setPickupLocation] = useState<LatLng | null>(null);
  const [dropoffLocation, setDropoffLocation] = useState<LatLng | null>(null);
  const [pickupAddress, setPickupAddress] = useState("");
  const [dropoffAddress, setDropoffAddress] = useState("");
  const [rideType, setRideType] = useState<RideType>("standard");
  const [isRequesting, setIsRequesting] = useState(false);
  const [distanceKm, setDistanceKm] = useState(0);
  const [fare, setFare] = useState(0);
  const [etaSeconds, setEtaSeconds] = useState(0);
  const [nearbyCount, setNearbyCount] = useState(0);
  const [nearbyDrivers, setNearbyDrivers] = useState<NearbyDriverMarker[]>([]);
  const [routePolyline, setRoutePolyline] = useState<string | undefined>(undefined);

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

  const resolveAddress = async (location: LatLng) => {
    try {
      const response = await trpcUtils.maps.reverseGeocode.fetch(location);
      return response.address || "Selected location";
    } catch {
      return "Selected location";
    }
  };

  useEffect(() => {
    if (!currentLocation || pickupLocation) return;

    const seedPickup = async () => {
      const location = { lat: currentLocation.latitude, lng: currentLocation.longitude };
      setPickupLocation(location);
      setPickupAddress(await resolveAddress(location));
    };

    void seedPickup();
  }, [currentLocation, pickupLocation]);

  useEffect(() => {
    if (!pickupLocation || !dropoffLocation) {
      setDistanceKm(0);
      setEtaSeconds(0);
      setFare(0);
      setRoutePolyline(undefined);
      return;
    }

    if (routeData) {
      const nextDistanceKm = routeData.distanceMeters / 1000;
      const nextEtaSeconds = routeData.durationSeconds;
      setDistanceKm(nextDistanceKm);
      setEtaSeconds(nextEtaSeconds);
      setFare(calculateFare(nextDistanceKm, nextEtaSeconds / 60, rideType));
      setRoutePolyline(routeData.encodedPolyline || undefined);
      return;
    }

    const fallbackDistanceKm = calculateDistance(
      pickupLocation.lat,
      pickupLocation.lng,
      dropoffLocation.lat,
      dropoffLocation.lng,
    );
    const fallbackEta = Math.max(180, Math.round((fallbackDistanceKm / 35) * 3600));
    setDistanceKm(fallbackDistanceKm);
    setEtaSeconds(fallbackEta);
    setFare(calculateFare(fallbackDistanceKm, fallbackEta / 60, rideType));
    setRoutePolyline(undefined);
  }, [dropoffLocation, pickupLocation, rideType, routeData]);

  useEffect(() => {
    if (!pickupLocation) {
      setNearbyCount(0);
      setNearbyDrivers([]);
      return;
    }

    let isCancelled = false;

    const fetchNearby = async () => {
      try {
        const response = await getNearbyDrivers({
          pickup: pickupLocation,
          radiusKm: 6,
          limit: 20,
        });
        if (!isCancelled) {
          setNearbyCount(response.drivers.length);
          setNearbyDrivers(
            response.drivers.map((driver) => ({
              driverId: driver.driverId,
              lat: driver.location.lat,
              lng: driver.location.lng,
              distanceMeters: driver.distanceMeters,
              etaSeconds: driver.etaSeconds,
            })),
          );
        }
      } catch {
        if (!isCancelled) {
          setNearbyCount(0);
          setNearbyDrivers([]);
        }
      }
    };

    void fetchNearby();
    const timer = setInterval(() => {
      void fetchNearby();
    }, 5000);

    return () => {
      isCancelled = true;
      clearInterval(timer);
    };
  }, [pickupLocation]);

  const handlePickupSelect = (place: PlaceDetails) => {
    setPickupLocation({
      lat: place.geometry.location.lat,
      lng: place.geometry.location.lng,
    });
    setPickupAddress(place.formatted_address);
  };

  const handleDropoffSelect = (place: PlaceDetails) => {
    setDropoffLocation({
      lat: place.geometry.location.lat,
      lng: place.geometry.location.lng,
    });
    setDropoffAddress(place.formatted_address);
  };

  const handlePickupInputChange = (text: string) => {
    setPickupAddress(text);
    setPickupLocation(null);
  };

  const handleDropoffInputChange = (text: string) => {
    setDropoffAddress(text);
    setDropoffLocation(null);
  };

  const handlePickupMapSelect = async (location: LatLng) => {
    setPickupLocation(location);
    setPickupAddress(await resolveAddress(location));
  };

  const handleDropoffMapSelect = async (location: LatLng) => {
    setDropoffLocation(location);
    setDropoffAddress(await resolveAddress(location));
  };

  const handleRequestRide = async () => {
    if (!currentUser || !pickupLocation || !dropoffLocation) {
      Alert.alert("Validation", "Select both pickup and destination using search or map.");
      return;
    }

    try {
      setIsRequesting(true);
      const distanceMeters = Math.max(0, Math.round(distanceKm * 1000));
      const durationSeconds = Math.max(0, Math.round(etaSeconds));
      const idempotencyKey = `trip_${Date.now()}_${currentUser.id}`;
      const finalPickupAddress = pickupAddress.trim() || (await resolveAddress(pickupLocation));
      const finalDropoffAddress = dropoffAddress.trim() || (await resolveAddress(dropoffLocation));

      try {
        const trip = await createTrip({
          pickup: pickupLocation,
          dropoff: dropoffLocation,
          pickupAddress: finalPickupAddress,
          dropoffAddress: finalDropoffAddress,
          rideType,
          distanceMeters,
          durationSeconds,
          paymentMethod: "CASH",
          idempotencyKey,
        });
        router.replace(`/trip/${trip.id}` as never);
        return;
      } catch (apiError) {
        console.warn("[request-ride.web] remote createTrip failed, using local fallback", apiError);
      }

      const ride = await createRide(
        currentUser.id.toString(),
        pickupLocation.lat,
        pickupLocation.lng,
        dropoffLocation.lat,
        dropoffLocation.lng,
        finalPickupAddress,
        finalDropoffAddress,
        rideType,
        fare,
        distanceMeters,
        durationSeconds,
      );

      setActiveRide(ride);
      router.replace(`/trip/${ride.id}` as never);
    } catch (error) {
      console.error("[request-ride.web] Failed to request ride", error);
      Alert.alert("Error", error instanceof Error ? error.message : "Unable to request ride now.");
    } finally {
      setIsRequesting(false);
    }
  };

  const etaLabel = useMemo(() => {
    if (!etaSeconds) return "--";
    return `${Math.max(1, Math.round(etaSeconds / 60))} min`;
  }, [etaSeconds]);

  return (
    <ScreenContainer className="bg-background" containerClassName="bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <View style={{ gap: 16, paddingBottom: 20 }}>
          <View
            style={{
              borderRadius: radii.xl,
              padding: 18,
              backgroundColor: "#0A1E49",
              ...shadows.md,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
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
              <AppBadge label={`Nearby drivers: ${nearbyCount}`} tone="primary" />
            </View>
            <Text style={{ marginTop: 16, fontSize: 28, fontWeight: "800", color: "#FFFFFF" }}>Request Ride</Text>
            <Text style={{ marginTop: 6, fontSize: 14, color: "#CBD5E1" }}>
              Search addresses or tap the map to set pickup and destination.
            </Text>
          </View>

          <View style={{ borderRadius: radii.xl, overflow: "hidden", borderWidth: 1, borderColor: brand.border }}>
            <RideMap
              userLocation={currentLocation ? { lat: currentLocation.latitude, lng: currentLocation.longitude } : undefined}
              pickupLocation={pickupLocation || undefined}
              dropoffLocation={dropoffLocation || undefined}
              routePolyline={routePolyline}
              nearbyDrivers={nearbyDrivers}
              onPickupSelect={(location) => {
                void handlePickupMapSelect(location);
              }}
              onDropoffSelect={(location) => {
                void handleDropoffMapSelect(location);
              }}
              style={{ height: 360 }}
            />
          </View>

          <AppCard>
            <View style={{ gap: 12 }}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: brand.text }}>Pickup</Text>
              <PlaceSearchInput
                placeholder="Search pickup address"
                onPlaceSelect={handlePickupSelect}
                userLocation={currentLocation ? { lat: currentLocation.latitude, lng: currentLocation.longitude } : undefined}
                value={pickupAddress}
                onChangeText={handlePickupInputChange}
              />
              <Text style={{ fontSize: 12, color: brand.textMuted }}>
                {pickupAddress ? `Selected: ${pickupAddress}` : "Tap map or search pickup address."}
              </Text>

              <Text style={{ marginTop: 2, fontSize: 14, fontWeight: "700", color: brand.text }}>Destination</Text>
              <PlaceSearchInput
                placeholder="Search destination address"
                onPlaceSelect={handleDropoffSelect}
                userLocation={pickupLocation || undefined}
                value={dropoffAddress}
                onChangeText={handleDropoffInputChange}
              />
              <Text style={{ fontSize: 12, color: brand.textMuted }}>
                {dropoffAddress ? `Selected: ${dropoffAddress}` : "Tap map or search destination address."}
              </Text>

              <View style={{ marginTop: 4, flexDirection: "row", gap: 10 }}>
                <TouchableOpacity
                  onPress={() => setRideType("standard")}
                  style={{
                    flex: 1,
                    borderRadius: radii.md,
                    borderWidth: 1,
                    borderColor: rideType === "standard" ? brand.primary : brand.border,
                    backgroundColor: rideType === "standard" ? brand.primarySoft : brand.surface,
                    padding: 12,
                  }}
                >
                  <Text style={{ fontWeight: "700", color: brand.text }}>Standard</Text>
                  <Text style={{ marginTop: 4, fontSize: 12, color: brand.textMuted }}>Affordable everyday ride</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setRideType("premium")}
                  style={{
                    flex: 1,
                    borderRadius: radii.md,
                    borderWidth: 1,
                    borderColor: rideType === "premium" ? brand.primary : brand.border,
                    backgroundColor: rideType === "premium" ? brand.primarySoft : brand.surface,
                    padding: 12,
                  }}
                >
                  <Text style={{ fontWeight: "700", color: brand.text }}>Premium</Text>
                  <Text style={{ marginTop: 4, fontSize: 12, color: brand.textMuted }}>More comfort and space</Text>
                </TouchableOpacity>
              </View>

              <View
                style={{
                  marginTop: 4,
                  borderRadius: radii.md,
                  padding: 14,
                  backgroundColor: brand.surfaceMuted,
                  borderWidth: 1,
                  borderColor: brand.border,
                  flexDirection: "row",
                  justifyContent: "space-between",
                }}
              >
                <View>
                  <Text style={{ fontSize: 12, color: brand.textMuted }}>Estimated fare</Text>
                  <Text style={{ marginTop: 2, fontSize: 26, fontWeight: "800", color: brand.text }}>
                    ${fare.toFixed(2)}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ fontSize: 12, color: brand.textMuted }}>Distance</Text>
                  <Text style={{ marginTop: 2, fontSize: 16, fontWeight: "700", color: brand.text }}>
                    {distanceKm > 0 ? `${distanceKm.toFixed(1)} km` : "--"}
                  </Text>
                  <Text style={{ marginTop: 4, fontSize: 12, color: brand.textMuted }}>ETA {etaLabel}</Text>
                </View>
              </View>

              <AppButton
                label={isRequesting ? "Looking for Drivers..." : "Confirm Ride"}
                loading={isRequesting}
                disabled={!pickupLocation || !dropoffLocation}
                onPress={handleRequestRide}
                leftIcon={<Ionicons name="car-sport" size={16} color="#FFFFFF" />}
              />
            </View>
          </AppCard>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
