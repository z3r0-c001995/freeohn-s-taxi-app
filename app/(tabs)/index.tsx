import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Image, Platform, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";

import { ScreenContainer } from "@/components/screen-container";
import { RideMap } from "@/components/maps/RideMap";
import { AppButton } from "@/components/ui/app-button";
import { AppCard } from "@/components/ui/app-card";
import { APP_LABEL, IS_DRIVER_APP, IS_SEEKER_APP } from "@/constants/app-variant";
import { APP_LOGO } from "@/constants/brand-assets";
import { radii, shadows } from "@/constants/design-system";
import { useBrandTheme } from "@/hooks/use-brand-theme";
import { useLocationTracking } from "@/hooks/use-location-tracking";
import { useAppStore } from "@/lib/store";
import { trpc } from "@/lib/trpc";
import { calculateDistance } from "@/lib/ride-utils";
import {
  getAvailableRides,
  getDriverProfile,
  getRideById,
  setDriverOnlineStatus,
  startRide,
  acceptRide,
  completeRide,
} from "@/lib/db-service";
import {
  acceptDriverRequest,
  completeTrip as completeRemoteTrip,
  getDriverRequests,
  getNearbyDrivers,
  getTrip as getRemoteTrip,
  startTrip as startRemoteTrip,
  updateDriverStatus,
} from "@/lib/ride-hailing-api";
import type { NearbyDriverMarker } from "@/lib/maps/map-types";

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
  const brand = useBrandTheme();
  const defaultLocation = { latitude: -15.4162, longitude: 28.3115 };
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
  const trpcUtils = trpc.useUtils();
  const [availableRides, setAvailableRides] = useState<any[]>([]);
  const [nearbyDrivers, setNearbyDrivers] = useState<NearbyDriverMarker[]>([]);
  const [lastNearbyUpdate, setLastNearbyUpdate] = useState<string | null>(null);
  const [currentLocationAddress, setCurrentLocationAddress] = useState("Detecting your location...");
  const lastResolvedLocationKeyRef = useRef("");

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

  const loadAvailableRides = useCallback(async () => {
    if (currentUser?.role !== "driver" || !driverProfile?.isOnline) {
      return;
    }

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
  }, [currentUser?.role, driverProfile?.isOnline]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (driverProfile?.isOnline) {
        void loadAvailableRides();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [driverProfile?.isOnline, loadAvailableRides]);

  useEffect(() => {
    if (!IS_SEEKER_APP || !currentLocation || currentUser?.role !== "rider") {
      setNearbyDrivers([]);
      return;
    }

    let canceled = false;
    const run = async () => {
      try {
        const response = await getNearbyDrivers({
          pickup: { lat: currentLocation.latitude, lng: currentLocation.longitude },
          radiusKm: 6,
          limit: 16,
        });

        if (canceled) return;
        setNearbyDrivers(
          response.drivers.map((driver) => ({
            driverId: driver.driverId,
            lat: driver.location.lat,
            lng: driver.location.lng,
            distanceMeters: driver.distanceMeters,
            etaSeconds: driver.etaSeconds,
          })),
        );
        setLastNearbyUpdate(response.fetchedAt);
      } catch {
        if (!canceled) {
          setNearbyDrivers([]);
        }
      }
    };

    void run();
    const timer = setInterval(() => {
      void run();
    }, 6000);

    return () => {
      canceled = true;
      clearInterval(timer);
    };
  }, [currentLocation, currentUser?.role]);

  useEffect(() => {
    if (!currentLocation || currentUser?.role !== "rider") {
      setCurrentLocationAddress("Enable location to use precise pickup.");
      return;
    }

    const locationKey = `${currentLocation.latitude.toFixed(4)},${currentLocation.longitude.toFixed(4)}`;
    if (locationKey === lastResolvedLocationKeyRef.current) {
      return;
    }
    lastResolvedLocationKeyRef.current = locationKey;

    let cancelled = false;
    const resolve = async () => {
      try {
        const response = await trpcUtils.maps.reverseGeocode.fetch({
          lat: currentLocation.latitude,
          lng: currentLocation.longitude,
        });
        if (!cancelled) {
          setCurrentLocationAddress(response.address || "Current location");
        }
      } catch {
        if (!cancelled) {
          setCurrentLocationAddress("Current location");
        }
      }
    };

    void resolve();
    return () => {
      cancelled = true;
    };
  }, [currentLocation, currentUser?.role, trpcUtils]);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const location = await Location.getCurrentPositionAsync({});
        setCurrentLocation({ latitude: location.coords.latitude, longitude: location.coords.longitude });
      } else if (!currentLocation) {
        // Keep app usable for web testing when browser geolocation is blocked.
        setCurrentLocation(defaultLocation);
      }
    } catch (error) {
      console.error("Location permission error:", error);
      if (!currentLocation) {
        setCurrentLocation(defaultLocation);
      }
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

  const handleOpenRideHistory = () => {
    router.push("/ride-history" as never);
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
      const sourceLocation = currentLocation ?? defaultLocation;
      try {
        await updateDriverStatus({
          isOnline: newStatus,
          lat: newStatus ? sourceLocation.latitude : undefined,
          lng: newStatus ? sourceLocation.longitude : undefined,
        });
      } catch {
        if (Platform.OS === "web") {
          throw new Error("Unable to reach backend to update status.");
        }
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

  const today = new Date();
  const dateLabel = today.toLocaleDateString([], {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const timeLabel = today.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const gpsLabel = currentLocation
    ? `${currentLocation.latitude.toFixed(5)}, ${currentLocation.longitude.toFixed(5)}`
    : "Waiting for GPS lock";

  const todayCompleted = rideHistory.filter((ride) => ride.status === "completed").length;

  if (!currentUser) {
    return (
      <ScreenContainer className="bg-background items-center justify-center">
        <Text className="text-lg text-foreground">Loading...</Text>
      </ScreenContainer>
    );
  }

  const roleMismatch =
    (IS_SEEKER_APP && currentUser.role !== "rider") || (IS_DRIVER_APP && currentUser.role !== "driver");

  if (roleMismatch) {
    return (
      <ScreenContainer className="bg-background items-center justify-center px-6">
        <View style={{ alignItems: "center", gap: 12 }}>
          <Text style={{ fontSize: 24, fontWeight: "800", color: brand.text }}>{APP_LABEL}</Text>
          <Text style={{ textAlign: "center", color: brand.textMuted }}>
            This app only supports {IS_DRIVER_APP ? "driver" : "service seeker"} accounts.
          </Text>
          <AppButton label="Switch Account" onPress={handleResetProfile} fullWidth={false} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="bg-background" containerClassName="bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <View style={{ gap: 16, paddingBottom: 20 }}>
          {currentUser.role === "rider" ? (
            <>
              <View
                style={{
                  borderRadius: radii.xl,
                  padding: 18,
                  backgroundColor: "#0A1E49",
                  ...shadows.md,
                }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: "#CBD5E1", fontSize: 13, fontWeight: "600" }}>Welcome back</Text>
                    <Text style={{ marginTop: 5, color: "#FFFFFF", fontSize: 30, fontWeight: "800" }}>{currentUser.name}</Text>
                    <View style={{ marginTop: 5, flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Image
                        source={APP_LOGO}
                        style={{ width: 20, height: 20, borderRadius: 6, backgroundColor: "#FFFFFF" }}
                      />
                      <Text style={{ color: "#CBD5E1", fontSize: 12 }}>{APP_LABEL}</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => router.push("/(tabs)/settings")}
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 999,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: "rgba(255,255,255,0.16)",
                      borderWidth: 1,
                      borderColor: "rgba(255,255,255,0.18)",
                    }}
                  >
                    <Ionicons name="person" size={21} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>

                <View style={{ marginTop: 14, flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      borderRadius: 999,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      backgroundColor: "rgba(255,255,255,0.12)",
                    }}
                  >
                    <Ionicons name="calendar-outline" size={14} color="#CBD5E1" />
                    <Text style={{ color: "#CBD5E1", fontSize: 12, fontWeight: "600" }}>
                      {dateLabel} • {timeLabel}
                    </Text>
                  </View>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      borderRadius: 999,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      backgroundColor: "rgba(255,255,255,0.12)",
                    }}
                  >
                    <Ionicons name="navigate-circle-outline" size={14} color="#CBD5E1" />
                    <Text style={{ color: "#CBD5E1", fontSize: 12, fontWeight: "600" }}>GPS {isTracking ? "active" : "idle"}</Text>
                  </View>
                </View>

                <View style={{ marginTop: 14, flexDirection: "row", gap: 10 }}>
                  <View
                    style={{
                      flex: 1,
                      borderRadius: radii.lg,
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      backgroundColor: "rgba(255,255,255,0.12)",
                    }}
                  >
                    <Text style={{ color: "#CBD5E1", fontSize: 11 }}>Nearby drivers</Text>
                    <Text style={{ marginTop: 4, color: "#FFFFFF", fontSize: 18, fontWeight: "800" }}>
                      {nearbyDrivers.length}
                    </Text>
                  </View>
                  <View
                    style={{
                      flex: 1,
                      borderRadius: radii.lg,
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      backgroundColor: "rgba(255,255,255,0.12)",
                    }}
                  >
                    <Text style={{ color: "#CBD5E1", fontSize: 11 }}>Tracking status</Text>
                    <Text style={{ marginTop: 4, color: "#FFFFFF", fontSize: 18, fontWeight: "800" }}>
                      {isTracking ? "Online" : "Idle"}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={{ borderRadius: radii.xl, overflow: "hidden", borderWidth: 1, borderColor: brand.border }}>
                <RideMap
                  userLocation={currentLocation ? { lat: currentLocation.latitude, lng: currentLocation.longitude } : undefined}
                  nearbyDrivers={nearbyDrivers}
                  style={{ height: 320 }}
                />
              </View>

              <AppCard>
                <Text style={{ fontSize: 18, fontWeight: "800", color: brand.text }}>Book a Ride</Text>
                <Text style={{ marginTop: 6, fontSize: 13, color: brand.textMuted }}>
                  Pickup: {currentLocationAddress}
                </Text>
                <Text style={{ marginTop: 2, fontSize: 13, color: brand.textMuted }}>
                  Live tracking: {isTracking ? "Active" : "Idle"}
                </Text>

                <View style={{ marginTop: 14 }}>
                  <AppButton label="Request Ride" onPress={handleRequestRide} leftIcon={<Ionicons name="car-sport" size={16} color="#FFFFFF" />} />
                </View>

                <View style={{ marginTop: 10, flexDirection: "row", gap: 10 }}>
                  <AppButton
                    label="Safety"
                    variant="outline"
                    fullWidth={false}
                    style={{ flex: 1 }}
                    onPress={handleOpenSafetyCenter}
                  />
                  <AppButton
                    label="History"
                    variant="outline"
                    fullWidth={false}
                    style={{ flex: 1 }}
                    onPress={handleOpenRideHistory}
                  />
                </View>

                {lastNearbyUpdate ? (
                  <Text style={{ marginTop: 10, fontSize: 11, color: brand.textMuted }}>
                    Nearby updated: {new Date(lastNearbyUpdate).toLocaleTimeString()}
                  </Text>
                ) : null}
              </AppCard>

              {activeRide ? (
                <AppCard tone="accent">
                  <Text style={{ fontSize: 16, fontWeight: "800", color: brand.text }}>Current Trip</Text>
                  <Text style={{ marginTop: 8, fontSize: 13, color: brand.textMuted }}>
                    Pickup: {activeRide.pickupAddress ?? "Pickup location selected"}
                  </Text>
                  <Text style={{ marginTop: 3, fontSize: 13, color: brand.textMuted }}>
                    Dropoff: {activeRide.dropoffAddress ?? "Dropoff location selected"}
                  </Text>
                  <Text style={{ marginTop: 8, fontSize: 24, fontWeight: "800", color: brand.text }}>
                    ${activeRide.fareAmount.toFixed(2)}
                  </Text>

                  <View style={{ marginTop: 12 }}>
                    <AppButton label="Track Trip" variant="secondary" onPress={handleOpenTripCenter} />
                  </View>
                  {activeRide.driverId ? (
                    <View style={{ marginTop: 8 }}>
                      <AppButton label="Chat Driver" variant="outline" onPress={() => router.push("/(tabs)/chat")} />
                    </View>
                  ) : null}
                </AppCard>
              ) : null}

              <AppCard tone="muted">
                <Text style={{ fontSize: 14, fontWeight: "700", color: brand.text }}>Ride Stats</Text>
                <View style={{ marginTop: 8, flexDirection: "row", gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, color: brand.textMuted }}>Completed today</Text>
                    <Text style={{ marginTop: 2, fontSize: 22, fontWeight: "800", color: brand.text }}>{todayCompleted}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, color: brand.textMuted }}>Payment</Text>
                    <Text style={{ marginTop: 2, fontSize: 15, fontWeight: "700", color: brand.text }}>Cash</Text>
                  </View>
                </View>
              </AppCard>
            </>
          ) : (
            <>
              <View
                style={{
                  borderRadius: radii.xl,
                  padding: 18,
                  backgroundColor: "#0F1E4A",
                  ...shadows.md,
                }}
              >
                <Text style={{ color: "#CBD5E1", fontSize: 13 }}>Welcome back</Text>
                <Text style={{ marginTop: 4, color: "#FFFFFF", fontSize: 30, fontWeight: "800" }}>{currentUser.name}</Text>
                <Text style={{ marginTop: 6, color: "#CBD5E1", fontSize: 13 }}>
                  {driverProfile?.isOnline ? "Online and receiving requests" : "Offline"}
                </Text>
                <View style={{ marginTop: 12 }}>
                  <AppButton
                    label={driverProfile?.isOnline ? "Go Offline" : "Go Online"}
                    variant={driverProfile?.isOnline ? "danger" : "success"}
                    onPress={handleToggleOnline}
                  />
                </View>
              </View>

              <AppCard>
                <Text style={{ fontSize: 16, fontWeight: "800", color: brand.text }}>Driver Dispatch</Text>
                <Text style={{ marginTop: 8, fontSize: 13, color: brand.textMuted }}>
                  Date: {dateLabel} • {timeLabel}
                </Text>
                <Text style={{ marginTop: 4, fontSize: 13, color: brand.textMuted }}>GPS: {gpsLabel}</Text>
                <Text style={{ marginTop: 4, fontSize: 13, color: brand.textMuted }}>
                  Tracking: {isTracking ? "Active" : "Idle"}
                </Text>
                <View style={{ marginTop: 12 }}>
                  <AppButton label="Open Driver Dashboard" variant="secondary" onPress={handleOpenDriverDispatch} />
                </View>
              </AppCard>

              {availableRides.length > 0 ? (
                <AppCard>
                  <Text style={{ fontSize: 16, fontWeight: "800", color: brand.text }}>Incoming Requests</Text>
                  <View style={{ marginTop: 10, gap: 10 }}>
                    {availableRides.map((ride) => {
                      const pickupDistanceKm =
                        driverProfile?.currentLat && driverProfile?.currentLng
                          ? calculateDistance(
                              parseFloat(driverProfile.currentLat),
                              parseFloat(driverProfile.currentLng),
                              parseFloat(ride.pickupLat),
                              parseFloat(ride.pickupLng),
                            )
                          : 0;

                      return (
                        <View
                          key={String(ride.id)}
                          style={{
                            borderRadius: radii.md,
                            borderWidth: 1,
                            borderColor: brand.border,
                            backgroundColor: brand.surfaceMuted,
                            padding: 12,
                          }}
                        >
                          <Text style={{ fontSize: 14, fontWeight: "700", color: brand.text }}>Ride {String(ride.id).slice(-6)}</Text>
                          <Text style={{ marginTop: 5, fontSize: 12, color: brand.textMuted }}>
                            Pickup {ride.pickupAddress ?? `${ride.pickupLat}, ${ride.pickupLng}`}
                          </Text>
                          <Text style={{ marginTop: 2, fontSize: 12, color: brand.textMuted }}>
                            Distance to pickup {pickupDistanceKm.toFixed(1)} km
                          </Text>
                          <View style={{ marginTop: 10, flexDirection: "row", gap: 8 }}>
                            <AppButton
                              label="Accept"
                              variant="success"
                              fullWidth={false}
                              style={{ flex: 1 }}
                              onPress={() => handleAcceptRide(String(ride.id))}
                            />
                            <AppButton
                              label="Decline"
                              variant="danger"
                              fullWidth={false}
                              style={{ flex: 1 }}
                              onPress={() => handleDeclineRide(String(ride.id))}
                            />
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </AppCard>
              ) : null}

              {activeRide ? (
                <AppCard tone="accent">
                  <Text style={{ fontSize: 16, fontWeight: "800", color: brand.text }}>Active Trip</Text>
                  <Text style={{ marginTop: 6, fontSize: 13, color: brand.textMuted }}>
                    Pickup: {activeRide.pickupAddress ?? "Pickup location"}
                  </Text>
                  <Text style={{ marginTop: 2, fontSize: 13, color: brand.textMuted }}>
                    Dropoff: {activeRide.dropoffAddress ?? "Dropoff location"}
                  </Text>
                  <Text style={{ marginTop: 8, fontSize: 24, fontWeight: "800", color: brand.text }}>
                    ${activeRide.fareAmount.toFixed(2)}
                  </Text>
                  {activeRide.status === "accepted" ? (
                    <View style={{ marginTop: 10 }}>
                      <AppButton label="Start Trip" variant="secondary" onPress={() => handleStartRide(activeRide.id.toString())} />
                    </View>
                  ) : null}
                  {activeRide.status === "in_progress" ? (
                    <View style={{ marginTop: 10 }}>
                      <AppButton label="Complete Trip" variant="success" onPress={() => handleCompleteRide(activeRide.id.toString())} />
                    </View>
                  ) : null}
                </AppCard>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
