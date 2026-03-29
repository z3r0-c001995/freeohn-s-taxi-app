import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Linking, Platform, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";

import { ScreenContainer } from "@/components/screen-container";
import { RideMap } from "@/components/maps/RideMap";
import { AppBadge } from "@/components/ui/app-badge";
import { AppButton } from "@/components/ui/app-button";
import { AppCard } from "@/components/ui/app-card";
import { AppInput } from "@/components/ui/app-input";
import { APP_LABEL, IS_DRIVER_APP } from "@/constants/app-variant";
import { radii, shadows } from "@/constants/design-system";
import { useBrandTheme } from "@/hooks/use-brand-theme";
import { useLocationTracking } from "@/hooks/use-location-tracking";
import { useVoiceInstructor } from "@/hooks/use-voice-instructor";
import { useAppStore } from "@/lib/store";
import { trpc } from "@/lib/trpc";
import { getTripRouteColor } from "@/lib/trip-route-style";
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
import {
  acceptRide as acceptLocalRide,
  completeRide as completeLocalRide,
  getAvailableRides,
  getActiveRidesForUser,
  getDriverProfile as getLocalDriverProfile,
  getRideById as getLocalRideById,
  setDriverOnlineStatus as setLocalDriverOnlineStatus,
  startRide as startLocalRide,
} from "@/lib/db-service";

const DEFAULT_LOCATION = { latitude: -11.197, longitude: 28.891 }; // Mansa

const MANSA_HOTSPOTS = [
  { lat: -11.192, lng: 28.895, radius: 400, color: "#EF4444" },
  { lat: -11.205, lng: 28.880, radius: 600, color: "#F59E0B" },
  { lat: -11.185, lng: 28.905, radius: 500, color: "#EF4444" },
  { lat: -11.200, lng: 28.910, radius: 300, color: "#F59E0B" },
  { lat: -11.180, lng: 28.890, radius: 450, color: "#3B82F6" },
];

export default function DriverDashboardScreen() {
  const router = useRouter();
  const brand = useBrandTheme();
  const trpcUtils = trpc.useUtils();
  const { currentUser, currentLocation, setCurrentLocation, setActiveRide, persist } = useAppStore();
  const { isTracking } = useLocationTracking();

  const [isOnline, setIsOnline] = useState(false);
  const [dashboard, setDashboard] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [tripActionLoading, setTripActionLoading] = useState<"arrived" | "start" | "complete" | null>(null);
  const [startPin, setStartPin] = useState("");
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [locationLabel, setLocationLabel] = useState("Resolving location...");
  const [searchArea, setSearchArea] = useState<"current_location" | "open_zone">("current_location");
  const [searchRadius, setSearchRadius] = useState<number>(5);

  const dateLabel = useMemo(
    () =>
      new Date().toLocaleDateString([], {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
    [],
  );
  const timeLabel = useMemo(
    () =>
      new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    [],
  );

  const gpsLabel = currentLocation
    ? `${currentLocation.latitude.toFixed(5)}, ${currentLocation.longitude.toFixed(5)}`
    : "Waiting for GPS lock";

  useEffect(() => {
    let cancelled = false;
    const resolveAddress = async () => {
      const source = currentLocation ?? DEFAULT_LOCATION;
      try {
        const result = await trpcUtils.maps.reverseGeocode.fetch({
          lat: source.latitude,
          lng: source.longitude,
        });
        if (!cancelled) {
          setLocationLabel(result.address || "Current location");
        }
      } catch {
        if (!cancelled) {
          setLocationLabel("Current location");
        }
      }
    };
    void resolveAddress();
    return () => {
      cancelled = true;
    };
  }, [currentLocation, trpcUtils]);

  const loadDashboardLocal = useCallback(async () => {
    if (!currentUser) return;
    const profile = await getLocalDriverProfile(currentUser.id.toString());
    const available = await getAvailableRides();
    const localActiveTrips = await getActiveRidesForUser(currentUser.id.toString());
    const pendingRequests = available.map((ride) => ({
      id: ride.id.toString(),
      tripId: ride.id.toString(),
      distanceKm: 0,
      estimatedFare: Number(ride.fareAmount ?? 0),
      riderName: "Service Seeker",
    }));
    const localProfile = profile
      ? {
          driverId: `local-driver-${currentUser.id}`,
          userId: currentUser.id,
          verified: false,
          rating: 5,
          totalTrips: profile.totalTrips ?? 0,
          vehicle: {
            make: profile.vehicleMake || "Vehicle",
            model: profile.vehicleModel || "",
            color: "N/A",
            plateNumber: profile.plateNumber || "N/A",
          },
          personalInfo: {
            fullName: currentUser.name || "Driver",
            phoneNumber: String((currentUser as any).openId ?? (currentUser as any).phone ?? ""),
            nrcNumber: "N/A",
            homeAddress: "N/A",
            emergencyContactName: null,
            emergencyContactPhone: null,
          },
          compliance: {
            driversLicenseNumber: profile.licenseNumber || "N/A",
            vehicleRegistrationNumber: "N/A",
            hasDriversLicense: Boolean(profile.licenseNumber),
            hasVehicleRegistrationDocument: false,
            insured: false,
            roadTaxCleared: false,
            fitnessTestPassed: false,
          },
          commercial: {
            ridesPurchased: 0,
            ridesCompleted: 0,
            notes: "Local-only profile",
          },
          documents: {
            driversLicenseDocumentRef: "",
            vehicleRegistrationDocumentRef: "",
            insuranceDocumentRef: "",
            roadTaxDocumentRef: "",
            fitnessCertificateDocumentRef: "",
          },
          audit: {
            createdAt: profile.createdAt?.toISOString?.() ?? new Date().toISOString(),
            updatedAt: profile.updatedAt?.toISOString?.() ?? new Date().toISOString(),
            createdByAdminId: null,
            updatedByAdminId: null,
            verificationReviewedAt: null,
            compliance: {
              driversLicenseCheckedAt: null,
              vehicleRegistrationCheckedAt: null,
              insuranceCheckedAt: null,
              roadTaxCheckedAt: null,
              fitnessCheckedAt: null,
            },
          },
        }
      : null;

    setDashboard({
      status: { isOnline: Boolean(profile?.isOnline), dailyEarnings: profile?.totalEarnings ?? 0 },
      pendingRequests,
      activeTrips: localActiveTrips ?? [],
      profile: localProfile,
    });
    setIsOnline(Boolean(profile?.isOnline));
  }, [currentUser]);

  const loadDashboard = useCallback(async () => {
    if (!currentUser) return;
    try {
      const result = await getDriverDashboard();
      setDashboard(result);
      setIsOnline(Boolean(result?.status?.isOnline));
      setIsOfflineMode(false);
      setDashboardError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load driver dashboard.";
      if (Platform.OS === "web") {
        setDashboardError(message);
        return;
      }
      await loadDashboardLocal();
      setIsOfflineMode(true);
      setDashboardError(message);
    }
  }, [currentUser, loadDashboardLocal]);

  useEffect(() => {
    if (!IS_DRIVER_APP) {
      Alert.alert("Unavailable", "Driver dispatch is only available in the Driver app.", [
        { text: "OK", onPress: () => router.back() },
      ]);
      return;
    }

    if (!currentUser) return;
    void loadDashboard();

    const timer = setInterval(() => {
      void loadDashboard();
    }, 5000);

    return () => clearInterval(timer);
  }, [currentUser, loadDashboard, router]);

  const refreshPendingRequests = useCallback(async () => {
    if (!currentUser || !isOnline) return;
    try {
      const requests = await getDriverRequests();
      setDashboard((prev: any) => ({
        ...(prev ?? {}),
        pendingRequests: requests.requests ?? [],
      }));
      setDashboardError(null);
    } catch {
      // Keep previous requests list; dashboard polling and heartbeat continue.
    }
  }, [currentUser, isOnline]);

  useEffect(() => {
    if (!isOnline) return;
    const timer = setInterval(() => {
      void refreshPendingRequests();
    }, 2000);
    void refreshPendingRequests();
    return () => clearInterval(timer);
  }, [isOnline, refreshPendingRequests]);

  const pendingOffer = dashboard?.pendingRequests?.[0] ?? null;
  const activeTrip = useMemo(() => dashboard?.activeTrips?.[0] ?? null, [dashboard?.activeTrips]);
  const driverProfile = dashboard?.profile ?? null;

  // Voice instructor: speaks Uber-style navigation cues at each state change
  useVoiceInstructor({
    tripState: activeTrip?.state ?? null,
    hasNewRequest: !!pendingOffer,
  });
  const ridesRemaining = useMemo(() => {
    if (!driverProfile?.commercial) return 0;
    return Math.max(0, (driverProfile.commercial.ridesPurchased ?? 0) - (driverProfile.commercial.ridesCompleted ?? 0));
  }, [driverProfile?.commercial]);

  const formatAuditTime = useCallback((value?: string | null) => {
    if (!value) return "Pending";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "Pending";
    return parsed.toLocaleString();
  }, []);

  const pickupLocation = useMemo(() => {
    if (!activeTrip && !pendingOffer) return undefined;
    const source = activeTrip ?? pendingOffer;
    const lat = Number(source?.pickup?.lat ?? source?.pickupLat);
    const lng = Number(source?.pickup?.lng ?? source?.pickupLng);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : undefined;
  }, [activeTrip, pendingOffer]);

  const dropoffLocation = useMemo(() => {
    if (!activeTrip) return undefined;
    const lat = Number(activeTrip.dropoff?.lat ?? activeTrip.dropoffLat);
    const lng = Number(activeTrip.dropoff?.lng ?? activeTrip.dropoffLng);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : undefined;
  }, [activeTrip]);

  const { data: routeData } = trpc.maps.computeRoute.useQuery(
    {
      origin: pickupLocation!,
      destination: dropoffLocation!,
      travelMode: "DRIVE",
    },
    {
      enabled: !!activeTrip && !!pickupLocation && !!dropoffLocation,
    },
  );

  const routeColor = useMemo(
    () => getTripRouteColor(activeTrip?.state, brand),
    [activeTrip?.state, brand],
  );

  const activeTripDriverMarker = useMemo(() => {
    if (!activeTrip) return undefined;

    const statusLat = Number(dashboard?.status?.lat);
    const statusLng = Number(dashboard?.status?.lng);
    if (Number.isFinite(statusLat) && Number.isFinite(statusLng)) {
      return {
        lat: statusLat,
        lng: statusLng,
      };
    }

    if (currentLocation) {
      return {
        lat: currentLocation.latitude,
        lng: currentLocation.longitude,
      };
    }

    return undefined;
  }, [activeTrip, currentLocation, dashboard?.status?.lat, dashboard?.status?.lng]);

  const mapUserLocation = useMemo(() => {
    if (activeTrip) return undefined;
    if (!currentLocation) return undefined;
    return { lat: currentLocation.latitude, lng: currentLocation.longitude };
  }, [activeTrip, currentLocation]);

  const canMarkArrived = activeTrip?.state === "DRIVER_ASSIGNED";
  const pinRequired = activeTrip?.state === "PIN_VERIFICATION";
  const canStartTrip = activeTrip?.state === "DRIVER_ARRIVING" || pinRequired;
  const canCompleteTrip = activeTrip?.state === "IN_PROGRESS";

  const toggleOnline = async () => {
    try {
      setIsLoading(true);
      const next = !isOnline;
      let sourceLocation = currentLocation ?? null;

      if (next && !sourceLocation) {
        try {
          const permission = await Location.requestForegroundPermissionsAsync();
          if (permission.status === "granted") {
            const position = await Location.getCurrentPositionAsync({});
            sourceLocation = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            };
            setCurrentLocation(sourceLocation);
          } else if (!permission.canAskAgain) {
            Alert.alert(
              "Location Permission Denied",
              "Please enable location permissions in settings to go online properly.",
              [
                { text: "Cancel", style: "cancel" },
                { text: "Open Settings", onPress: () => Linking.openSettings() }
              ]
            );
          }
        } catch {
          // keep fallback below
        }
      }

      if (next && !sourceLocation) {
        sourceLocation = DEFAULT_LOCATION;
      }
      const effectiveLocation = sourceLocation ?? DEFAULT_LOCATION;

      let usedOfflineMode = false;

      try {
        await updateDriverStatus({
          isOnline: next,
          ...(next
            ? {
                lat: effectiveLocation.latitude,
                lng: effectiveLocation.longitude,
              }
            : {}),
        });
        setIsOnline(next);
        setIsOfflineMode(false);
      } catch (error) {
        if (Platform.OS === "web") {
          throw error;
        }
        if (!currentUser) throw error;
        await setLocalDriverOnlineStatus(currentUser.id.toString(), next);
        setIsOfflineMode(true);
        usedOfflineMode = true;
      }

      await loadDashboard();
      if (next) {
        void refreshPendingRequests();
      }

      if (usedOfflineMode) {
        Alert.alert("Offline Mode", `Driver status updated locally: ${next ? "online" : "offline"}.`);
      }
    } catch (error) {
      Alert.alert("Status update failed", error instanceof Error ? error.message : "Try again");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isOnline) return;
    let cancelled = false;

    const heartbeat = async () => {
      const source = currentLocation ?? DEFAULT_LOCATION;
      try {
        await updateDriverLocation({
          lat: source.latitude,
          lng: source.longitude,
          tripId: activeTrip?.id,
        });
        if (!cancelled) {
          setIsOfflineMode(false);
        }
      } catch {
        // No-op: dashboard polling/local fallback still handles UI.
      }
    };

    void heartbeat();
    const timer = setInterval(() => {
      void heartbeat();
    }, 4000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [currentLocation, isOnline, activeTrip?.id]);

  const onAccept = async (offerId: string) => {
    try {
      try {
        await acceptDriverRequest(offerId);
        setIsOfflineMode(false);
      } catch (error) {
        if (Platform.OS === "web") throw error;
        if (!currentUser) throw error;
        await acceptLocalRide(offerId, currentUser.id.toString());
        const ride = await getLocalRideById(offerId);
        if (ride) {
          setActiveRide(ride as any);
          await persist();
        }
        setIsOfflineMode(true);
      }
      await loadDashboard();
      Alert.alert("Ride accepted", "Navigate to passenger pickup.");
    } catch (error) {
      Alert.alert("Accept failed", error instanceof Error ? error.message : "Try again");
    }
  };

  const onDecline = async (offerId: string) => {
    try {
      try {
        await declineDriverRequest(offerId);
        setIsOfflineMode(false);
      } catch (error) {
        if (Platform.OS === "web") throw error;
        setDashboard((prev: any) => ({
          ...prev,
          pendingRequests: (prev?.pendingRequests ?? []).filter((offer: any) => offer.id !== offerId),
        }));
        setIsOfflineMode(true);
      }
      await loadDashboard();
    } catch (error) {
      Alert.alert("Decline failed", error instanceof Error ? error.message : "Try again");
    }
  };

  const onArrived = async () => {
    if (!activeTrip?.id) return;
    try {
      setTripActionLoading("arrived");
      try {
        await driverArrived(activeTrip.id);
        setDashboard((prev: any) => ({
          ...(prev ?? {}),
          activeTrips: (prev?.activeTrips ?? []).map((trip: any) =>
            trip.id === activeTrip.id ? { ...trip, state: "DRIVER_ARRIVING" } : trip,
          ),
        }));
        setIsOfflineMode(false);
      } catch (error) {
        if (Platform.OS === "web") throw error;
        setIsOfflineMode(true);
      }
      await loadDashboard();
    } catch (error) {
      Alert.alert("Arrived update failed", error instanceof Error ? error.message : "Try again");
    } finally {
      setTripActionLoading(null);
    }
  };

  const onStartTrip = async () => {
    if (!activeTrip?.id) return;
    try {
      setTripActionLoading("start");
      try {
        await startTrip(activeTrip.id, { pin: startPin.trim() || undefined });
        setDashboard((prev: any) => ({
          ...(prev ?? {}),
          activeTrips: (prev?.activeTrips ?? []).map((trip: any) =>
            trip.id === activeTrip.id ? { ...trip, state: "IN_PROGRESS" } : trip,
          ),
        }));
        setIsOfflineMode(false);
      } catch (error) {
        if (Platform.OS === "web") throw error;
        await startLocalRide(activeTrip.id.toString());
        setIsOfflineMode(true);
      }
      await loadDashboard();
      setStartPin("");
    } catch (error) {
      Alert.alert("Start failed", error instanceof Error ? error.message : "Try again");
    } finally {
      setTripActionLoading(null);
    }
  };

  const onCompleteTrip = async () => {
    if (!activeTrip?.id) return;
    try {
      setTripActionLoading("complete");
      try {
        await completeTrip(activeTrip.id);
        setDashboard((prev: any) => ({
          ...(prev ?? {}),
          activeTrips: (prev?.activeTrips ?? []).filter((trip: any) => trip.id !== activeTrip.id),
        }));
        setIsOfflineMode(false);
      } catch (error) {
        if (Platform.OS === "web") throw error;
        await completeLocalRide(activeTrip.id.toString());
        setIsOfflineMode(true);
      }
      await loadDashboard();
    } catch (error) {
      Alert.alert("Complete failed", error instanceof Error ? error.message : "Try again");
    } finally {
      setTripActionLoading(null);
    }
  };

  return (
    <ScreenContainer className="bg-background" containerClassName="bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <View style={{ gap: 16, paddingBottom: 20 }}>
          <View
            style={{
              borderRadius: radii.xl,
              padding: 18,
              backgroundColor: "#0F1E4A",
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
              <AppBadge label={isOnline ? "ONLINE" : "OFFLINE"} tone={isOnline ? "success" : "warning"} />
            </View>

            <Text style={{ marginTop: 14, fontSize: 29, fontWeight: "800", color: "#FFFFFF" }}>Driver Dashboard</Text>
            <Text style={{ marginTop: 6, fontSize: 13, color: "#CBD5E1" }}>{APP_LABEL}</Text>

            <View style={{ marginTop: 12, flexDirection: "row", gap: 16 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, color: "#CBD5E1" }}>Today</Text>
                <Text style={{ marginTop: 3, fontSize: 24, fontWeight: "800", color: "#FFFFFF" }}>
                  ${(dashboard?.status?.dailyEarnings ?? 0).toFixed(2)}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, color: "#CBD5E1" }}>Requests</Text>
                <Text style={{ marginTop: 3, fontSize: 24, fontWeight: "800", color: "#FFFFFF" }}>
                  {dashboard?.pendingRequests?.length ?? 0}
                </Text>
              </View>
            </View>

            <View style={{ marginTop: 24, backgroundColor: "rgba(0,0,0,0.15)", borderRadius: radii.lg, padding: 16 }}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: "#FFFFFF", marginBottom: 12 }}>Service Area Preferences</Text>
              
              <View style={{ flexDirection: "row", gap: 10 }}>
                <TouchableOpacity
                  onPress={() => setSearchArea("current_location")}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    alignItems: "center",
                    borderRadius: radii.md,
                    backgroundColor: searchArea === "current_location" ? brand.primary : "rgba(255,255,255,0.08)",
                    borderWidth: 1,
                    borderColor: searchArea === "current_location" ? brand.primary : "transparent"
                  }}
                >
                  <Text style={{ color: "#FFF", fontSize: 13, fontWeight: searchArea === "current_location" ? "700" : "500" }}>Nearby</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setSearchArea("open_zone")}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    alignItems: "center",
                    borderRadius: radii.md,
                    backgroundColor: searchArea === "open_zone" ? brand.primary : "rgba(255,255,255,0.08)",
                    borderWidth: 1,
                    borderColor: searchArea === "open_zone" ? brand.primary : "transparent"
                  }}
                >
                  <Text style={{ color: "#FFF", fontSize: 13, fontWeight: searchArea === "open_zone" ? "700" : "500" }}>Anywhere</Text>
                </TouchableOpacity>
              </View>

              <View style={{ marginTop: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={{ color: "#CBD5E1", fontSize: 13 }}>Dispatch Target Radius</Text>
                <Text style={{ color: "#FFF", fontSize: 14, fontWeight: "700" }}>{searchRadius} km</Text>
              </View>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                {[2, 5, 10, 20].map((rad) => (
                  <TouchableOpacity
                    key={rad}
                    onPress={() => setSearchRadius(rad)}
                    style={{
                      flex: 1,
                      paddingVertical: 8,
                      alignItems: "center",
                      borderRadius: radii.sm,
                      backgroundColor: searchRadius === rad ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.08)"
                    }}
                  >
                    <Text style={{ color: "#FFF", fontSize: 13, fontWeight: "600" }}>{rad}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={{ marginTop: 24 }}>
              <TouchableOpacity
                onPress={toggleOnline}
                disabled={isLoading}
                style={{
                  backgroundColor: isOnline ? "#EF4444" : "#10B981",
                  paddingVertical: 18,
                  borderRadius: radii.xl,
                  alignItems: "center",
                  flexDirection: "row",
                  justifyContent: "center",
                  gap: 8,
                  opacity: isLoading ? 0.7 : 1,
                  shadowColor: isOnline ? "#EF4444" : "#10B981",
                  shadowOpacity: 0.3,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 4 },
                }}
              >
                <Ionicons name={isOnline ? "power" : "radio"} size={22} color="#FFFFFF" />
                <Text style={{ color: "#FFFFFF", fontSize: 17, fontWeight: "800", letterSpacing: 0.5 }}>
                  {isLoading ? "UPDATING STATUS..." : isOnline ? "GO OFFLINE" : "GO ONLINE"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ borderRadius: radii.xl, overflow: "hidden", borderWidth: 1, borderColor: brand.border }}>
            <RideMap
              userLocation={mapUserLocation}
              pickupLocation={pickupLocation}
              dropoffLocation={dropoffLocation}
              routePolyline={routeData?.encodedPolyline}
              routeColor={routeColor}
              nearbyDrivers={activeTripDriverMarker ? [activeTripDriverMarker] : []}
              hotspots={MANSA_HOTSPOTS}
              style={{ height: 340 }}
            />

            <View style={{ padding: 12, backgroundColor: brand.surface }}>
              <Text style={{ fontSize: 12, color: brand.textMuted }}>Location: {locationLabel}</Text>
              {Platform.OS !== "web" ? (
                <Text style={{ marginTop: 2, fontSize: 12, color: brand.textMuted }}>GPS: {gpsLabel}</Text>
              ) : null}
              <Text style={{ marginTop: 2, fontSize: 12, color: brand.textMuted }}>
                Tracking: {isTracking ? "live (2-5s updates)" : "inactive"}
              </Text>
              <Text style={{ marginTop: 2, fontSize: 12, color: brand.textMuted }}>
                {dateLabel} • {timeLabel}
              </Text>
            </View>
          </View>

          {driverProfile ? (
            <AppCard>
              <Text style={{ fontSize: 17, fontWeight: "800", color: brand.text }}>
                Driver Profile & Important Info
              </Text>
              <Text style={{ marginTop: 6, fontSize: 13, color: brand.textMuted }}>
                Name: {driverProfile.personalInfo?.fullName || currentUser?.name || "-"}
              </Text>
              <Text style={{ marginTop: 2, fontSize: 13, color: brand.textMuted }}>
                Phone: {driverProfile.personalInfo?.phoneNumber || "-"} • NRC: {driverProfile.personalInfo?.nrcNumber || "-"}
              </Text>
              <Text style={{ marginTop: 2, fontSize: 13, color: brand.textMuted }}>
                Address: {driverProfile.personalInfo?.homeAddress || "-"}
              </Text>
              <Text style={{ marginTop: 2, fontSize: 13, color: brand.textMuted }}>
                Vehicle: {driverProfile.vehicle?.make} {driverProfile.vehicle?.model} • {driverProfile.vehicle?.plateNumber} •{" "}
                {driverProfile.vehicle?.color}
              </Text>
              <Text style={{ marginTop: 2, fontSize: 13, color: brand.textMuted }}>
                License: {driverProfile.compliance?.driversLicenseNumber || "-"} • Registration:{" "}
                {driverProfile.compliance?.vehicleRegistrationNumber || "-"}
              </Text>
              <Text style={{ marginTop: 2, fontSize: 13, color: brand.textMuted }}>
                Compliance: license {driverProfile.compliance?.hasDriversLicense ? "yes" : "no"}, registration{" "}
                {driverProfile.compliance?.hasVehicleRegistrationDocument ? "yes" : "no"}, insurance{" "}
                {driverProfile.compliance?.insured ? "yes" : "no"}, road tax{" "}
                {driverProfile.compliance?.roadTaxCleared ? "yes" : "no"}, fitness{" "}
                {driverProfile.compliance?.fitnessTestPassed ? "yes" : "no"}
              </Text>
              <Text style={{ marginTop: 2, fontSize: 13, color: brand.textMuted }}>
                Documents: {driverProfile.documents?.driversLicenseDocumentRef || "-"}, {" "}
                {driverProfile.documents?.vehicleRegistrationDocumentRef || "-"}, {" "}
                {driverProfile.documents?.insuranceDocumentRef || "-"}, {" "}
                {driverProfile.documents?.roadTaxDocumentRef || "-"}, {" "}
                {driverProfile.documents?.fitnessCertificateDocumentRef || "-"}
              </Text>
              <Text style={{ marginTop: 2, fontSize: 13, color: brand.textMuted }}>
                Credits: purchased {driverProfile.commercial?.ridesPurchased ?? 0}, completed{" "}
                {driverProfile.commercial?.ridesCompleted ?? 0}, remaining {ridesRemaining}
              </Text>
              <Text style={{ marginTop: 2, fontSize: 13, color: brand.textMuted }}>
                Verified: {driverProfile.verified ? "yes" : "no"} • Last verification:{" "}
                {formatAuditTime(driverProfile.audit?.verificationReviewedAt)}
              </Text>
              <Text style={{ marginTop: 2, fontSize: 12, color: brand.textMuted }}>
                Profile audit: updated {formatAuditTime(driverProfile.audit?.updatedAt)}
              </Text>
              <View style={{ marginTop: 12 }}>
                <AppButton
                  label="Open Full Driver Profile"
                  variant="outline"
                  onPress={() => router.push("/driver-profile" as never)}
                  leftIcon={<Ionicons name="person-circle-outline" size={16} color={brand.accent} />}
                />
              </View>
            </AppCard>
          ) : null}

          {pendingOffer ? (
            <View
              style={{
                borderRadius: radii.lg,
                padding: 16,
                backgroundColor: brand.surface,
                borderWidth: 1,
                borderColor: brand.border,
                ...shadows.md,
              }}
            >
              <Text style={{ fontSize: 17, fontWeight: "800", color: brand.text }}>Incoming Ride Request</Text>
              <Text style={{ marginTop: 8, fontSize: 13, color: brand.textMuted }}>
                Rider: {pendingOffer.riderName ?? "Service Seeker"}
              </Text>
              <Text style={{ marginTop: 2, fontSize: 13, color: brand.textMuted }}>
                Distance to pickup: {(pendingOffer.distanceKm ?? 0).toFixed(2)} km
              </Text>
              <Text style={{ marginTop: 2, fontSize: 13, color: brand.textMuted }}>
                Estimated fare: ${(pendingOffer.estimatedFare ?? 0).toFixed(2)}
              </Text>

              <View style={{ marginTop: 12, flexDirection: "row", gap: 10 }}>
                <AppButton
                  label="Accept"
                  variant="secondary"
                  fullWidth={false}
                  style={{ flex: 1 }}
                  onPress={() => onAccept(pendingOffer.id)}
                />
                <AppButton
                  label="Decline"
                  variant="outline"
                  fullWidth={false}
                  style={{ flex: 1 }}
                  onPress={() => onDecline(pendingOffer.id)}
                />
              </View>
            </View>
          ) : (
            <AppCard tone="muted">
              <Text style={{ fontSize: 13, color: brand.textMuted }}>No pending ride requests.</Text>
            </AppCard>
          )}

          {activeTrip ? (
            <AppCard>
              <Text style={{ fontSize: 17, fontWeight: "800", color: brand.text }}>Trip in Progress</Text>
              <Text style={{ marginTop: 6, fontSize: 13, color: brand.textMuted }}>Trip: {activeTrip.id}</Text>
              <Text style={{ marginTop: 2, fontSize: 13, color: brand.textMuted }}>State: {activeTrip.state}</Text>
              <Text style={{ marginTop: 2, fontSize: 13, color: brand.textMuted }}>
                Pickup: {activeTrip.pickup?.address ?? "-"}
              </Text>
              <Text style={{ marginTop: 2, fontSize: 13, color: brand.textMuted }}>
                Dropoff: {activeTrip.dropoff?.address ?? "-"}
              </Text>

              {pinRequired ? (
                <View style={{ marginTop: 10 }}>
                  <AppInput
                    label="Passenger PIN (optional)"
                    placeholder="Enter 4-digit PIN if required"
                    value={startPin}
                    onChangeText={setStartPin}
                    keyboardType="numeric"
                    maxLength={4}
                  />
                </View>
              ) : null}

              <View style={{ marginTop: 12, gap: 8 }}>
                {canMarkArrived ? (
                  <AppButton
                    label="Arrived at Pickup"
                    variant="secondary"
                    onPress={onArrived}
                    loading={tripActionLoading === "arrived"}
                    disabled={tripActionLoading !== null && tripActionLoading !== "arrived"}
                  />
                ) : null}
                {canStartTrip ? (
                  <AppButton
                    label="Start Trip"
                    variant="primary"
                    onPress={onStartTrip}
                    loading={tripActionLoading === "start"}
                    disabled={tripActionLoading !== null && tripActionLoading !== "start"}
                  />
                ) : null}
                {canCompleteTrip ? (
                  <AppButton
                    label="End Trip"
                    variant="success"
                    onPress={onCompleteTrip}
                    loading={tripActionLoading === "complete"}
                    disabled={tripActionLoading !== null && tripActionLoading !== "complete"}
                  />
                ) : null}
              </View>
            </AppCard>
          ) : null}

          <AppCard tone="muted">
            <Text style={{ fontSize: 16, fontWeight: "800", color: brand.text }}>Earnings & Operations</Text>
            <Text style={{ marginTop: 6, fontSize: 12, color: brand.textMuted }}>
              View daily totals, weekly trend, and trip-by-trip earnings breakdown.
            </Text>
            <View style={{ marginTop: 10 }}>
              <AppButton
                label="Open Earnings"
                variant="outline"
                onPress={() => router.push("/driver-earnings" as never)}
              />
            </View>
          </AppCard>

          {isOfflineMode ? (
            <AppCard tone="muted">
              <Text style={{ fontSize: 12, color: brand.textMuted }}>
                Offline mode active. Dispatch updates are syncing locally on this device.
              </Text>
            </AppCard>
          ) : null}

          {dashboardError ? (
            <AppCard tone="muted">
              <Text style={{ fontSize: 12, color: brand.textMuted }}>
                Dispatch backend issue: {dashboardError}
              </Text>
            </AppCard>
          ) : null}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
