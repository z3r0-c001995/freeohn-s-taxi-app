import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

import { ScreenContainer } from "@/components/screen-container";
import { RideMap } from "@/components/maps/RideMap";
import { PlaceSearchInput } from "@/components/places/PlaceSearchInput";
import { RideTierSelector, RideTierId } from "@/components/passenger/RideTierSelector";
import { IS_SEEKER_APP } from "@/constants/app-variant";
import { useBrandTheme } from "@/hooks/use-brand-theme";
import { trpc } from "@/lib/trpc";
import { useAppStore } from "@/lib/store";
import { createRide, getOnlineDrivers } from "@/lib/db-service";
import { calculateDistance } from "@/lib/ride-utils";
import type { LatLng, NearbyDriverMarker, RouteSummary, PlaceDetails } from "@/lib/maps/map-types";
import { createTrip, estimateTrip, getNearbyDrivers } from "@/lib/ride-hailing-api";
import { calculateFare } from "@/shared/constants/fare";

export default function RequestRideScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    dest?: string;
    destLat?: string;
    destLng?: string;
    pickupLat?: string;
    pickupLng?: string;
    service?: "taxi" | "moto" | "delivery";
  }>();

  const trpcUtils = trpc.useUtils();
  const brand = useBrandTheme();
  const { currentUser, currentLocation } = useAppStore();

  const initialService = (params.service === "moto" || params.service === "delivery") ? params.service : "taxi";
  const [pickupLocation, setPickupLocation] = useState<LatLng | null>(null);
  const [dropoffLocation, setDropoffLocation] = useState<LatLng | null>(null);
  const [pickupAddress, setPickupAddress] = useState("Kaunda Square Stage 1, 9061");
  const [dropoffAddress, setDropoffAddress] = useState("Lifestyle Health & Fitness");
  const [selectedTier, setSelectedTier] = useState<RideTierId>(
    initialService === "moto" ? "moto_std" : initialService === "delivery" ? "del_moto" : "economy"
  );
  const [categoryTab, setCategoryTab] = useState<"taxi" | "moto" | "delivery">(initialService);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "momo">("cash");

  const [isRequesting, setIsRequesting] = useState(false);
  const [routeSummary, setRouteSummary] = useState<RouteSummary | null>(null);
  const [farePreview, setFarePreview] = useState<{
    total: number;
    distanceMeters: number;
    etaSeconds: number;
    currency: string;
  } | null>(null);
  const [nearbyDrivers, setNearbyDrivers] = useState<NearbyDriverMarker[]>([]);
  const [showSearchModal, setShowSearchModal] = useState(false);

  // Animated sheet transition
  const sheetAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(sheetAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  }, []);

  // Initialize pickup and dropoff from query params or current location
  useEffect(() => {
    // 1. Pickup location setup
    if (params.pickupLat && params.pickupLng) {
      const lat = parseFloat(params.pickupLat);
      const lng = parseFloat(params.pickupLng);
      setPickupLocation({ lat, lng });
    } else if (currentLocation) {
      setPickupLocation({ lat: currentLocation.latitude, lng: currentLocation.longitude });
      trpcUtils.maps.reverseGeocode
        .fetch({ lat: currentLocation.latitude, lng: currentLocation.longitude })
        .then((r) => {
          if (r.address) setPickupAddress(r.address);
        })
        .catch(() => {});
    } else {
      // Default to Lusaka hub location
      setPickupLocation({ lat: -15.3875, lng: 28.3228 });
    }

    // 2. Dropoff location setup
    if (params.destLat && params.destLng) {
      const lat = parseFloat(params.destLat);
      const lng = parseFloat(params.destLng);
      setDropoffLocation({ lat, lng });
      if (params.dest) {
        setDropoffAddress(decodeURIComponent(params.dest));
      }
    } else if (!dropoffLocation) {
      // Default nearby destination for instant visual route preview
      setDropoffLocation({ lat: -15.395, lng: 28.332 });
    }
  }, [params.dest, params.destLat, params.destLng, params.pickupLat, params.pickupLng, currentLocation]);

  // Compute route query
  const { data: routeData } = trpc.maps.computeRoute.useQuery(
    { origin: pickupLocation!, destination: dropoffLocation!, travelMode: "DRIVE" },
    { enabled: !!pickupLocation && !!dropoffLocation },
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
    const fallbackKm = calculateDistance(
      pickupLocation.lat,
      pickupLocation.lng,
      dropoffLocation.lat,
      dropoffLocation.lng,
    );
    const fallbackMeters = Math.max(1, Math.round(fallbackKm * 1000));
    setRouteSummary({
      distanceMeters: fallbackMeters,
      durationSeconds: Math.max(60, Math.round((fallbackKm / 40) * 3600)),
      encodedPolyline: "",
      steps: [],
    });
  }, [routeData, pickupLocation, dropoffLocation]);

  // Fetch fare estimate
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
          rideType: selectedTier === "comfort" ? "premium" : "standard",
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
          selectedTier === "comfort" ? "premium" : "standard",
        );
        setFarePreview({
          total: fallbackTotal,
          distanceMeters: routeSummary.distanceMeters,
          etaSeconds: routeSummary.durationSeconds,
          currency: "ZMW",
        });
      }
    };
    void fetchEstimate();
  }, [pickupLocation, dropoffLocation, routeSummary, selectedTier]);

  // Fetch nearby active drivers
  useEffect(() => {
    let isCancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    const fetchNearby = async () => {
      if (!pickupLocation) {
        if (!isCancelled) setNearbyDrivers([]);
        return;
      }
      try {
        const response = await getNearbyDrivers({ pickup: pickupLocation, radiusKm: 6, limit: 20 });
        if (isCancelled) return;
        setNearbyDrivers(
          response.drivers.map((d) => ({
            driverId: d.driverId,
            lat: d.location.lat,
            lng: d.location.lng,
            distanceMeters: d.distanceMeters,
            etaSeconds: d.etaSeconds,
          })),
        );
      } catch {
        if (isCancelled) return;
        const localDrivers = await getOnlineDrivers();
        if (isCancelled) return;
        setNearbyDrivers(
          localDrivers
            .map<NearbyDriverMarker | null>((d) => {
              const lat = Number(d.currentLat);
              const lng = Number(d.currentLng);
              if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
              const km = calculateDistance(pickupLocation.lat, pickupLocation.lng, lat, lng);
              if (km > 6) return null;
              return {
                driverId: String(d.userId),
                lat,
                lng,
                distanceMeters: Math.round(km * 1000),
                etaSeconds: Math.max(60, Math.round((km / 35) * 3600)),
              };
            })
            .filter((d): d is NearbyDriverMarker => d !== null)
            .slice(0, 20),
        );
      }
    };
    void fetchNearby();
    if (pickupLocation) timer = setInterval(() => void fetchNearby(), 5000);
    return () => {
      isCancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [pickupLocation]);

  const handleRequestRide = async () => {
    if (!pickupLocation || !dropoffLocation || !currentUser) {
      Alert.alert("Validation", "Please select pickup and dropoff locations.");
      return;
    }
    setIsRequesting(true);
    try {
      const distanceMeters = routeSummary?.distanceMeters ?? 0;
      const durationSeconds = routeSummary?.durationSeconds ?? 0;
      const rideType = selectedTier === "comfort" ? "premium" : "standard";
      let trip: any;
      try {
        trip = await createTrip({
          pickup: pickupLocation,
          dropoff: dropoffLocation,
          pickupAddress,
          dropoffAddress,
          rideType,
          distanceMeters,
          durationSeconds,
          paymentMethod: paymentMethod === "card" ? "MOBILE_MONEY" : "CASH",
          idempotencyKey: `trip_${Date.now()}_${currentUser.id}`,
        });
      } catch {
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
      router.replace(`/trip/${trip.id}` as never);
    } catch (error) {
      console.error("Failed to request ride:", error);
      Alert.alert("Error", "Failed to request ride");
    } finally {
      setIsRequesting(false);
    }
  };

  const etaMinutes = useMemo(() => {
    if (!farePreview?.etaSeconds) return 4;
    return Math.max(1, Math.round(farePreview.etaSeconds / 60));
  }, [farePreview?.etaSeconds]);

  const arrivalTimeFormatted = useMemo(() => {
    const d = new Date(Date.now() + (farePreview?.etaSeconds ?? 240) * 1000 + 660 * 1000);
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  }, [farePreview?.etaSeconds]);

  const sheetTranslate = sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [80, 0] });

  return (
    <ScreenContainer className="bg-background" containerClassName="bg-background">
      <View style={styles.container}>
        {/* ── 1. Full-Screen Interactive Map ── */}
        <View style={styles.mapWrapper}>
          <RideMap
            userLocation={currentLocation ? { lat: currentLocation.latitude, lng: currentLocation.longitude } : undefined}
            pickupLocation={pickupLocation || undefined}
            dropoffLocation={dropoffLocation || undefined}
            routePolyline={routeSummary?.encodedPolyline}
            nearbyDrivers={nearbyDrivers}
            interactivePlaceSelection={true}
            style={styles.map}
          />

          {/* Top-Left Transport Mode Switcher Pill */}
          <View style={styles.topTransportPill}>
            <TouchableOpacity activeOpacity={0.8} style={styles.transportActiveIcon}>
              <Ionicons name="car" size={18} color="#0F172A" />
            </TouchableOpacity>
            <View style={styles.transportDividerYellow} />
            <TouchableOpacity activeOpacity={0.8} style={styles.transportBadgeYellow}>
              <Text style={styles.transportBadgeText}>K+</Text>
            </TouchableOpacity>
            <View style={styles.transportDividerYellow} />
            <TouchableOpacity activeOpacity={0.8} style={styles.transportWalkIcon}>
              <MaterialCommunityIcons name="walk" size={18} color="#0F172A" />
            </TouchableOpacity>
          </View>

          {/* Map Route Arrival Label */}
          <View style={styles.mapArrivalOverlay}>
            <Text style={styles.mapArrivalText}>arrive at {arrivalTimeFormatted}</Text>
          </View>

          {/* Destination ETA Red Badge Overlay */}
          <View style={styles.mapEtaBadge}>
            <Text style={styles.mapEtaNumber}>{etaMinutes}</Text>
            <Text style={styles.mapEtaUnit}>min</Text>
          </View>

          {/* Floating Back Button (Bottom-Left above sheet) */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.back()}
            style={styles.floatingBackButton}
          >
            <Ionicons name="arrow-back" size={22} color="#0F172A" />
          </TouchableOpacity>

          {/* Floating Locate Center Button (Bottom-Right above sheet) */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => {
              if (currentLocation) {
                setPickupLocation({ lat: currentLocation.latitude, lng: currentLocation.longitude });
              }
            }}
            style={styles.floatingLocateButton}
          >
            <MaterialCommunityIcons name="crosshairs-gps" size={22} color="#0F172A" />
          </TouchableOpacity>
        </View>

        {/* ── 2. Bottom Sheet Card (White curved panel matching Screenshot 1) ── */}
        <Animated.View
          style={[
            styles.bottomSheet,
            { transform: [{ translateY: sheetTranslate }] },
          ]}
        >
          {/* Top Handle */}
          <View style={styles.sheetHandle} />

          {/* Location Details Container */}
          <View style={styles.locationContainer}>
            {/* Pickup Row */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setShowSearchModal(true)}
              style={styles.locationRow}
            >
              <MaterialCommunityIcons name="walk" size={22} color="#0F172A" style={styles.locationIcon} />
              <Text style={styles.locationAddressText} numberOfLines={1}>
                {pickupAddress}
              </Text>
            </TouchableOpacity>

            <View style={styles.locationSeparator} />

            {/* Dropoff Row */}
            <View style={styles.locationRow}>
              <MaterialCommunityIcons name="flag-checkered" size={20} color="#0F172A" style={styles.locationIcon} />
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setShowSearchModal(true)}
                style={{ flex: 1 }}
              >
                <Text style={styles.locationAddressText} numberOfLines={1}>
                  {dropoffAddress}
                  <Text style={styles.durationMutedText}> • {etaMinutes + 7} min</Text>
                </Text>
              </TouchableOpacity>

              {/* Stops button on the right */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => Alert.alert("Multi-stop Trip", "Add additional dropoff stops.")}
                style={styles.stopsButton}
              >
                <Text style={styles.stopsButtonText}>Stops</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Category Switcher Tabs (Taxi Hauling | Motorbike Hauling | Delivery) */}
          <View style={styles.categoryTabsRow}>
            <TouchableOpacity
              onPress={() => {
                setCategoryTab("taxi");
                setSelectedTier("economy");
              }}
              style={[
                styles.categoryTab,
                categoryTab === "taxi" && styles.categoryTabActive,
              ]}
            >
              <Text
                style={[
                  styles.categoryTabText,
                  categoryTab === "taxi" && styles.categoryTabTextActive,
                ]}
              >
                Taxi Hauling
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setCategoryTab("moto");
                setSelectedTier("moto_std");
              }}
              style={[
                styles.categoryTab,
                categoryTab === "moto" && styles.categoryTabActive,
              ]}
            >
              <Text
                style={[
                  styles.categoryTabText,
                  categoryTab === "moto" && styles.categoryTabTextActive,
                ]}
              >
                Motorbike Hauling
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setCategoryTab("delivery");
                setSelectedTier("del_moto");
              }}
              style={[
                styles.categoryTab,
                categoryTab === "delivery" && styles.categoryTabActive,
              ]}
            >
              <Text
                style={[
                  styles.categoryTabText,
                  categoryTab === "delivery" && styles.categoryTabTextActive,
                ]}
              >
                Delivery
              </Text>
            </TouchableOpacity>
          </View>

          {/* Ride Tier Selector Cards */}
          <RideTierSelector
            selectedTier={selectedTier}
            onSelectTier={setSelectedTier}
            baseFare={farePreview?.total ?? 33}
            etaMinutes={etaMinutes}
            serviceType={categoryTab}
          />


          {/* Payment Method Selector Row */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push("/payment" as never)}
            style={styles.paymentMethodRow}
          >
            <Text style={styles.paymentMethodText}>Add a card for one-tap payments</Text>
            <View style={styles.paymentRightIcons}>
              <MaterialCommunityIcons name="credit-card-outline" size={20} color="#0F172A" />
              <Ionicons name="chevron-forward" size={18} color="#64748B" />
            </View>
          </TouchableOpacity>

          {/* Bottom Action Row: Cash Button | Request Button | Options Button */}
          <View style={styles.actionRow}>
            {/* Cash Icon Quick Toggle Button */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                setPaymentMethod((prev) => (prev === "cash" ? "momo" : "cash"));
                Alert.alert("Payment", "Toggled to Cash on Arrival");
              }}
              style={styles.cashButton}
            >
              <MaterialCommunityIcons name="cash" size={26} color="#16A34A" />
            </TouchableOpacity>

            {/* Prominent Red "Request" Button */}
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={handleRequestRide}
              disabled={isRequesting}
              style={styles.requestButton}
            >
              <Text style={styles.requestButtonText}>
                {isRequesting ? "Connecting..." : "Request"}
              </Text>
            </TouchableOpacity>

            {/* Options / Preferences Slider Button */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => Alert.alert("Trip Preferences", "Customize AC, Child Seat, or Luggage options.")}
              style={styles.optionsButton}
            >
              <MaterialCommunityIcons name="tune-variant" size={24} color="#0F172A" />
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: "relative",
  },
  mapWrapper: {
    flex: 1,
    position: "relative",
  },
  map: {
    flex: 1,
  },
  topTransportPill: {
    position: "absolute",
    top: 50,
    left: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 6,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
    gap: 8,
  },
  transportActiveIcon: {
    padding: 2,
  },
  transportDividerYellow: {
    width: 14,
    height: 3,
    backgroundColor: "#FBBF24",
    borderRadius: 2,
  },
  transportBadgeYellow: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#F59E0B",
    alignItems: "center",
    justifyContent: "center",
  },
  transportBadgeText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  transportWalkIcon: {
    padding: 2,
  },
  mapArrivalOverlay: {
    position: "absolute",
    left: 20,
    top: "38%",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  mapArrivalText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0F172A",
  },
  mapEtaBadge: {
    position: "absolute",
    right: 70,
    top: "22%",
    backgroundColor: "#EF4444",
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  mapEtaNumber: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 18,
  },
  mapEtaUnit: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "700",
    lineHeight: 10,
  },
  floatingBackButton: {
    position: "absolute",
    left: 16,
    bottom: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  floatingLocateButton: {
    position: "absolute",
    right: 16,
    bottom: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  bottomSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 8,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: "#CBD5E1",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 12,
  },
  locationContainer: {
    marginBottom: 10,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
  },
  locationIcon: {
    marginRight: 10,
  },
  locationAddressText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
    flex: 1,
  },
  durationMutedText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#64748B",
  },
  locationSeparator: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginLeft: 32,
    marginVertical: 4,
  },
  stopsButton: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  stopsButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0F172A",
  },
  categoryTabsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginVertical: 6,
  },
  categoryTab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
  },
  categoryTabActive: {
    backgroundColor: "#F1F5F9",
  },
  categoryTabText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
  },
  categoryTabTextActive: {
    color: "#0F172A",
    fontWeight: "800",
  },
  paymentMethodRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  paymentMethodText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
  },
  paymentRightIcons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 10,
  },
  cashButton: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#F0FDF4",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#DCFCE7",
  },
  requestButton: {
    flex: 1,
    height: 52,
    borderRadius: 18,
    backgroundColor: "#EF4444", // Vibrant Yango Red
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#EF4444",
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
  },
  requestButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
  optionsButton: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
});
