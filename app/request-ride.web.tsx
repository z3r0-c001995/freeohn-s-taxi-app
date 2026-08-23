import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
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
import { calculateDistance } from "@/lib/ride-utils";
import { createTrip, getNearbyDrivers } from "@/lib/ride-hailing-api";
import { calculateFare } from "@/shared/constants/fare";
import type { LatLng, NearbyDriverMarker, PlaceDetails } from "@/lib/maps/map-types";

type RideType = "standard" | "premium";

const QUICK_CITIES = [
  { label: "Lusaka (CBD)", lat: -15.4164, lng: 28.2847, address: "Cairo Road (Lusaka CBD), Lusaka City Centre" },
  { label: "East Park Mall", lat: -15.3897, lng: 28.3237, address: "East Park Mall, Great East Road, Lusaka" },
  { label: "Mansa Central", lat: -11.197, lng: 28.891, address: "Mansa Central, Luapula Province, Zambia" },
  { label: "Kitwe (Mukuba)", lat: -12.8024, lng: 28.2132, address: "Mukuba Mall, Kitwe, Copperbelt Province" },
  { label: "Ndola (Jacaranda)", lat: -12.9691, lng: 28.6366, address: "Jacaranda Mall, Ndola, Copperbelt Province" },
  { label: "Solwezi Central", lat: -12.1738, lng: 26.3908, address: "Solwezi Town Centre, North-Western Province" },
];

export default function RequestRideScreenWeb() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const brand = useBrandTheme();
  const trpcUtils = trpc.useUtils();
  const { currentUser, currentLocation } = useAppStore();
  const isInitializedRef = useRef(false);

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
      return response.address || `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`;
    } catch {
      return `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`;
    }
  };

  // One-time initialization on mount from params or GPS
  useEffect(() => {
    if (isInitializedRef.current) return;

    const init = async () => {
      // 1. Destination from params
      if (params.dest && params.destLat && params.destLng) {
        const destLat = parseFloat(params.destLat as string);
        const destLng = parseFloat(params.destLng as string);
        if (!isNaN(destLat) && !isNaN(destLng)) {
          setDropoffLocation({ lat: destLat, lng: destLng });
          setDropoffAddress(params.dest as string);
        }
      }

      // 2. Pickup from params
      if (params.pickup && params.pickupLat && params.pickupLng) {
        const pLat = parseFloat(params.pickupLat as string);
        const pLng = parseFloat(params.pickupLng as string);
        if (!isNaN(pLat) && !isNaN(pLng)) {
          setPickupLocation({ lat: pLat, lng: pLng });
          setPickupAddress(params.pickup as string);
          isInitializedRef.current = true;
          return;
        }
      }

      // 3. Pickup from currentLocation (GPS) if available
      if (currentLocation) {
        const location = { lat: currentLocation.latitude, lng: currentLocation.longitude };
        setPickupLocation(location);
        const addr = await resolveAddress(location);
        setPickupAddress(addr);
      } else if (typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            setPickupLocation(loc);
            const addr = await resolveAddress(loc);
            setPickupAddress(addr);
          },
          (err) => {
            console.warn("[GPS] Web getCurrentPosition error:", err.message);
          },
          { enableHighAccuracy: true, timeout: 10000 },
        );
      }

      isInitializedRef.current = true;
    };

    void init();
  }, [currentLocation, params]);


  // Calculate Route & Fare
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

  // Fetch Nearby Drivers
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
          radiusKm: 8,
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

  const handlePickupMapSelect = async (location: LatLng) => {
    setPickupLocation(location);
    const addr = await resolveAddress(location);
    setPickupAddress(addr);
  };

  const handleDropoffMapSelect = async (location: LatLng) => {
    setDropoffLocation(location);
    const addr = await resolveAddress(location);
    setDropoffAddress(addr);
  };

  const handleUseGPSLocation = async () => {
    if (!currentLocation) {
      Alert.alert("GPS Inactive", "Could not detect GPS coordinates. Please select your pickup address using search.");
      return;
    }
    const loc = { lat: currentLocation.latitude, lng: currentLocation.longitude };
    setPickupLocation(loc);
    const addr = await resolveAddress(loc);
    setPickupAddress(addr);
  };

  const handleRequestRide = async () => {
    if (!currentUser || !pickupLocation || !dropoffLocation) {
      Alert.alert("Validation", "Please select both pickup and destination using the search or by tapping on the map.");
      return;
    }

    try {
      setIsRequesting(true);
      const distanceMeters = Math.max(0, Math.round(distanceKm * 1000));
      const durationSeconds = Math.max(0, Math.round(etaSeconds));
      const idempotencyKey = `trip_${Date.now()}_${currentUser.id}`;
      const finalPickupAddress = pickupAddress.trim() || (await resolveAddress(pickupLocation));
      const finalDropoffAddress = dropoffAddress.trim() || (await resolveAddress(dropoffLocation));
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
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View style={{ gap: 16, paddingHorizontal: 16, paddingTop: 16 }}>
          {/* Header */}
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
                  backgroundColor: "rgba(255,255,255,0.16)",
                }}
              >
                <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
              </TouchableOpacity>
              <AppBadge label={`Nearby drivers: ${nearbyCount}`} tone="primary" />
            </View>
            <Text style={{ marginTop: 14, fontSize: 28, fontWeight: "800", color: "#FFFFFF" }}>Book Your Ride</Text>
            <Text style={{ marginTop: 4, fontSize: 13, color: "#CBD5E1" }}>
              Type any pickup & destination or tap anywhere on the map to set pins.
            </Text>
          </View>

          {/* Quick Hub / City Chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
            {QUICK_CITIES.map((city) => (
              <TouchableOpacity
                key={city.label}
                onPress={() => {
                  setPickupLocation({ lat: city.lat, lng: city.lng });
                  setPickupAddress(city.address);
                }}
                style={{
                  paddingVertical: 7,
                  paddingHorizontal: 12,
                  borderRadius: 20,
                  backgroundColor: pickupLocation?.lat === city.lat && pickupLocation?.lng === city.lng ? brand.primary : brand.surface,
                  borderWidth: 1,
                  borderColor: brand.border,
                  ...shadows.sm,
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color: pickupLocation?.lat === city.lat && pickupLocation?.lng === city.lng ? "#FFFFFF" : brand.text,
                  }}
                >
                  📍 {city.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Interactive Map View */}
          <View style={{ borderRadius: radii.xl, overflow: "hidden", borderWidth: 1, borderColor: brand.border, ...shadows.md }}>
            <RideMap
              userLocation={pickupLocation || (currentLocation ? { lat: currentLocation.latitude, lng: currentLocation.longitude } : undefined)}
              pickupLocation={pickupLocation || undefined}
              dropoffLocation={dropoffLocation || undefined}
              routePolyline={routePolyline}
              nearbyDrivers={nearbyDrivers}
              onPickupSelect={handlePickupMapSelect}
              onDropoffSelect={handleDropoffMapSelect}
              interactivePlaceSelection={true}
              showControls={true}
              initialStyle="streets"
              style={{ height: 380 }}
            />
          </View>

          {/* Search Inputs Card */}
          <AppCard style={{ overflow: "visible", zIndex: 100 }}>
            <View style={{ gap: 14, overflow: "visible", zIndex: 100 }}>
              {/* Pickup Input */}
              <View style={{ zIndex: 30 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <Text style={{ fontSize: 13, fontWeight: "800", color: "#16A34A", textTransform: "uppercase" }}>
                    🟢 Pickup Location
                  </Text>
                  {currentLocation && (
                    <TouchableOpacity onPress={handleUseGPSLocation} style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                      <Ionicons name="locate" size={13} color="#2563EB" />
                      <Text style={{ fontSize: 11, fontWeight: "700", color: "#2563EB" }}>Use My GPS</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <PlaceSearchInput
                  placeholder="Enter pickup address or choose a landmark"
                  onPlaceSelect={handlePickupSelect}
                  userLocation={currentLocation ? { lat: currentLocation.latitude, lng: currentLocation.longitude } : undefined}
                  value={pickupAddress}
                  onChangeText={(text) => {
                    setPickupAddress(text);
                    if (!text) setPickupLocation(null);
                  }}
                  dotColor="#16A34A"
                  icon="radio-button-on"
                />
              </View>

              {/* Dropoff Input */}
              <View style={{ zIndex: 20 }}>
                <Text style={{ fontSize: 13, fontWeight: "800", color: "#EA580C", marginBottom: 6, textTransform: "uppercase" }}>
                  🟠 Destination
                </Text>
                <PlaceSearchInput
                  placeholder="Where to? (e.g. Manda Hill, East Park, Airport)"
                  onPlaceSelect={handleDropoffSelect}
                  userLocation={pickupLocation || undefined}
                  value={dropoffAddress}
                  onChangeText={(text) => {
                    setDropoffAddress(text);
                    if (!text) setDropoffLocation(null);
                  }}
                  dotColor="#EA580C"
                  icon="location"
                />
              </View>
            </View>
          </AppCard>

          {/* Vehicle Class Selection */}
          <View style={{ flexDirection: "row", gap: 12 }}>
            <TouchableOpacity
              onPress={() => setRideType("standard")}
              style={{
                flex: 1,
                padding: 16,
                borderRadius: radii.xl,
                backgroundColor: rideType === "standard" ? "#EFF6FF" : brand.surface,
                borderWidth: 2,
                borderColor: rideType === "standard" ? "#2563EB" : brand.border,
                ...shadows.sm,
              }}
              activeOpacity={0.8}
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Ionicons name="car" size={24} color={rideType === "standard" ? "#2563EB" : brand.textMuted} />
                <Text style={{ fontSize: 18, fontWeight: "800", color: brand.text }}>
                  {distanceKm > 0 ? `K${fare.toFixed(0)}` : "--"}
                </Text>
              </View>
              <Text style={{ marginTop: 10, fontSize: 16, fontWeight: "800", color: brand.text }}>Standard</Text>
              <Text style={{ marginTop: 2, fontSize: 12, color: brand.textMuted }}>Everyday affordable ride</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setRideType("premium")}
              style={{
                flex: 1,
                padding: 16,
                borderRadius: radii.xl,
                backgroundColor: rideType === "premium" ? "#FFF7ED" : brand.surface,
                borderWidth: 2,
                borderColor: rideType === "premium" ? "#EA580C" : brand.border,
                ...shadows.sm,
              }}
              activeOpacity={0.8}
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Ionicons name="car-sport" size={24} color={rideType === "premium" ? "#EA580C" : brand.textMuted} />
                <Text style={{ fontSize: 18, fontWeight: "800", color: brand.text }}>
                  {distanceKm > 0 ? `K${(fare * 1.35).toFixed(0)}` : "--"}
                </Text>
              </View>
              <Text style={{ marginTop: 10, fontSize: 16, fontWeight: "800", color: brand.text }}>Premium</Text>
              <Text style={{ marginTop: 2, fontSize: 12, color: brand.textMuted }}>Spacious & top drivers</Text>
            </TouchableOpacity>
          </View>

          {/* Trip Summary Card */}
          {distanceKm > 0 && (
            <AppCard tone="primary">
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View>
                  <Text style={{ fontSize: 12, color: brand.textMuted }}>ESTIMATED FARE</Text>
                  <Text style={{ fontSize: 26, fontWeight: "900", color: brand.text }}>
                    K{rideType === "premium" ? (fare * 1.35).toFixed(0) : fare.toFixed(0)}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ fontSize: 12, color: brand.textMuted }}>DISTANCE / ETA</Text>
                  <Text style={{ fontSize: 16, fontWeight: "700", color: brand.text }}>
                    {distanceKm.toFixed(1)} km • {etaLabel}
                  </Text>
                </View>
              </View>
            </AppCard>
          )}

          {/* Confirm Ride Button */}
          <AppButton
            label={
              isRequesting
                ? "Connecting with nearby drivers..."
                : !pickupLocation || !dropoffLocation
                ? "Select Pickup & Destination"
                : `Confirm ${rideType === "premium" ? "Premium" : "Standard"} Ride • K${rideType === "premium" ? (fare * 1.35).toFixed(0) : fare.toFixed(0)}`
            }
            loading={isRequesting}
            disabled={!pickupLocation || !dropoffLocation || isRequesting}
            onPress={() => {
              void handleRequestRide();
            }}
          />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
