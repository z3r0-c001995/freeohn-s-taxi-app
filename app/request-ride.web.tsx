import { useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "@/components/screen-container";
import { RideMap } from "@/components/maps/RideMap";
import { AppButton } from "@/components/ui/app-button";
import { AppCard } from "@/components/ui/app-card";
import { AppInput } from "@/components/ui/app-input";
import { AppBadge } from "@/components/ui/app-badge";
import { radii, shadows } from "@/constants/design-system";
import { useBrandTheme } from "@/hooks/use-brand-theme";
import { useAppStore } from "@/lib/store";
import { createRide } from "@/lib/db-service";
import { createTrip, getNearbyDrivers } from "@/lib/ride-hailing-api";
import { calculateFare } from "@/shared/constants/fare";
import type { NearbyDriverMarker } from "@/lib/maps/map-types";

type RideType = "standard" | "premium";

export default function RequestRideScreenWeb() {
  const router = useRouter();
  const brand = useBrandTheme();
  const { currentUser, currentLocation, setActiveRide } = useAppStore();

  const [pickupLat, setPickupLat] = useState("");
  const [pickupLng, setPickupLng] = useState("");
  const [dropoffLat, setDropoffLat] = useState("");
  const [dropoffLng, setDropoffLng] = useState("");
  const [pickupAddress, setPickupAddress] = useState("");
  const [dropoffAddress, setDropoffAddress] = useState("");
  const [rideType, setRideType] = useState<RideType>("standard");
  const [isRequesting, setIsRequesting] = useState(false);
  const [distance, setDistance] = useState(0);
  const [fare, setFare] = useState(0);
  const [etaSeconds, setEtaSeconds] = useState(0);
  const [nearbyCount, setNearbyCount] = useState(0);
  const [nearbyDrivers, setNearbyDrivers] = useState<NearbyDriverMarker[]>([]);

  useEffect(() => {
    if (currentLocation) {
      setPickupLat(currentLocation.latitude.toString());
      setPickupLng(currentLocation.longitude.toString());
    }
  }, [currentLocation]);

  const calculateDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  useEffect(() => {
    const pLat = parseFloat(pickupLat);
    const pLng = parseFloat(pickupLng);
    const dLat = parseFloat(dropoffLat);
    const dLng = parseFloat(dropoffLng);

    if (!Number.isFinite(pLat) || !Number.isFinite(pLng) || !Number.isFinite(dLat) || !Number.isFinite(dLng)) {
      setDistance(0);
      setFare(0);
      setEtaSeconds(0);
      return;
    }

    const distanceKm = calculateDistanceKm(pLat, pLng, dLat, dLng);
    const durationSeconds = Math.max(180, Math.round((distanceKm / 35) * 3600));
    setDistance(distanceKm);
    setEtaSeconds(durationSeconds);
    setFare(calculateFare(distanceKm, durationSeconds / 60, rideType));
  }, [pickupLat, pickupLng, dropoffLat, dropoffLng, rideType]);

  useEffect(() => {
    const pLat = parseFloat(pickupLat);
    const pLng = parseFloat(pickupLng);

    if (!Number.isFinite(pLat) || !Number.isFinite(pLng)) {
      setNearbyCount(0);
      setNearbyDrivers([]);
      return;
    }

    let isCancelled = false;

    const fetchNearby = async () => {
      try {
        const response = await getNearbyDrivers({ pickup: { lat: pLat, lng: pLng }, radiusKm: 6, limit: 20 });
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
  }, [pickupLat, pickupLng]);

  const handleRequestRide = async () => {
    const pLat = parseFloat(pickupLat);
    const pLng = parseFloat(pickupLng);
    const dLat = parseFloat(dropoffLat);
    const dLng = parseFloat(dropoffLng);

    if (!currentUser || !Number.isFinite(pLat) || !Number.isFinite(pLng) || !Number.isFinite(dLat) || !Number.isFinite(dLng)) {
      Alert.alert("Validation", "Please provide valid pickup and destination coordinates.");
      return;
    }

    try {
      setIsRequesting(true);
      const distanceMeters = Math.max(0, Math.round(distance * 1000));
      const durationSeconds = Math.max(0, Math.round(etaSeconds));
      const idempotencyKey = `trip_${Date.now()}_${currentUser.id}`;

      try {
        const trip = await createTrip({
          pickup: { lat: pLat, lng: pLng },
          dropoff: { lat: dLat, lng: dLng },
          pickupAddress: pickupAddress || `${pLat.toFixed(6)}, ${pLng.toFixed(6)}`,
          dropoffAddress: dropoffAddress || `${dLat.toFixed(6)}, ${dLng.toFixed(6)}`,
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
        pLat,
        pLng,
        dLat,
        dLng,
        pickupAddress || `${pLat.toFixed(6)}, ${pLng.toFixed(6)}`,
        dropoffAddress || `${dLat.toFixed(6)}, ${dLng.toFixed(6)}`,
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

  const parsedPickupLat = parseFloat(pickupLat);
  const parsedPickupLng = parseFloat(pickupLng);
  const parsedDropoffLat = parseFloat(dropoffLat);
  const parsedDropoffLng = parseFloat(dropoffLng);

  const pickupLocation =
    Number.isFinite(parsedPickupLat) && Number.isFinite(parsedPickupLng)
      ? { lat: parsedPickupLat, lng: parsedPickupLng }
      : undefined;
  const dropoffLocation =
    Number.isFinite(parsedDropoffLat) && Number.isFinite(parsedDropoffLng)
      ? { lat: parsedDropoffLat, lng: parsedDropoffLng }
      : undefined;

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
              Set pickup and destination, then confirm your ride.
            </Text>
          </View>

          <View style={{ borderRadius: radii.xl, overflow: "hidden", borderWidth: 1, borderColor: brand.border }}>
            <RideMap
              userLocation={currentLocation ? { lat: currentLocation.latitude, lng: currentLocation.longitude } : undefined}
              pickupLocation={pickupLocation}
              dropoffLocation={dropoffLocation}
              nearbyDrivers={nearbyDrivers}
              style={{ height: 360 }}
            />
          </View>

          <AppCard>
            <View style={{ gap: 12 }}>
              <AppInput
                label="Pickup"
                value={pickupAddress}
                onChangeText={setPickupAddress}
                placeholder="Pickup address"
              />
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <AppInput placeholder="Pickup lat" value={pickupLat} onChangeText={setPickupLat} keyboardType="numeric" />
                </View>
                <View style={{ flex: 1 }}>
                  <AppInput placeholder="Pickup lng" value={pickupLng} onChangeText={setPickupLng} keyboardType="numeric" />
                </View>
              </View>

              <AppInput
                label="Destination"
                value={dropoffAddress}
                onChangeText={setDropoffAddress}
                placeholder="Dropoff address"
              />
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <AppInput placeholder="Dropoff lat" value={dropoffLat} onChangeText={setDropoffLat} keyboardType="numeric" />
                </View>
                <View style={{ flex: 1 }}>
                  <AppInput placeholder="Dropoff lng" value={dropoffLng} onChangeText={setDropoffLng} keyboardType="numeric" />
                </View>
              </View>

              <View style={{ flexDirection: "row", gap: 10 }}>
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
                    {distance > 0 ? `${distance.toFixed(1)} km` : "--"}
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
