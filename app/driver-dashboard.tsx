import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Platform, ScrollView, Text, TouchableOpacity, View } from "react-native";
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
import { useAppStore } from "@/lib/store";
import { trpc } from "@/lib/trpc";
import {
  acceptDriverRequest,
  completeTrip,
  declineDriverRequest,
  driverArrived,
  getDriverDashboard,
  startTrip,
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

export default function DriverDashboardScreen() {
  const router = useRouter();
  const brand = useBrandTheme();
  const trpcUtils = trpc.useUtils();
  const { currentUser, currentLocation, setCurrentLocation, setActiveRide } = useAppStore();
  const { isTracking } = useLocationTracking();
  const defaultLocation = { latitude: -15.4162, longitude: 28.3115 };

  const [isOnline, setIsOnline] = useState(false);
  const [dashboard, setDashboard] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [startPin, setStartPin] = useState("");
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [locationLabel, setLocationLabel] = useState("Resolving location...");

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
      const source = currentLocation ?? defaultLocation;
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

    setDashboard({
      status: { isOnline: Boolean(profile?.isOnline), dailyEarnings: profile?.totalEarnings ?? 0 },
      pendingRequests,
      activeTrips: localActiveTrips ?? [],
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
    } catch {
      await loadDashboardLocal();
      setIsOfflineMode(true);
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

  const pendingOffer = dashboard?.pendingRequests?.[0] ?? null;
  const activeTrip = useMemo(() => dashboard?.activeTrips?.[0] ?? null, [dashboard?.activeTrips]);

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
          }
        } catch {
          // keep fallback below
        }
      }

      if (next && !sourceLocation) {
        sourceLocation = defaultLocation;
      }
      const effectiveLocation = sourceLocation ?? defaultLocation;

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

      setIsOnline(next);
      await loadDashboard();

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
      const source = currentLocation ?? defaultLocation;
      try {
        await updateDriverStatus({
          isOnline: true,
          lat: source.latitude,
          lng: source.longitude,
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
    }, 8000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [currentLocation, isOnline]);

  const onAccept = async (offerId: string) => {
    try {
      try {
        await acceptDriverRequest(offerId);
        setIsOfflineMode(false);
      } catch (error) {
        if (!currentUser) throw error;
        await acceptLocalRide(offerId, currentUser.id.toString());
        const ride = await getLocalRideById(offerId);
        if (ride) {
          setActiveRide(ride as any);
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
      } catch {
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
      try {
        await driverArrived(activeTrip.id);
        setIsOfflineMode(false);
      } catch {
        setIsOfflineMode(true);
      }
      await loadDashboard();
    } catch (error) {
      Alert.alert("Arrived update failed", error instanceof Error ? error.message : "Try again");
    }
  };

  const onStartTrip = async () => {
    if (!activeTrip?.id) return;
    try {
      try {
        await startTrip(activeTrip.id, { pin: startPin.trim() || undefined });
        setIsOfflineMode(false);
      } catch {
        await startLocalRide(activeTrip.id.toString());
        setIsOfflineMode(true);
      }
      await loadDashboard();
      setStartPin("");
    } catch (error) {
      Alert.alert("Start failed", error instanceof Error ? error.message : "Try again");
    }
  };

  const onCompleteTrip = async () => {
    if (!activeTrip?.id) return;
    try {
      try {
        await completeTrip(activeTrip.id);
        setIsOfflineMode(false);
      } catch {
        await completeLocalRide(activeTrip.id.toString());
        setIsOfflineMode(true);
      }
      await loadDashboard();
    } catch (error) {
      Alert.alert("Complete failed", error instanceof Error ? error.message : "Try again");
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

            <View style={{ marginTop: 14 }}>
              <AppButton
                label={isOnline ? "Go Offline" : "Go Online"}
                variant={isOnline ? "secondary" : "outline"}
                loading={isLoading}
                onPress={toggleOnline}
                leftIcon={<Ionicons name={isOnline ? "pause" : "play"} size={16} color={isOnline ? "#FFFFFF" : brand.accent} />}
              />
            </View>
          </View>

          <View style={{ borderRadius: radii.xl, overflow: "hidden", borderWidth: 1, borderColor: brand.border }}>
            <RideMap
              userLocation={currentLocation ? { lat: currentLocation.latitude, lng: currentLocation.longitude } : undefined}
              pickupLocation={pickupLocation}
              dropoffLocation={dropoffLocation}
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
                {canMarkArrived ? <AppButton label="Arrived at Pickup" variant="secondary" onPress={onArrived} /> : null}
                {canStartTrip ? <AppButton label="Start Trip" variant="primary" onPress={onStartTrip} /> : null}
                {canCompleteTrip ? <AppButton label="End Trip" variant="success" onPress={onCompleteTrip} /> : null}
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
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
