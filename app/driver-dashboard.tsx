import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useAppStore } from "@/lib/store";
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
import { IS_DRIVER_APP } from "@/constants/app-variant";

export default function DriverDashboardScreen() {
  const router = useRouter();
  const colors = useColors();
  const { currentUser, currentLocation, setActiveRide } = useAppStore();
  const [isOnline, setIsOnline] = useState(false);
  const [dashboard, setDashboard] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [startPin, setStartPin] = useState("");
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const now = new Date();
  const dateLabel = now.toLocaleDateString([], {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const timeLabel = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const gpsLabel = currentLocation
    ? `${currentLocation.latitude.toFixed(5)}, ${currentLocation.longitude.toFixed(5)}`
    : "Waiting for GPS lock";

  const loadDashboardLocal = useCallback(async () => {
    if (!currentUser) return;
    const profile = await getLocalDriverProfile(currentUser.id.toString());
    const available = await getAvailableRides();
    const localActiveTrips = await getActiveRidesForUser(currentUser.id.toString());
    const pendingRequests = available.map((ride) => ({
      id: ride.id.toString(),
      tripId: ride.id.toString(),
      distanceKm: 0,
    }));

    setDashboard({
      status: { isOnline: Boolean(profile?.isOnline) },
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
    } catch (error) {
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

  const activeTrip = useMemo(() => dashboard?.activeTrips?.[0] ?? null, [dashboard?.activeTrips]);

  const toggleOnline = async () => {
    try {
      setIsLoading(true);
      const next = !isOnline;
      let usedOfflineMode = false;
      try {
        await updateDriverStatus({ isOnline: next });
        setIsOfflineMode(false);
      } catch (error) {
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
      Alert.alert("Ride accepted", "Head to passenger pickup point.");
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
        // Local mode: hiding the request from this screen only.
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
        // Local mode has no arrived state; keep trip active.
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
        await startTrip(activeTrip.id, { pin: startPin || undefined });
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
    <ScreenContainer className="bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <View className="gap-5 pb-8">
          <View className="flex-row items-center justify-between">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-10 h-10 rounded-full items-center justify-center"
              style={{ backgroundColor: colors.surface }}
            >
              <Ionicons name="arrow-back" size={22} color={colors.foreground} />
            </TouchableOpacity>
            <Text className="text-lg font-bold text-foreground">Driver Dispatch</Text>
            <View className="w-10" />
          </View>

          <View className="rounded-xl p-4 flex-row items-center justify-between" style={{ backgroundColor: colors.surface }}>
            <View>
              <Text className="text-xs text-muted">Time and calendar</Text>
              <Text className="text-sm font-semibold text-foreground">{dateLabel}</Text>
              <Text className="text-xs text-muted">{timeLabel}</Text>
            </View>
            <Ionicons name="calendar" size={20} color={colors.primary} />
          </View>

          <View className="rounded-xl p-4 gap-2" style={{ backgroundColor: colors.surface }}>
            <Text className="text-base font-semibold text-foreground">Live GPS tracking details</Text>
            <Text className="text-xs text-muted">Driver location: {gpsLabel}</Text>
            <Text className="text-xs text-muted">Pending clients nearby: {(dashboard?.pendingRequests ?? []).length}</Text>
          </View>

          <View className="rounded-xl p-4 gap-3" style={{ backgroundColor: colors.surface }}>
            <Text className="text-base font-semibold text-foreground">Availability</Text>
            <Text className="text-xs text-muted">
              {isOnline ? "Online and receiving jobs" : "Offline. Tap Go Online to receive rides."}
            </Text>
            <TouchableOpacity
              onPress={toggleOnline}
              disabled={isLoading}
              className="py-3 rounded-lg items-center justify-center"
              style={{ backgroundColor: isOnline ? colors.error : colors.success, opacity: isLoading ? 0.6 : 1 }}
            >
              <Text className="text-white font-semibold">{isOnline ? "Go Offline" : "Go Online"}</Text>
            </TouchableOpacity>
          </View>

          {isOfflineMode && (
            <View className="rounded-xl p-4" style={{ backgroundColor: colors.surface }}>
              <Text className="text-xs text-muted">
                Offline mode active: dispatch data is syncing locally on this device.
              </Text>
            </View>
          )}

          <View className="rounded-xl p-4 gap-3" style={{ backgroundColor: colors.surface }}>
            <Text className="text-base font-semibold text-foreground">Incoming Requests (clients location)</Text>
            {(dashboard?.pendingRequests ?? []).length === 0 && (
              <Text className="text-sm text-muted">No pending requests.</Text>
            )}
            {(dashboard?.pendingRequests ?? []).map((offer: any) => (
              <View key={offer.id} className="border border-border rounded-lg p-3 gap-2">
                <Text className="text-sm text-foreground">Trip: {offer.tripId}</Text>
                <Text className="text-xs text-muted">Distance: {offer.distanceKm.toFixed(2)} km</Text>
                <Text className="text-xs text-muted">Window: accept quickly for best dispatch success.</Text>
                <View className="flex-row gap-2">
                  <TouchableOpacity
                    onPress={() => onAccept(offer.id)}
                    className="flex-1 py-2 rounded-lg items-center justify-center"
                    style={{ backgroundColor: colors.success }}
                  >
                    <Text className="text-white font-semibold">Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => onDecline(offer.id)}
                    className="flex-1 py-2 rounded-lg items-center justify-center"
                    style={{ backgroundColor: colors.error }}
                  >
                    <Text className="text-white font-semibold">Decline</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>

          {activeTrip && (
            <View className="rounded-xl p-4 gap-3" style={{ backgroundColor: colors.surface }}>
              <Text className="text-base font-semibold text-foreground">Active Trip</Text>
              <Text className="text-sm text-muted">Trip: {activeTrip.id}</Text>
              <Text className="text-sm text-muted">State: {activeTrip.state}</Text>
              <Text className="text-sm text-muted">Pickup: {activeTrip.pickup?.address}</Text>
              <Text className="text-sm text-muted">Dropoff: {activeTrip.dropoff?.address}</Text>
              <Text className="text-xs text-muted">
                Fare snapshot: {activeTrip.fare?.currency ?? "USD"} {activeTrip.fare?.total?.toFixed?.(2) ?? "--"}
              </Text>

              <TouchableOpacity
                onPress={onArrived}
                className="py-3 rounded-lg items-center justify-center"
                style={{ backgroundColor: colors.primary }}
              >
                <Text className="text-white font-semibold">Mark Arrived</Text>
              </TouchableOpacity>

              <TextInput
                value={startPin}
                onChangeText={setStartPin}
                placeholder="Enter passenger PIN (if required)"
                placeholderTextColor={colors.muted}
                className="border border-border rounded-lg px-3 py-2 text-foreground"
                keyboardType="numeric"
                maxLength={4}
              />

              <TouchableOpacity
                onPress={onStartTrip}
                className="py-3 rounded-lg items-center justify-center"
                style={{ backgroundColor: colors.primary }}
              >
                <Text className="text-white font-semibold">Start Trip</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={onCompleteTrip}
                className="py-3 rounded-lg items-center justify-center"
                style={{ backgroundColor: colors.success }}
              >
                <Text className="text-white font-semibold">Complete Trip</Text>
              </TouchableOpacity>
            </View>
          )}

          <View className="rounded-xl p-4 gap-2" style={{ backgroundColor: colors.surface }}>
            <Text className="text-base font-semibold text-foreground">Fleet management</Text>
            <Text className="text-xs text-muted">Vehicle and driver verification are managed by company owner/admin.</Text>
            <Text className="text-xs text-muted">Use this console for availability, dispatch, navigation, and trip completion.</Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
