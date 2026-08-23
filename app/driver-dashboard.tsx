import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Linking, ScrollView, Text, TextInput, TouchableOpacity, View, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "@/components/screen-container";
import { RideMap } from "@/components/maps/RideMap";
import { DriverNavBar } from "@/components/navigation/DriverNavBar";
import { AppBadge } from "@/components/ui/app-badge";
import { AppButton } from "@/components/ui/app-button";
import { AppCard } from "@/components/ui/app-card";
import { APP_LABEL, IS_DRIVER_APP } from "@/constants/app-variant";
import { radii, shadows } from "@/constants/design-system";
import { useBrandTheme } from "@/hooks/use-brand-theme";
import { useLocationTracking } from "@/hooks/use-location-tracking";
import { useVoiceInstructor } from "@/hooks/use-voice-instructor";
import { getDriverProfile as getLocalDriverProfile } from "@/lib/db-service";
import {
  acceptDriverRequest,
  completeTrip,
  declineDriverRequest,
  driverArrived,
  getDriverDashboard,
  getDriverRequests,
  startTrip,
  updateDriverLocation,
  updateDriverStatus,
} from "@/lib/ride-hailing-api";
import { getTripRouteColor } from "@/lib/trip-route-style";
import { useAppStore } from "@/lib/store";
import { trpc } from "@/lib/trpc";
import type { DriverProfileRecord, DriverStatusRecord, TripRecord } from "@shared/ride-hailing";

const DEFAULT_LUSAKA_COORDS = { latitude: -15.4162, longitude: 28.3115 };

type DriverDashboardState = {
  status: (DriverStatusRecord & { dailyEarnings?: number }) | null;
  pendingRequests: Array<{
    id: string;
    tripId: string;
    distanceKm?: number;
    estimatedFare?: number;
    currency?: string;
    riderName?: string;
    riderRating?: number;
    pickupAddress?: string;
    dropoffAddress?: string;
    tripDistanceKm?: number;
    tripDurationSeconds?: number;
    rideType?: string;
    paymentMethod?: string;
  }>;
  activeTrips: TripRecord[];
  profile: DriverProfileRecord | null;
};

export default function DriverDashboardScreen() {
  const router = useRouter();
  const brand = useBrandTheme();
  const trpcUtils = trpc.useUtils();
  const { currentUser, setCurrentUser, currentLocation, setCurrentLocation } = useAppStore();
  const { isTracking } = useLocationTracking();

  const [isOnline, setIsOnline] = useState(false);
  const [dashboardData, setDashboardData] = useState<DriverDashboardState | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [passengerPin, setPassengerPin] = useState("");
  const [syncErrorMessage, setSyncErrorMessage] = useState<string | null>(null);
  const [currentLocationAddress, setCurrentLocationAddress] = useState<string>("Resolving location...");
  const [dispatchRadiusKm, setDispatchRadiusKm] = useState<number>(5);

  // Reverse geocode driver's current position
  useEffect(() => {
    let cancelled = false;
    const resolve = async () => {
      const coords = currentLocation ?? DEFAULT_LUSAKA_COORDS;
      try {
        const res = await trpcUtils.maps.reverseGeocode.fetch({
          lat: coords.latitude,
          lng: coords.longitude,
        });
        if (!cancelled) {
          setCurrentLocationAddress(res.address || `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`);
        }
      } catch {
        if (!cancelled) {
          setCurrentLocationAddress(`${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`);
        }
      }
    };
    void resolve();
    return () => {
      cancelled = true;
    };
  }, [currentLocation, trpcUtils]);

  // Auto-initialize demo driver session if opening driver app directly
  useEffect(() => {
    if (!currentUser) {
      setCurrentUser({
        id: 2001001,
        openId: "2001001",
        name: "Freeohn Driver",
        email: "driver@freeohn.com",
        loginMethod: "phone",
        role: "driver",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      } as any);
    }
  }, [currentUser, setCurrentUser]);

  // Load Dashboard Data
  const refreshDashboard = useCallback(async () => {
    try {
      const data = await getDriverDashboard();
      setDashboardData(data);
      setIsOnline(Boolean(data?.status?.isOnline));
      setSyncErrorMessage(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unable to sync driver status";
      setSyncErrorMessage(msg);
    }
  }, []);

  useEffect(() => {
    if (!IS_DRIVER_APP) {
      Alert.alert("Unavailable", "Driver dispatch is only available in the Driver app.", [
        { text: "OK", onPress: () => router.back() },
      ]);
      return;
    }
    void refreshDashboard();
    const interval = setInterval(() => {
      void refreshDashboard();
    }, 5000);
    return () => clearInterval(interval);
  }, [refreshDashboard, router]);

  // Poll for incoming requests when online
  const pollRequests = useCallback(async () => {
    if (!isOnline) return;
    try {
      const res = await getDriverRequests();

      setDashboardData((prev) => ({
        ...(prev ?? {
          status: null,
          pendingRequests: [],
          activeTrips: [],
          profile: null,
        }),
        pendingRequests: res.requests ?? [],
      }));
    } catch {
      // Ignore background polling errors
    }
  }, [currentUser, isOnline]);

  useEffect(() => {
    if (!isOnline) return;
    const interval = setInterval(() => {
      void pollRequests();
    }, 2000);
    void pollRequests();
    return () => clearInterval(interval);
  }, [isOnline, pollRequests]);

  const pendingRequest = dashboardData?.pendingRequests?.[0] ?? null;
  const activeTrip = useMemo(() => dashboardData?.activeTrips?.[0] ?? null, [dashboardData?.activeTrips]);
  const driverProfile = dashboardData?.profile ?? null;

  useVoiceInstructor({
    tripState: activeTrip?.state ?? null,
    hasNewRequest: !!pendingRequest,
  });

  const remainingCredits = useMemo(() => {
    if (!driverProfile?.commercial) return 0;
    const purchased = driverProfile.commercial.ridesPurchased ?? 0;
    const completed = driverProfile.commercial.ridesCompleted ?? 0;
    return Math.max(0, purchased - completed);
  }, [driverProfile?.commercial]);

  // Active Trip Coordinates & Route
  const tripPickupCoord = useMemo(() => {
    if (!activeTrip && !pendingRequest) return undefined;
    const t = activeTrip ?? pendingRequest;
    const lat = Number((t as any)?.pickup?.lat ?? (t as any)?.pickupLat);
    const lng = Number((t as any)?.pickup?.lng ?? (t as any)?.pickupLng);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : undefined;
  }, [activeTrip, pendingRequest]);

  const tripDropoffCoord = useMemo(() => {
    if (!activeTrip) return undefined;
    const lat = Number(activeTrip.dropoff?.lat ?? (activeTrip as any).dropoffLat);
    const lng = Number(activeTrip.dropoff?.lng ?? (activeTrip as any).dropoffLng);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : undefined;
  }, [activeTrip]);

  const { data: routeData } = trpc.maps.computeRoute.useQuery(
    {
      origin: tripPickupCoord!,
      destination: tripDropoffCoord!,
      travelMode: "DRIVE",
    },
    {
      enabled: !!activeTrip && !!tripPickupCoord && !!tripDropoffCoord,
    },
  );

  const routeColor = useMemo(() => getTripRouteColor(activeTrip?.state, brand), [activeTrip?.state, brand]);

  // Driver Location Marker
  const driverMarker = useMemo(() => {
    if (currentLocation) {
      return { lat: currentLocation.latitude, lng: currentLocation.longitude };
    }
    return { lat: DEFAULT_LUSAKA_COORDS.latitude, lng: DEFAULT_LUSAKA_COORDS.longitude };
  }, [currentLocation]);

  // Toggle Online/Offline Status
  const handleToggleOnline = async () => {
    try {
      setIsUpdatingStatus(true);
      const nextOnline = !isOnline;
      const coords = currentLocation ?? DEFAULT_LUSAKA_COORDS;

      await updateDriverStatus({
        isOnline: nextOnline,
        ...(nextOnline ? { lat: coords.latitude, lng: coords.longitude } : {}),
      });

      setIsOnline(nextOnline);
      await refreshDashboard();
      if (nextOnline) {
        void pollRequests();
      }
    } catch (err) {
      Alert.alert("Status update failed", err instanceof Error ? err.message : "Try again");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Relocate Driver Coordinates (e.g. for testing or moving to a high-demand hub)
  const handleSetDriverLocation = async (coords: { latitude: number; longitude: number }, name: string) => {
    try {
      setCurrentLocation(coords);
      setCurrentLocationAddress(name);
      await updateDriverLocation({
        lat: coords.latitude,
        lng: coords.longitude,
      });
      if (isOnline) {
        await updateDriverStatus({
          isOnline: true,
          lat: coords.latitude,
          lng: coords.longitude,
        });
      }
      await refreshDashboard();
    } catch (err) {
      console.warn("Failed to set driver location:", err);
    }
  };

  // Trip Actions
  const handleAcceptRequest = async (offerId: string) => {
    try {
      await acceptDriverRequest(offerId);
      await refreshDashboard();
      Alert.alert("Ride Accepted", "Navigate towards the passenger pickup location.");
    } catch (err) {
      Alert.alert("Accept Failed", err instanceof Error ? err.message : "Try again");
    }
  };

  const handleDeclineRequest = async (offerId: string) => {
    try {
      await declineDriverRequest(offerId);
      await refreshDashboard();
    } catch (err) {
      Alert.alert("Decline Failed", err instanceof Error ? err.message : "Try again");
    }
  };

  const isAssigned = activeTrip?.state === "DRIVER_ASSIGNED";
  const isArriving = activeTrip?.state === "DRIVER_ARRIVING" || activeTrip?.state === "PIN_VERIFICATION";
  const isInProgress = activeTrip?.state === "IN_PROGRESS";

  return (
    <ScreenContainer className="bg-background" containerClassName="bg-background">
      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
          <View style={{ gap: 14, paddingHorizontal: 16, paddingTop: 14 }}>
            
            {/* Top Navigation & Status Bar */}
            <View
              style={[
                styles.headerCard,
                {
                  backgroundColor: "#0A1B3F",
                  borderColor: isOnline ? "#22C55E" : "#334155",
                },
              ]}
            >
              <View style={styles.headerTopRow}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={styles.driverAvatar}>
                    <Text style={styles.avatarText}>
                      {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : "D"}
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.driverName}>{currentUser?.name || "Freeohn Driver"}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                      <Ionicons name="shield-checkmark" size={13} color="#22C55E" />
                      <Text style={{ fontSize: 11, fontWeight: "700", color: "#86EFAC" }}>VERIFIED DRIVER</Text>
                    </View>
                  </View>
                </View>

                {/* Online / Offline Status Indicator Pill */}
                <View
                  style={[
                    styles.statusPill,
                    {
                      backgroundColor: isOnline ? "rgba(34, 197, 94, 0.18)" : "rgba(239, 68, 68, 0.18)",
                      borderColor: isOnline ? "#22C55E" : "#EF4444",
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.statusDot,
                      {
                        backgroundColor: isOnline ? "#22C55E" : "#EF4444",
                      },
                    ]}
                  />
                  <Text
                    style={[
                      styles.statusPillText,
                      {
                        color: isOnline ? "#4ADE80" : "#FCA5A5",
                      },
                    ]}
                  >
                    {isOnline ? "ONLINE" : "OFFLINE"}
                  </Text>
                </View>
              </View>

              {/* Earnings Quick Counter */}
              <View style={styles.headerStatsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>Today&apos;s Earnings</Text>
                  <Text style={styles.statValue}>K{(dashboardData?.status?.dailyEarnings ?? 0).toFixed(0)}</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>Completed Trips</Text>
                  <Text style={styles.statValue}>{driverProfile?.totalTrips ?? 0}</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>Ride Credits</Text>
                  <Text style={styles.statValue}>{remainingCredits}</Text>
                </View>
              </View>
            </View>

            {/* Tactile Go Online / Go Offline Master Glow Button */}
            <TouchableOpacity
              onPress={() => void handleToggleOnline()}
              disabled={isUpdatingStatus}
              activeOpacity={0.8}
              style={[
                styles.powerButton,
                {
                  backgroundColor: isOnline ? "#DC2626" : "#16A34A",
                  shadowColor: isOnline ? "#DC2626" : "#16A34A",
                },
              ]}
            >
              {isUpdatingStatus ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name={isOnline ? "power" : "radio"} size={24} color="#FFFFFF" />
              )}
              <Text style={styles.powerButtonText}>
                {isUpdatingStatus ? "UPDATING RADAR..." : isOnline ? "GO OFFLINE" : "⚡ GO ONLINE"}
              </Text>
            </TouchableOpacity>

            {/* Interactive Hero Radar Map */}
            <View style={[styles.mapContainer, { borderColor: brand.border }]}>
              <RideMap
                userLocation={driverMarker}
                pickupLocation={tripPickupCoord}
                dropoffLocation={tripDropoffCoord}
                routePolyline={routeData?.encodedPolyline}
                routeColor={routeColor}
                showControls={true}
                initialStyle="streets"
                style={{ height: 320 }}
              />
              <View style={[styles.locationFooter, { backgroundColor: brand.surface, flexDirection: "column", alignItems: "stretch", gap: 8 }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Ionicons name="navigate" size={14} color={brand.primary} />
                  <Text style={[styles.locationFooterText, { color: brand.textMuted }]} numberOfLines={1}>
                    {currentLocationAddress}
                  </Text>
                </View>

                {/* Quick Relocation Hub Presets for Testing */}
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, paddingTop: 4 }}>
                  <TouchableOpacity
                    onPress={() => handleSetDriverLocation({ latitude: -15.3897, longitude: 28.3237 }, "East Park Mall, Lusaka")}
                    style={[styles.relocatePill, { backgroundColor: brand.primary + "15", borderColor: brand.primary + "40" }]}
                  >
                    <Ionicons name="location" size={12} color={brand.primary} />
                    <Text style={[styles.relocatePillText, { color: brand.primary }]}>East Park (Lusaka)</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleSetDriverLocation({ latitude: -15.4162, longitude: 28.3115 }, "Lusaka Central Hub")}
                    style={[styles.relocatePill, { backgroundColor: brand.primary + "15", borderColor: brand.primary + "40" }]}
                  >
                    <Ionicons name="business" size={12} color={brand.primary} />
                    <Text style={[styles.relocatePillText, { color: brand.primary }]}>Lusaka CBD</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleSetDriverLocation({ latitude: -15.3305, longitude: 28.4529 }, "KK Int'l Airport, Lusaka")}
                    style={[styles.relocatePill, { backgroundColor: brand.primary + "15", borderColor: brand.primary + "40" }]}
                  >
                    <Ionicons name="airplane" size={12} color={brand.primary} />
                    <Text style={[styles.relocatePillText, { color: brand.primary }]}>Airport</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Service Radius Filter Selector */}
            <View style={[styles.radiusCard, { backgroundColor: brand.surface, borderColor: brand.border }]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Ionicons name="compass-outline" size={16} color={brand.primary} />
                  <Text style={[styles.radiusTitle, { color: brand.text }]}>Dispatch Target Radius</Text>
                </View>
                <Text style={{ fontSize: 13, fontWeight: "800", color: brand.primary }}>{dispatchRadiusKm} km</Text>
              </View>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                {[2, 5, 10, 20].map((radius) => (
                  <TouchableOpacity
                    key={radius}
                    onPress={() => setDispatchRadiusKm(radius)}
                    style={[
                      styles.radiusPill,
                      {
                        backgroundColor: dispatchRadiusKm === radius ? brand.primary : brand.surfaceMuted,
                        borderColor: dispatchRadiusKm === radius ? brand.primary : brand.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.radiusPillText,
                        {
                          color: dispatchRadiusKm === radius ? "#FFFFFF" : brand.text,
                          fontWeight: dispatchRadiusKm === radius ? "800" : "600",
                        },
                      ]}
                    >
                      {radius} km
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Incoming Ride Request Modal Card */}
            {pendingRequest && (
              <View style={[styles.incomingCard, { backgroundColor: "#FFF7ED", borderColor: "#F97316" }]}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View style={styles.pulsingBadge}>
                      <Ionicons name="notifications" size={16} color="#EA580C" />
                    </View>
                    <Text style={{ fontSize: 16, fontWeight: "800", color: "#9A3412" }}>Incoming Ride Offer</Text>
                  </View>
                  <AppBadge
                    label={`${pendingRequest.currency || "ZMW"} ${(pendingRequest.estimatedFare ?? 0).toFixed(2)}`}
                    tone="primary"
                  />
                </View>

                {/* Passenger Info & Rating */}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: "#FED7AA" }}>
                  <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "#FFEDD5", alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="person" size={20} color="#EA580C" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: "800", color: brand.text }}>
                      {pendingRequest.riderName || "Passenger"}
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                      <Ionicons name="star" size={13} color="#F59E0B" />
                      <Text style={{ fontSize: 12, fontWeight: "700", color: brand.text }}>
                        {(pendingRequest.riderRating ?? 5.0).toFixed(1)}
                      </Text>
                      <Text style={{ fontSize: 11, color: brand.textMuted }}>•</Text>
                      <Text style={{ fontSize: 12, color: brand.textMuted, textTransform: "capitalize" }}>
                        {pendingRequest.rideType || "Standard"} • {pendingRequest.paymentMethod || "Cash"}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Route: Pickup & Destination */}
                <View style={{ marginTop: 10, gap: 6 }}>
                  <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                    <Ionicons name="radio-button-on" size={16} color="#16A34A" style={{ marginTop: 2 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, fontWeight: "800", color: "#16A34A" }}>PICKUP</Text>
                      <Text style={{ fontSize: 13, fontWeight: "600", color: brand.text }} numberOfLines={2}>
                        {pendingRequest.pickupAddress || "Passenger pickup point"}
                      </Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                    <Ionicons name="location" size={16} color="#EA580C" style={{ marginTop: 2 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, fontWeight: "800", color: "#EA580C" }}>DESTINATION</Text>
                      <Text style={{ fontSize: 13, fontWeight: "600", color: brand.text }} numberOfLines={2}>
                        {pendingRequest.dropoffAddress || "Passenger destination"}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Trip Distance & Approach Distance */}
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 12, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: "#FFFFFF", borderRadius: 10, borderWidth: 1, borderColor: "#FED7AA" }}>
                  <View>
                    <Text style={{ fontSize: 10, color: brand.textMuted, fontWeight: "600" }}>APPROACH DISTANCE</Text>
                    <Text style={{ fontSize: 13, fontWeight: "800", color: brand.text }}>
                      {(pendingRequest.distanceKm ?? 1.2).toFixed(1)} km to pickup
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={{ fontSize: 10, color: brand.textMuted, fontWeight: "600" }}>TOTAL TRIP DISTANCE</Text>
                    <Text style={{ fontSize: 13, fontWeight: "800", color: brand.text }}>
                      {pendingRequest.tripDistanceKm ? `${pendingRequest.tripDistanceKm.toFixed(1)} km` : "Direct Route"}
                    </Text>
                  </View>
                </View>

                {/* Action Buttons */}
                <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
                  <TouchableOpacity
                    onPress={() => void handleAcceptRequest(pendingRequest.id)}
                    style={[styles.actionBtn, { backgroundColor: "#16A34A", flex: 1.4 }]}
                  >
                    <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                    <Text style={styles.actionBtnText}>ACCEPT RIDE</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => void handleDeclineRequest(pendingRequest.id)}
                    style={[styles.actionBtn, { backgroundColor: "#F1F5F9", borderWidth: 1, borderColor: "#CBD5E1", flex: 1 }]}
                  >
                    <Text style={[styles.actionBtnText, { color: "#64748B" }]}>DECLINE</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Active Trip Navigation HUD */}
            {activeTrip && (
              <View
                style={[
                  styles.incomingCard,
                  {
                    backgroundColor: brand.surface,
                    borderColor: brand.primary,
                    borderWidth: 2,
                  },
                ]}
              >
                {/* Header Status & Fare */}
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <View style={[styles.statusDot, { backgroundColor: isAssigned ? "#3B82F6" : isArriving ? "#F97316" : "#16A34A" }]} />
                    <Text style={{ fontSize: 16, fontWeight: "900", color: brand.text }}>
                      {isAssigned ? "Head to Pickup" : isArriving ? "Passenger Pickup" : "Trip in Progress"}
                    </Text>
                  </View>
                  <AppBadge
                    label={`${activeTrip.fare?.currency || "ZMW"} ${(activeTrip.fare?.total ?? 0).toFixed(2)}`}
                    tone="primary"
                  />
                </View>

                {/* Ride Seeker Profile & Direct Communication Bar */}
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: brand.surfaceMuted, borderRadius: 14 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                    <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#DBEAFE", alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name="person" size={24} color="#1D4ED8" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: "800", color: brand.text }} numberOfLines={1}>
                        {(activeTrip as any).riderName || "Service Seeker"}
                      </Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                        <Ionicons name="star" size={13} color="#F59E0B" />
                        <Text style={{ fontSize: 12, fontWeight: "700", color: brand.text }}>
                          {((activeTrip as any).riderRating ?? 5.0).toFixed(1)}
                        </Text>
                        <Text style={{ fontSize: 11, color: brand.textMuted }}>•</Text>
                        <Text style={{ fontSize: 11, color: brand.textMuted, fontWeight: "600" }}>
                          {activeTrip.paymentMethod || "CASH"}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Call & Chat Action Icons */}
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TouchableOpacity
                      onPress={() => {
                        const phone = (activeTrip as any).riderPhone || "+260971000001";
                        void Linking.openURL(`tel:${phone}`);
                      }}
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 21,
                        backgroundColor: "#FFF7ED",
                        borderWidth: 1,
                        borderColor: "#FED7AA",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="call" size={20} color="#EA580C" />
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => {
                        router.push("/(tabs)/chat" as never);
                      }}
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 21,
                        backgroundColor: "#EFF6FF",
                        borderWidth: 1,
                        borderColor: "#BFDBFE",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="chatbubble-ellipses" size={20} color="#2563EB" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Route Points */}
                <View style={{ marginTop: 12, gap: 8 }}>
                  <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                    <Ionicons name="radio-button-on" size={16} color="#16A34A" style={{ marginTop: 2 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, fontWeight: "800", color: "#16A34A" }}>PICKUP</Text>
                      <Text style={{ fontSize: 13, fontWeight: "600", color: brand.text }} numberOfLines={2}>
                        {activeTrip.pickup?.address || "Passenger pickup point"}
                      </Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                    <Ionicons name="location" size={16} color="#EA580C" style={{ marginTop: 2 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, fontWeight: "800", color: "#EA580C" }}>DESTINATION</Text>
                      <Text style={{ fontSize: 13, fontWeight: "600", color: brand.text }} numberOfLines={2}>
                        {activeTrip.dropoff?.address || "Passenger destination"}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Distance & Trip Specs Banner */}
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 12, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: brand.surfaceMuted, borderRadius: 10 }}>
                  <View>
                    <Text style={{ fontSize: 10, color: brand.textMuted, fontWeight: "600" }}>TOTAL DISTANCE</Text>
                    <Text style={{ fontSize: 13, fontWeight: "800", color: brand.text }}>
                      {activeTrip.fare?.distanceMeters ? `${(activeTrip.fare.distanceMeters / 1000).toFixed(1)} km` : "In Transit"}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={{ fontSize: 10, color: brand.textMuted, fontWeight: "600" }}>RIDE TYPE</Text>
                    <Text style={{ fontSize: 13, fontWeight: "800", color: brand.text, textTransform: "capitalize" }}>
                      {activeTrip.fare?.rideType || "Standard"}
                    </Text>
                  </View>
                </View>

                {/* PIN Verification Input */}
                {activeTrip.state === "PIN_VERIFICATION" && (
                  <View style={{ marginTop: 12, padding: 12, backgroundColor: "#FEF08A", borderRadius: 12 }}>
                    <Text style={{ fontSize: 13, fontWeight: "800", color: "#854D0E", marginBottom: 6 }}>
                      Ask passenger for their 4-digit PIN:
                    </Text>
                    <TextInput
                      placeholder="e.g. 1234"
                      value={passengerPin}
                      onChangeText={setPassengerPin}
                      keyboardType="numeric"
                      maxLength={4}
                      style={[styles.pinInput, { backgroundColor: "#FFFFFF", borderColor: "#EAB308", color: "#000000" }]}
                    />
                  </View>
                )}

                {/* Progression Action Button */}
                <View style={{ marginTop: 14 }}>
                  {isAssigned && (
                    <AppButton
                      label="📍 Arrived at Pickup"
                      variant="secondary"
                      loading={activeAction === "arrived"}
                      onPress={async () => {
                        try {
                          setActiveAction("arrived");
                          await driverArrived(activeTrip.id);
                          await refreshDashboard();
                        } catch (err) {
                          Alert.alert("Arrived failed", err instanceof Error ? err.message : "Try again");
                        } finally {
                          setActiveAction(null);
                        }
                      }}
                    />
                  )}

                  {isArriving && (
                    <AppButton
                      label="▶️ Start Trip"
                      variant="primary"
                      loading={activeAction === "start"}
                      onPress={async () => {
                        try {
                          setActiveAction("start");
                          await startTrip(activeTrip.id, { pin: passengerPin.trim() || undefined });
                          await refreshDashboard();
                          setPassengerPin("");
                        } catch (err) {
                          Alert.alert("Start failed", err instanceof Error ? err.message : "Try again");
                        } finally {
                          setActiveAction(null);
                        }
                      }}
                    />
                  )}

                  {isInProgress && (
                    <AppButton
                      label={`🏁 Complete Trip & Collect K${(activeTrip.fare?.total ?? 0).toFixed(0)}`}
                      variant="success"
                      loading={activeAction === "complete"}
                      onPress={async () => {
                        try {
                          setActiveAction("complete");
                          await completeTrip(activeTrip.id);
                          await refreshDashboard();
                          Alert.alert("Trip Completed!", `Fare of K${(activeTrip.fare?.total ?? 0).toFixed(0)} added to daily wallet.`);
                        } catch (err) {
                          Alert.alert("Complete failed", err instanceof Error ? err.message : "Try again");
                        } finally {
                          setActiveAction(null);
                        }
                      }}
                    />
                  )}
                </View>
              </View>
            )}

            {/* Quick Navigation Cards */}
            <View style={{ flexDirection: "row", gap: 12 }}>
              <TouchableOpacity
                onPress={() => router.push("/driver-earnings")}
                style={[styles.quickCard, { backgroundColor: brand.surface, borderColor: brand.border }]}
                activeOpacity={0.7}
              >
                <View style={[styles.quickIconWrap, { backgroundColor: "#EFF6FF" }]}>
                  <Ionicons name="wallet" size={20} color="#2563EB" />
                </View>
                <Text style={[styles.quickTitle, { color: brand.text }]}>Earnings</Text>
                <Text style={styles.quickSub}>Daily & Weekly</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.push("/driver-profile")}
                style={[styles.quickCard, { backgroundColor: brand.surface, borderColor: brand.border }]}
                activeOpacity={0.7}
              >
                <View style={[styles.quickIconWrap, { backgroundColor: "#F0FDF4" }]}>
                  <Ionicons name="shield-checkmark" size={20} color="#16A34A" />
                </View>
                <Text style={[styles.quickTitle, { color: brand.text }]}>Profile</Text>
                <Text style={styles.quickSub}>Vehicle & Documents</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.push("/ride-history")}
                style={[styles.quickCard, { backgroundColor: brand.surface, borderColor: brand.border }]}
                activeOpacity={0.7}
              >
                <View style={[styles.quickIconWrap, { backgroundColor: "#FFF7ED" }]}>
                  <Ionicons name="time" size={20} color="#EA580C" />
                </View>
                <Text style={[styles.quickTitle, { color: brand.text }]}>Trips</Text>
                <Text style={styles.quickSub}>Activity Logs</Text>
              </TouchableOpacity>
            </View>

          </View>
        </ScrollView>

        {/* Reusable Bottom Navigation Bar */}
        <DriverNavBar />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerCard: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    ...shadows.md,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  driverAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#3B82F6",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
  },
  driverName: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  headerStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.12)",
  },
  statBox: {
    flex: 1,
    alignItems: "center",
  },
  statLabel: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "600",
  },
  statValue: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
  powerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 18,
    ...shadows.lg,
    elevation: 8,
  },
  powerButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  mapContainer: {
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    ...shadows.md,
  },
  locationFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  locationFooterText: {
    fontSize: 12,
    fontWeight: "500",
    flex: 1,
  },
  radiusCard: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    ...shadows.sm,
  },
  radiusTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  radiusPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  radiusPillText: {
    fontSize: 12,
  },
  relocatePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  relocatePillText: {
    fontSize: 11,
    fontWeight: "700",
  },
  incomingCard: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1.5,
    ...shadows.md,
  },
  pulsingBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#FFEDD5",
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 13,
    borderRadius: 12,
  },
  actionBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  pinInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: 4,
  },
  quickCard: {
    flex: 1,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    alignItems: "center",
    ...shadows.sm,
  },
  quickIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  quickTitle: {
    fontSize: 12,
    fontWeight: "800",
  },
  quickSub: {
    fontSize: 10,
    color: "#94A3B8",
    marginTop: 2,
  },
});
