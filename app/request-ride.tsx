import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Animated, Platform, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "@/components/screen-container";
import { RideMap } from "@/components/maps/RideMap";
import { PlaceSearchInput } from "@/components/places/PlaceSearchInput";
import { AppButton } from "@/components/ui/app-button";
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
  const [scheduleOption, setScheduleOption] = useState<"now" | "15min" | "30min">("now");

  // Animate the bottom sheet sliding up
  const sheetAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(sheetAnim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 10 }).start();
  }, []);

  // Pre-fill pickup from GPS
  useEffect(() => {
    if (currentLocation && !pickupLocation) {
      setPickupLocation({ lat: currentLocation.latitude, lng: currentLocation.longitude });
      // Reverse geocode for display address
      trpcUtils.maps.reverseGeocode
        .fetch({ lat: currentLocation.latitude, lng: currentLocation.longitude })
        .then((r) => setPickupAddress(r.address || "Current location"))
        .catch(() => setPickupAddress("Current location"));
    }
  }, [currentLocation, pickupLocation, trpcUtils]);

  useEffect(() => {
    if (!IS_SEEKER_APP) {
      Alert.alert("Unavailable", "Ride request is only available in the Service Seeker app.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    }
  }, [router]);

  const { data: routeData } = trpc.maps.computeRoute.useQuery(
    { origin: pickupLocation!, destination: dropoffLocation!, travelMode: "DRIVE" },
    { enabled: !!pickupLocation && !!dropoffLocation },
  );

  useEffect(() => {
    if (!pickupLocation || !dropoffLocation) { setRouteSummary(null); return; }
    if (routeData) { setRouteSummary(routeData); return; }
    const fallbackKm = calculateDistance(pickupLocation.lat, pickupLocation.lng, dropoffLocation.lat, dropoffLocation.lng);
    const fallbackMeters = Math.max(1, Math.round(fallbackKm * 1000));
    setRouteSummary({ distanceMeters: fallbackMeters, durationSeconds: Math.max(60, Math.round((fallbackKm / 40) * 3600)), encodedPolyline: "", steps: [] });
  }, [routeData, pickupLocation, dropoffLocation]);

  useEffect(() => {
    const fetchEstimate = async () => {
      if (!pickupLocation || !dropoffLocation || !routeSummary) { setFarePreview(null); return; }
      try {
        const estimate = await estimateTrip({ pickup: pickupLocation, dropoff: dropoffLocation, distanceMeters: routeSummary.distanceMeters, durationSeconds: routeSummary.durationSeconds, rideType });
        setFarePreview({ total: estimate.fare.total, distanceMeters: estimate.distanceMeters, etaSeconds: estimate.etaSeconds, currency: estimate.fare.currency });
      } catch {
        const fallbackTotal = calculateFare(routeSummary.distanceMeters / 1000, routeSummary.durationSeconds / 60, rideType);
        setFarePreview({ total: fallbackTotal, distanceMeters: routeSummary.distanceMeters, etaSeconds: routeSummary.durationSeconds, currency: "ZMW" });
      }
    };
    void fetchEstimate();
  }, [pickupLocation, dropoffLocation, routeSummary, rideType]);

  useEffect(() => {
    let isCancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    const fetchNearby = async () => {
      if (!pickupLocation || !IS_SEEKER_APP) { if (!isCancelled) setNearbyDrivers([]); return; }
      try {
        const response = await getNearbyDrivers({ pickup: pickupLocation, radiusKm: 6, limit: 20 });
        if (isCancelled) return;
        setNearbyDrivers(response.drivers.map((d) => ({ driverId: d.driverId, lat: d.location.lat, lng: d.location.lng, distanceMeters: d.distanceMeters, etaSeconds: d.etaSeconds })));
      } catch {
        if (isCancelled) return;
        const localDrivers = await getOnlineDrivers();
        if (isCancelled) return;
        setNearbyDrivers(
          localDrivers.map<NearbyDriverMarker | null>((d) => {
            const lat = Number(d.currentLat); const lng = Number(d.currentLng);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
            const km = calculateDistance(pickupLocation.lat, pickupLocation.lng, lat, lng);
            if (km > 6) return null;
            return { driverId: String(d.userId), lat, lng, distanceMeters: Math.round(km * 1000), etaSeconds: Math.max(60, Math.round((km / 35) * 3600)) };
          }).filter((d): d is NearbyDriverMarker => d !== null).slice(0, 20),
        );
      }
    };
    void fetchNearby();
    if (pickupLocation) timer = setInterval(() => void fetchNearby(), 5000);
    return () => { isCancelled = true; if (timer) clearInterval(timer); };
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
    try { return (await trpcUtils.maps.reverseGeocode.fetch(location)).address || "Selected location"; }
    catch { return "Selected location"; }
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
    if (!IS_SEEKER_APP) { Alert.alert("Unavailable", "Ride request is only available in the Service Seeker app."); return; }
    if (!pickupLocation || !dropoffLocation || !currentUser) { Alert.alert("Validation", "Please select pickup and dropoff locations."); return; }
    setIsRequesting(true);
    try {
      const distanceMeters = routeSummary?.distanceMeters ?? 0;
      const durationSeconds = routeSummary?.durationSeconds ?? 0;
      let trip: any; let usedOfflineMode = false;
      try {
        trip = await createTrip({ pickup: pickupLocation, dropoff: dropoffLocation, pickupAddress, dropoffAddress, rideType, distanceMeters, durationSeconds, paymentMethod: "CASH", idempotencyKey: `trip_${Date.now()}_${currentUser.id}` });
      } catch {
        usedOfflineMode = true; setIsOfflineMode(true);
        const localFare = farePreview?.total ?? calculateFare((distanceMeters || 1000) / 1000, (durationSeconds || 300) / 60, rideType);
        trip = await createRide(currentUser.id.toString(), pickupLocation.lat, pickupLocation.lng, dropoffLocation.lat, dropoffLocation.lng, pickupAddress || "Pickup", dropoffAddress || "Dropoff", rideType, localFare, distanceMeters, durationSeconds, routeSummary?.encodedPolyline);
      }
      if (usedOfflineMode) Alert.alert("Offline Mode", "Ride created locally. Opening trip tracker.");
      router.replace(`/trip/${trip.id}` as never);
    } catch (error) {
      console.error("Failed to request ride:", error);
      Alert.alert("Error", "Failed to request ride");
    } finally { setIsRequesting(false); }
  };

  const estimatedFare = farePreview?.total ?? 0;
  const etaLabel = useMemo(() => {
    if (!farePreview?.etaSeconds) return "--";
    return `${Math.max(1, Math.round(farePreview.etaSeconds / 60))} min`;
  }, [farePreview?.etaSeconds]);

  const distLabel = useMemo(() => {
    if (!routeSummary?.distanceMeters) return "--";
    return `${(routeSummary.distanceMeters / 1000).toFixed(1)} km`;
  }, [routeSummary?.distanceMeters]);

  const sheetTranslate = sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [60, 0] });

  return (
    <ScreenContainer className="bg-background" containerClassName="bg-background">
      <View style={{ flex: 1 }}>
        {/* ── Full-screen Map ── */}
        <View style={{ flex: 1 }}>
          <RideMap
            userLocation={currentLocation ? { lat: currentLocation.latitude, lng: currentLocation.longitude } : undefined}
            pickupLocation={pickupLocation || undefined}
            dropoffLocation={dropoffLocation || undefined}
            routePolyline={routeSummary?.encodedPolyline}
            nearbyDrivers={nearbyDrivers}
            onPickupSelect={handlePickupMapSelect}
            onDropoffSelect={handleDropoffMapSelect}
            style={{ flex: 1 }}
          />

          {/* ── Floating search card (top overlay, integrated back button) ── */}
          <View style={{ position: "absolute", top: 50, left: 16, right: 16, zIndex: 10 }}>
            <View style={{ backgroundColor: brand.surface, borderRadius: 24, padding: 16, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: brand.border, ...shadows.lg }}>
              <TouchableOpacity
                onPress={() => router.back()}
                style={{ height: 44, width: 44, justifyContent: "center", alignItems: "flex-start", marginLeft: -4 }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="arrow-back" size={24} color={brand.text} />
              </TouchableOpacity>

              <View style={{ flex: 1, marginLeft: 4 }}>
                {/* Pickup row */}
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: brand.primary, marginRight: 12, marginLeft: 2 }} />
                  <PlaceSearchInput
                    placeholder="Pickup location"
                    value={pickupAddress}
                    onChangeText={(t) => { setPickupAddress(t); setPickupLocation(null); }}
                    onPlaceSelect={handlePickupSelect}
                    userLocation={currentLocation ? { lat: currentLocation.latitude, lng: currentLocation.longitude } : undefined}
                    style={{ flex: 1, zIndex: 20 }}
                  />
                </View>

                {/* Connector dashes */}
                <View style={{ marginLeft: 6, height: 16, borderLeftWidth: 2, borderLeftColor: brand.border, borderStyle: "dashed", marginVertical: 6 }} />

                {/* Dropoff row */}
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View style={{ width: 10, height: 10, backgroundColor: brand.accent, marginRight: 12, marginLeft: 2 }} />
                  <PlaceSearchInput
                    placeholder="Where to?"
                    value={dropoffAddress}
                    onChangeText={(t) => { setDropoffAddress(t); setDropoffLocation(null); }}
                    onPlaceSelect={handleDropoffSelect}
                    userLocation={currentLocation ? { lat: currentLocation.latitude, lng: currentLocation.longitude } : undefined}
                    style={{ flex: 1, zIndex: 10 }}
                  />
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* ── Bottom Sheet ── */}
        <Animated.View
          style={{
            backgroundColor: brand.background,
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: 30,
            ...shadows.lg,
            transform: [{ translateY: sheetTranslate }],
          }}
        >
          {/* Handle */}
          <View style={{ width: 40, height: 4, backgroundColor: brand.border, borderRadius: 2, alignSelf: "center", marginBottom: 18 }} />

          {/* Trip summary row */}
          {routeSummary && (
            <View style={{ flexDirection: "row", justifyContent: "space-around", marginBottom: 20, backgroundColor: brand.surfaceMuted, borderRadius: radii.xl, padding: 14 }}>
              {[
                { icon: "timer-outline" as const, label: "ETA", value: etaLabel },
                { icon: "map-outline" as const, label: "Distance", value: distLabel },
                { icon: "cash-outline" as const, label: "Fare", value: `K${estimatedFare.toFixed(2)}` },
              ].map((item) => (
                <View key={item.label} style={{ alignItems: "center" }}>
                  <Ionicons name={item.icon} size={22} color={brand.primary} />
                  <Text style={{ fontSize: 11, color: brand.textMuted, marginTop: 4 }}>{item.label}</Text>
                  <Text style={{ fontSize: 16, fontWeight: "800", color: brand.text, marginTop: 2 }}>{item.value}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Ride type selector */}
          <Text style={{ fontSize: 16, fontWeight: "800", color: brand.text, marginBottom: 12 }}>Select Ride</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, marginBottom: 20 }}>
            {[
              { id: "standard", label: "Economy", multiplier: 1, icon: "car-outline" as const },
              { id: "xl",       label: "XL",      multiplier: 1.8, icon: "car-sport-outline" as const },
              { id: "ong",      label: "ONG",     multiplier: 2.5, icon: "flash-outline" as const },
            ].map(({ id, label, multiplier, icon }) => {
              const selected = rideType === id;
              return (
                <TouchableOpacity
                  key={id}
                  onPress={() => setRideType(id as RideType)}
                  style={{
                    width: 112, padding: 14, borderRadius: radii.xl, alignItems: "center",
                    backgroundColor: selected ? brand.primary : brand.surface,
                    borderWidth: 2, borderColor: selected ? brand.primary : brand.border,
                    ...shadows.sm,
                  }}
                >
                  <Ionicons name={icon} size={28} color={selected ? "#FFFFFF" : brand.textMuted} />
                  <Text style={{ marginTop: 8, fontSize: 13, fontWeight: "700", color: selected ? "#FFFFFF" : brand.text }}>{label}</Text>
                  <Text style={{ fontSize: 14, fontWeight: "800", color: selected ? "#FFFFFF" : brand.primary, marginTop: 3 }}>
                    K{(estimatedFare * multiplier).toFixed(0)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <AppButton
            label={dropoffLocation ? `Confirm ${rideType === "standard" ? "Economy" : rideType.toUpperCase()}` : "Choose a destination"}
            onPress={handleRequestRide}
            loading={isRequesting}
            disabled={!pickupLocation || !dropoffLocation}
            style={{ height: 58, borderRadius: radii.xl }}
          />
        </Animated.View>
      </View>
    </ScreenContainer>
  );
}
