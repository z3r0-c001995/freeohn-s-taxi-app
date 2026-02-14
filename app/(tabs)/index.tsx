import { ScrollView, Text, View, TouchableOpacity, Alert } from "react-native";
import { useEffect, useMemo, useState } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useAppStore } from "@/lib/store";
import { useRouter } from "expo-router";
import { useColors } from "@/hooks/use-colors";
import { useLocationTracking } from "@/hooks/use-location-tracking";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import {
  setDriverOnlineStatus,
  getDriverProfile,
  getAvailableRides,
  acceptRide,
  getRideById,
  startRide,
  completeRide,
} from "@/lib/db-service";
import {
  acceptDriverRequest,
  completeTrip as completeRemoteTrip,
  getDriverRequests,
  getTrip as getRemoteTrip,
  startTrip as startRemoteTrip,
  updateDriverStatus,
} from "@/lib/ride-hailing-api";
import { calculateDistance } from "@/lib/ride-utils";
import { APP_LABEL, IS_DRIVER_APP, IS_SEEKER_APP } from "@/constants/app-variant";

function mapRemoteTripToLocal(remoteTrip: any) {
  return {
    id: remoteTrip.id,
    riderId: remoteTrip.riderId,
    driverId: remoteTrip.driverId ?? null,
    pickupLat: String(remoteTrip.pickup?.lat ?? ""),
    pickupLng: String(remoteTrip.pickup?.lng ?? ""),
    dropoffLat: String(remoteTrip.dropoff?.lat ?? ""),
    dropoffLng: String(remoteTrip.dropoff?.lng ?? ""),
    pickupAddress: remoteTrip.pickup?.address ?? null,
    dropoffAddress: remoteTrip.dropoff?.address ?? null,
    rideType: remoteTrip.fare?.rideType ?? "standard",
    status:
      remoteTrip.state === "IN_PROGRESS"
        ? "in_progress"
        : remoteTrip.state === "COMPLETED"
          ? "completed"
          : remoteTrip.state === "CANCELLED_BY_DRIVER" || remoteTrip.state === "CANCELLED_BY_PASSENGER"
            ? "cancelled"
            : "accepted",
    fareAmount: Number(remoteTrip.fare?.total ?? 0),
    distanceMeters: Number(remoteTrip.fare?.distanceMeters ?? 0),
    durationSeconds: Number(remoteTrip.fare?.durationSeconds ?? 0),
    encodedPolyline: null,
    requestedAt: new Date(remoteTrip.createdAt ?? Date.now()),
    acceptedAt: remoteTrip.matchedAt ? new Date(remoteTrip.matchedAt) : null,
    startedAt: remoteTrip.startedAt ? new Date(remoteTrip.startedAt) : null,
    completedAt: remoteTrip.completedAt ? new Date(remoteTrip.completedAt) : null,
    cancelledAt: remoteTrip.cancelledAt ? new Date(remoteTrip.cancelledAt) : null,
    queuedSync: false,
  };
}

export default function HomeScreen() {
  const router = useRouter();
  const colors = useColors();
  const {
    currentUser,
    setCurrentLocation,
    currentLocation,
    isAuthenticated,
    driverProfile,
    setDriverProfile,
    activeRide,
    setActiveRide,
    addRideToHistory,
    setCurrentUser,
    setIsAuthenticated,
    persist,
    rideHistory,
  } = useAppStore();
  const { isTracking } = useLocationTracking();
  const [locationPermission, setLocationPermission] = useState<boolean | null>(null);
  const [availableRides, setAvailableRides] = useState<any[]>([]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/(auth)/onboarding");
      return;
    }

    void requestLocationPermission();
    void loadDriverProfile();
  }, [isAuthenticated, router]);

  const loadDriverProfile = async () => {
    if (currentUser?.role === "driver" && currentUser.id) {
      try {
        const profile = await getDriverProfile(currentUser.id.toString());
        if (profile) {
          setDriverProfile(profile);
        }
      } catch (error) {
        console.error("Failed to load driver profile:", error);
      }
    }
  };

  const loadAvailableRides = async () => {
    if (currentUser?.role === "driver" && driverProfile?.isOnline) {
      try {
        try {
          const remote = await getDriverRequests();
          const rides = await Promise.all(
            (remote.requests ?? []).map(async (offer: any) => {
              const trip = await getRemoteTrip(offer.tripId);
              const mapped = mapRemoteTripToLocal(trip);
              return {
                ...mapped,
                id: offer.id,
                dispatchOfferId: offer.id,
                tripId: offer.tripId,
                distanceKm: offer.distanceKm ?? 0,
              };
            }),
          );
          setAvailableRides(rides);
        } catch {
          const rides = await getAvailableRides();
          setAvailableRides(rides);
        }
      } catch (error) {
        console.error("Failed to load available rides:", error);
      }
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      if (driverProfile?.isOnline) {
        void loadAvailableRides();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [driverProfile?.isOnline, currentUser?.role]);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status === "granted");

      if (status === "granted") {
        const location = await Location.getCurrentPositionAsync({});
        setCurrentLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      }
    } catch (error) {
      console.error("Location permission error:", error);
    }
  };

  const handleRequestRide = () => {
    if (currentUser?.role !== "rider") {
      Alert.alert("Error", "Only riders can request rides");
      return;
    }
    router.push("/request-ride");
  };

  const handleOpenSafetyCenter = () => {
    router.push("/safety-center" as never);
  };

  const handleOpenDriverDispatch = () => {
    router.push("/driver-dashboard" as never);
  };

  const handleOpenTripCenter = () => {
    if (!activeRide?.id) return;
    router.push(`/trip/${activeRide.id}` as never);
  };

  const handleResetProfile = async () => {
    setCurrentUser(null);
    setIsAuthenticated(false);
    await persist();
    router.replace("/(auth)/onboarding");
  };

  const handleToggleOnline = async () => {
    if (currentUser?.role !== "driver") {
      Alert.alert("Error", "Only drivers can toggle online status");
      return;
    }

    if (!currentUser) return;

    try {
      const newStatus = !driverProfile?.isOnline;
      try {
        await updateDriverStatus({
          isOnline: newStatus,
          lat: currentLocation?.latitude,
          lng: currentLocation?.longitude,
        });
      } catch {
        await setDriverOnlineStatus(currentUser.id.toString(), newStatus);
      }

      if (driverProfile) {
        setDriverProfile({
          ...driverProfile,
          isOnline: newStatus,
        });
      }

      Alert.alert("Status Updated", `You are now ${newStatus ? "online" : "offline"}`);
    } catch (error) {
      console.error("Failed to toggle online status:", error);
      Alert.alert("Error", "Failed to update status");
    }
  };

  const handleAcceptRide = async (rideId: string) => {
    if (!currentUser) return;

    try {
      let acceptedRide: any = null;
      try {
        const offer = await acceptDriverRequest(rideId);
        const trip = await getRemoteTrip(offer.tripId);
        acceptedRide = mapRemoteTripToLocal(trip);
      } catch {
        await acceptRide(rideId, currentUser.id.toString());
        acceptedRide = await getRideById(rideId);
      }
      setActiveRide(acceptedRide as any);
      Alert.alert("Ride accepted", "Navigate to the pickup location.");
      await loadAvailableRides();
    } catch (error) {
      console.error("Failed to accept ride:", error);
      Alert.alert("Error", "Failed to accept ride");
    }
  };

  const handleDeclineRide = (rideId: string) => {
    setAvailableRides((prev) => prev.filter((ride) => String(ride.id) !== rideId));
  };

  const handleStartRide = async (rideId: string) => {
    try {
      let updatedRide: any = null;
      try {
        const remote = await startRemoteTrip(rideId, {
          idempotencyKey: `start_${rideId}_${Date.now()}`,
        });
        updatedRide = mapRemoteTripToLocal(remote);
      } catch {
        await startRide(rideId);
        updatedRide = await getRideById(rideId);
      }
      if (updatedRide) {
        setActiveRide(updatedRide as any);
      }
      Alert.alert("Ride started", "Trip is now in progress.");
    } catch (error) {
      console.error("Failed to start ride:", error);
      Alert.alert("Error", "Failed to start ride");
    }
  };

  const handleCompleteRide = async (rideId: string) => {
    try {
      let updatedRide: any = null;
      try {
        const remote = await completeRemoteTrip(rideId);
        updatedRide = mapRemoteTripToLocal(remote.trip ?? remote);
      } catch {
        await completeRide(rideId);
        updatedRide = await getRideById(rideId);
      }
      if (updatedRide) {
        setActiveRide(null);
        addRideToHistory(updatedRide as any);
      }
      Alert.alert("Ride completed", "Trip has been completed successfully.");
    } catch (error) {
      console.error("Failed to complete ride:", error);
      Alert.alert("Error", "Failed to complete ride");
    }
  };

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

  const todayCompleted = rideHistory.filter((ride) => ride.status === "completed").length;
  const ratingLabel = "5.0";

  if (!currentUser) {
    return (
      <ScreenContainer className="bg-background items-center justify-center">
        <Text className="text-lg text-foreground">Loading...</Text>
      </ScreenContainer>
    );
  }

  const roleMismatch =
    (IS_SEEKER_APP && currentUser.role !== "rider") ||
    (IS_DRIVER_APP && currentUser.role !== "driver");

  if (roleMismatch) {
    return (
      <ScreenContainer className="bg-background items-center justify-center px-6">
        <View className="items-center gap-4">
          <Text className="text-xl font-bold text-foreground">{APP_LABEL}</Text>
          <Text className="text-center text-muted">
            This app only supports {IS_DRIVER_APP ? "driver" : "service seeker"} accounts.
          </Text>
          <TouchableOpacity onPress={handleResetProfile} className="bg-primary rounded-lg py-3 px-5">
            <Text className="text-white font-semibold">Switch Account</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <View className="flex-1 gap-5 pb-8">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-sm text-muted">Welcome back</Text>
              <Text className="text-3xl font-bold text-foreground">{currentUser.name}</Text>
              <Text className="text-xs text-muted mt-1">{APP_LABEL}</Text>
            </View>
            <TouchableOpacity
              onPress={() => Alert.alert("Profile", "Profile screen coming soon.")}
              className="w-12 h-12 rounded-full items-center justify-center"
              style={{ backgroundColor: colors.surface }}
            >
              <Ionicons name="person" size={24} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          <View className="rounded-2xl p-4 flex-row items-center justify-between" style={{ backgroundColor: colors.surface }}>
            <View>
              <Text className="text-xs text-muted">Calendar</Text>
              <Text className="text-base font-semibold text-foreground">{dateLabel}</Text>
              <Text className="text-sm text-muted">{timeLabel}</Text>
            </View>
            <View className="w-11 h-11 rounded-full items-center justify-center" style={{ backgroundColor: colors.background }}>
              <Ionicons name="calendar" size={22} color={colors.primary} />
            </View>
          </View>

          <View className="rounded-2xl p-4 gap-2" style={{ backgroundColor: colors.surface }}>
            <View className="flex-row items-center gap-2">
              <Ionicons
                name={locationPermission ? "navigate" : "alert-circle"}
                size={18}
                color={locationPermission ? colors.success : colors.error}
              />
              <Text className="text-sm font-semibold text-foreground">
                {locationPermission ? "Live GPS tracking details" : "Location permission required"}
              </Text>
            </View>
            <Text className="text-xs text-muted">{gpsLabel}</Text>
            <Text className="text-xs text-muted">
              Tracking: {isTracking ? "Active" : "Idle"}
            </Text>
            {!locationPermission && (
              <TouchableOpacity onPress={requestLocationPermission} className="self-start mt-1 px-3 py-2 rounded-lg" style={{ backgroundColor: colors.primary }}>
                <Text className="text-white text-xs font-semibold">Enable Location</Text>
              </TouchableOpacity>
            )}
          </View>

          {IS_SEEKER_APP ? (
            <>
              <View className="rounded-2xl p-5 gap-4" style={{ backgroundColor: colors.surface }}>
                <Text className="text-lg font-bold text-foreground">Smart Ride Booking</Text>
                <Text className="text-sm text-muted">
                  Choose your vehicle, pickup/dropoff points, and confirm your ride with live fare estimation.
                </Text>
                <TouchableOpacity onPress={handleRequestRide} className="bg-primary rounded-xl py-4 items-center justify-center">
                  <Text className="text-white font-semibold text-base">Book a Ride</Text>
                </TouchableOpacity>
                <View className="flex-row gap-2">
                  <View className="flex-1 rounded-lg p-3" style={{ backgroundColor: colors.background }}>
                    <Text className="text-xs text-muted">Vehicles</Text>
                    <Text className="text-sm font-semibold text-foreground">Standard / Premium</Text>
                  </View>
                  <View className="flex-1 rounded-lg p-3" style={{ backgroundColor: colors.background }}>
                    <Text className="text-xs text-muted">Payment</Text>
                    <Text className="text-sm font-semibold text-foreground">Cash (Card soon)</Text>
                  </View>
                </View>
              </View>

              <View className="rounded-2xl p-4" style={{ backgroundColor: colors.surface }}>
                <Text className="text-sm font-semibold text-foreground">Safety and Security</Text>
                <Text className="text-xs text-muted mt-1">
                  Route sharing, SOS, verified drivers, and in-app support are available during active trips.
                </Text>
                <TouchableOpacity
                  onPress={handleOpenSafetyCenter}
                  className="mt-3 rounded-lg py-3 items-center justify-center"
                  style={{ backgroundColor: colors.primary }}
                >
                  <Text className="text-white font-semibold">Open Safety Center</Text>
                </TouchableOpacity>
              </View>

              {activeRide && (
                <View className="rounded-2xl p-4 gap-3" style={{ backgroundColor: colors.surface }}>
                  <Text className="text-base font-semibold text-foreground">Current Ride</Text>
                  <Text className="text-sm text-muted">Pickup: {activeRide.pickupAddress ?? "Current location"}</Text>
                  <Text className="text-sm text-muted">Dropoff: {activeRide.dropoffAddress ?? "Destination"}</Text>
                  <Text className="text-sm font-semibold" style={{ color: colors.primary }}>
                    Fare: ${activeRide.fareAmount.toFixed(2)}
                  </Text>
                  <View className="flex-row gap-2">
                    <TouchableOpacity
                      onPress={handleOpenTripCenter}
                      className="flex-1 rounded-lg py-3 items-center justify-center"
                      style={{ backgroundColor: colors.primary }}
                    >
                      <Text className="text-white font-semibold">Track Ride</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => router.push("/(tabs)/chat")}
                      className="flex-1 rounded-lg py-3 items-center justify-center"
                      style={{ backgroundColor: colors.background }}
                    >
                      <Text className="text-foreground font-semibold">Chat Driver</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              <View className="rounded-2xl p-4" style={{ backgroundColor: colors.surface }}>
                <Text className="text-sm font-semibold text-foreground">Digital Invoice</Text>
                <Text className="text-xs text-muted mt-1">
                  A digital invoice is generated automatically after trip completion.
                </Text>
              </View>
            </>
          ) : (
            <>
              <View className="rounded-2xl p-4 gap-3" style={{ backgroundColor: colors.surface }}>
                <Text className="text-lg font-bold text-foreground">Driver Status</Text>
                <Text className="text-xs text-muted">
                  Driver onboarding is owner-managed. Sign in with your company-registered account and go online.
                </Text>
                <TouchableOpacity
                  onPress={handleToggleOnline}
                  className={`rounded-xl py-4 items-center justify-center ${
                    driverProfile?.isOnline ? "bg-error" : "bg-success"
                  }`}
                >
                  <Text className="text-white font-semibold text-base">
                    {driverProfile?.isOnline ? "Go Offline" : "Go Online"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleOpenDriverDispatch}
                  className="rounded-xl py-3 items-center justify-center"
                  style={{ backgroundColor: colors.background }}
                >
                  <Text className="text-sm font-semibold" style={{ color: colors.primary }}>
                    Open Driver Dispatch Console
                  </Text>
                </TouchableOpacity>
              </View>

              <View className="rounded-2xl p-4 gap-2" style={{ backgroundColor: colors.surface }}>
                <Text className="text-sm font-semibold text-foreground">Real-Time Tracking and Navigation</Text>
                <Text className="text-xs text-muted">Nearby client requests: {availableRides.length}</Text>
                <Text className="text-xs text-muted">
                  Availability: {driverProfile?.isOnline ? "Online" : "Offline"}
                </Text>
                <Text className="text-xs text-muted">Current GPS: {gpsLabel}</Text>
              </View>

              {driverProfile?.isOnline && availableRides.length > 0 && (
                <View className="gap-3">
                  <Text className="text-lg font-bold text-foreground">Incoming Client Requests</Text>
                  {availableRides.map((ride) => {
                    const pickupDistanceKm = driverProfile?.currentLat && driverProfile?.currentLng
                      ? calculateDistance(
                          parseFloat(driverProfile.currentLat),
                          parseFloat(driverProfile.currentLng),
                          parseFloat(ride.pickupLat),
                          parseFloat(ride.pickupLng),
                        )
                      : 0;

                    return (
                      <View key={String(ride.id)} className="rounded-xl p-4 gap-2" style={{ backgroundColor: colors.surface }}>
                        <Text className="text-sm font-semibold text-foreground">Ride #{String(ride.id).slice(-6)}</Text>
                        <Text className="text-xs text-muted">Pickup: {ride.pickupAddress ?? `${ride.pickupLat}, ${ride.pickupLng}`}</Text>
                        <Text className="text-xs text-muted">Dropoff: {ride.dropoffAddress ?? `${ride.dropoffLat}, ${ride.dropoffLng}`}</Text>
                        <Text className="text-xs text-muted">Distance: {pickupDistanceKm.toFixed(1)} km</Text>
                        <View className="flex-row gap-2 mt-1">
                          <TouchableOpacity
                            onPress={() => handleAcceptRide(String(ride.id))}
                            className="flex-1 rounded-lg py-2 items-center justify-center"
                            style={{ backgroundColor: colors.success }}
                          >
                            <Text className="text-white font-semibold">Accept</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => handleDeclineRide(String(ride.id))}
                            className="flex-1 rounded-lg py-2 items-center justify-center"
                            style={{ backgroundColor: colors.error }}
                          >
                            <Text className="text-white font-semibold">Decline</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}

              {activeRide && (
                <View className="rounded-2xl p-4 gap-3" style={{ backgroundColor: colors.surface }}>
                  <Text className="text-base font-semibold text-foreground">Active Trip</Text>
                  <Text className="text-sm text-muted">Pickup: {activeRide.pickupAddress ?? "Pickup location"}</Text>
                  <Text className="text-sm text-muted">Dropoff: {activeRide.dropoffAddress ?? "Dropoff location"}</Text>
                  <Text className="text-sm font-semibold" style={{ color: colors.primary }}>
                    Fare: ${activeRide.fareAmount.toFixed(2)}
                  </Text>
                  <View className="flex-row gap-2">
                    {activeRide.status === "accepted" && (
                      <TouchableOpacity
                        onPress={() => handleStartRide(activeRide.id.toString())}
                        className="flex-1 rounded-lg py-3 items-center justify-center"
                        style={{ backgroundColor: colors.primary }}
                      >
                        <Text className="text-white font-semibold">Start Trip</Text>
                      </TouchableOpacity>
                    )}
                    {activeRide.status === "in_progress" && (
                      <TouchableOpacity
                        onPress={() => handleCompleteRide(activeRide.id.toString())}
                        className="flex-1 rounded-lg py-3 items-center justify-center"
                        style={{ backgroundColor: colors.success }}
                      >
                        <Text className="text-white font-semibold">Complete Trip</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      onPress={() => router.push("/(tabs)/chat")}
                      className="rounded-lg px-4 py-3 items-center justify-center"
                      style={{ backgroundColor: colors.background }}
                    >
                      <Ionicons name="chatbubble" size={18} color={colors.foreground} />
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              <View className="rounded-2xl p-4 gap-3" style={{ backgroundColor: colors.surface }}>
                <Text className="text-base font-semibold text-foreground">Fleet Management Snapshot</Text>
                <View className="flex-row gap-3">
                  <View className="flex-1 rounded-lg p-3" style={{ backgroundColor: colors.background }}>
                    <Text className="text-xs text-muted">Today</Text>
                    <Text className="text-xl font-bold text-foreground">{todayCompleted}</Text>
                    <Text className="text-xs text-muted">Completed trips</Text>
                  </View>
                  <View className="flex-1 rounded-lg p-3" style={{ backgroundColor: colors.background }}>
                    <Text className="text-xs text-muted">Driver rating</Text>
                    <Text className="text-xl font-bold text-foreground">{ratingLabel}</Text>
                    <Text className="text-xs text-muted">Service quality</Text>
                  </View>
                </View>
                <View className="rounded-lg p-3" style={{ backgroundColor: colors.background }}>
                  <Text className="text-xs text-muted">Earnings</Text>
                  <Text className="text-2xl font-bold text-foreground">$0.00</Text>
                </View>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
