import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Image, Linking, Platform, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";

import { ScreenContainer } from "@/components/screen-container";
import { RideMap } from "@/components/maps/RideMap";
import { DriverNavBar } from "@/components/navigation/DriverNavBar";
import { PassengerNavBar } from "@/components/navigation/PassengerNavBar";
import { AppButton } from "@/components/ui/app-button";
import { AppCard } from "@/components/ui/app-card";
import { APP_LABEL, IS_DRIVER_APP, IS_SEEKER_APP } from "@/constants/app-variant";
import { APP_LOGO } from "@/constants/brand-assets";
import { radii, shadows } from "@/constants/design-system";
import { useBrandTheme } from "@/hooks/use-brand-theme";
import { useLocationTracking } from "@/hooks/use-location-tracking";
import { useAppStore } from "@/lib/store";
import { trpc } from "@/lib/trpc";
import { calculateDistance, mapRemoteTripToLocal } from "@/lib/ride-utils";
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
import type { NearbyDriverMarker, PlaceDetails } from "@/lib/maps/map-types";
import { PlaceSearchInput } from "@/components/places/PlaceSearchInput";



export default function HomeScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const brand = useBrandTheme();
  // Default to Mansa District, Luapula Province, Zambia — the app's launch area
  const defaultLocation = { latitude: -11.197, longitude: 28.891 };
  const {
    currentUser,
    setCurrentLocation,
    currentLocation,
    isAuthenticated,
    isHydrated,
    driverProfile,
    setDriverProfile,
    activeRide,
    setActiveRide,
    addRideToHistory,
    setCurrentUser,
    setIsAuthenticated,
    persist,
    rideHistory,
    savedLocations,
  } = useAppStore();

  const { isTracking } = useLocationTracking();
  const trpcUtils = trpc.useUtils();
  const [availableRides, setAvailableRides] = useState<any[]>([]);
  const [nearbyDrivers, setNearbyDrivers] = useState<NearbyDriverMarker[]>([]);
  const [lastNearbyUpdate, setLastNearbyUpdate] = useState<string | null>(null);
  const [currentLocationAddress, setCurrentLocationAddress] = useState("Detecting your location...");
  const lastResolvedLocationKeyRef = useRef("");

  useEffect(() => {
    if (!isHydrated) return; // Wait for store to hydrate from AsyncStorage

    if (!isAuthenticated) {
      // Avoid forcing onboarding when the app is opened directly on admin tooling routes.
      if (pathname.startsWith("/admin")) {
        return;
      }
      router.replace("/(auth)/onboarding");
      return;
    }

    // Driver app: redirect home tab straight to the driver dashboard
    if (IS_DRIVER_APP) {
      router.replace("/driver-dashboard" as never);
      return;
    }

    void requestLocationPermission();
    void loadDriverProfile();
  }, [isAuthenticated, pathname, router]);

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
      const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const location = await Location.getCurrentPositionAsync({});
        setCurrentLocation({ latitude: location.coords.latitude, longitude: location.coords.longitude });
      } else {
        if (!canAskAgain) {
          Alert.alert(
            "Location Permission Required",
            "Please enable location services in your device settings to use this app.",
            [
              { text: "Cancel", style: "cancel" },
              { text: "Open Settings", onPress: () => Linking.openSettings() }
            ]
          );
        }
        if (!currentLocation) {
          // Keep app usable for web testing when browser geolocation is blocked.
          setCurrentLocation(defaultLocation);
        }
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
      await persist();
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
        await persist();
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
        await persist();
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
      {/* Background Glows for Premium Feel */}
      <View style={{ position: "absolute", top: -100, right: -50, width: 300, height: 300, borderRadius: 150, backgroundColor: "rgba(247, 115, 22, 0.08)" }} />
      <View style={{ position: "absolute", bottom: 100, left: -100, width: 400, height: 400, borderRadius: 200, backgroundColor: "rgba(30, 64, 175, 0.05)" }} />

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 60, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Header Section */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 32, fontWeight: "800", color: brand.text }}>Hello, {currentUser.name?.split(' ')[0] || 'User'}</Text>
          <Text style={{ fontSize: 16, color: brand.textMuted, marginTop: 4 }}>Ready to book a ride?</Text>
        </View>

        {/* Interactive Destination Search Card */}
        <AppCard style={{ marginBottom: 20, padding: 14, overflow: "visible", zIndex: 50 }}>
          <Text style={{ fontSize: 13, fontWeight: "800", color: brand.text, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Book a Ride
          </Text>
          <PlaceSearchInput
            placeholder="Where to? (e.g. East Park Mall, Airport)"
            onPlaceSelect={(place: PlaceDetails) => {
              router.push(
                `/request-ride?dest=${encodeURIComponent(place.formatted_address)}&destLat=${place.geometry.location.lat}&destLng=${place.geometry.location.lng}` as never
              );
            }}
            userLocation={currentLocation ? { lat: currentLocation.latitude, lng: currentLocation.longitude } : undefined}
            dotColor={brand.accent}
            icon="search"
          />
        </AppCard>

        {/* Home/Work Shortcuts */}
        {IS_SEEKER_APP && (
          <View style={{ flexDirection: "row", gap: 12, marginBottom: 24 }}>
            {(['home', 'work'] as const).map((label) => {
              const saved = savedLocations[label];
              const icon = label === 'home' ? 'home' : 'briefcase';
              const bg   = label === 'home' ? '#FFF7ED' : '#EFF6FF';
              const color = label === 'home' ? brand.primary : brand.accent;
              const chipLabel = saved ? label.charAt(0).toUpperCase() + label.slice(1) : `Add ${label}`;
              return (
                <TouchableOpacity
                  key={label}
                  onPress={() => {
                    if (saved) {
                      // Navigate to request-ride pre-filled with this destination
                      router.push(`/request-ride?dest=${encodeURIComponent(saved.address)}&destLat=${saved.lat}&destLng=${saved.lng}` as never);
                    } else {
                      router.push('/request-ride' as never);
                    }
                  }}
                  style={{ flex: 1, backgroundColor: brand.surface, borderRadius: radii.xl, padding: 16, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: brand.border, ...shadows.md }}
                >
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: bg, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name={icon as any} size={18} color={color} />
                  </View>
                  <Text style={{ marginLeft: 12, fontWeight: "700", color: saved ? brand.text : brand.textMuted, fontSize: 14 }}>{chipLabel}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Quick Actions */}
        <View style={{ marginBottom: 32 }}>
          <Text style={{ fontSize: 18, fontWeight: "800", color: brand.text, marginBottom: 16 }}>Quick Actions</Text>
          <View style={{ flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            {[
              { id: 'history', label: 'Receipts', icon: 'receipt', color: '#F97316', bg: '#FFF7ED', action: handleOpenRideHistory },
              { id: 'promos', label: 'Promotions', icon: 'pricetag', color: '#22C55E', bg: '#F0FDF4', action: () => router.push('/promotions' as never) },
              { id: 'favourites', label: 'Favourites', icon: 'heart', color: '#EF4444', bg: '#FFF1F2', action: () => router.push('/favourites' as never) },
              { id: 'invite', label: 'Invite Friends', icon: 'person-add', color: '#8B5CF6', bg: '#F5F3FF', action: () => router.push('/invite-friends' as never) },
            ].map((item) => (
              <TouchableOpacity key={item.id} onPress={item.action} style={{ alignItems: "center", width: 100 }}>
                <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: item.bg, alignItems: "center", justifyContent: "center", marginBottom: 8, ...shadows.sm }}>
                  <Ionicons name={item.icon as any} size={28} color={item.color} />
                </View>
                <Text style={{ fontSize: 12, fontWeight: "600", color: brand.textMuted, textAlign: "center" }}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Referral Card */}
        <AppCard tone="primary" style={{ overflow: "hidden", padding: 0 }}>
          <View style={{ padding: 20, flex: 1 }}>
            <Text style={{ fontSize: 20, fontWeight: "800", color: brand.text }}>Earn Free Rides!</Text>
            <Text style={{ fontSize: 14, color: brand.textMuted, marginTop: 8, marginBottom: 16, lineHeight: 20 }}>
              Refer friends and get free rides together. Share your referral code now!
            </Text>
            <AppButton 
              label="Invite Friends" 
              fullWidth={false} 
              size="sm" 
              onPress={() => {}} 
              style={{ paddingHorizontal: 24, borderRadius: radii.md }} 
            />
          </View>
          <View style={{ position: "absolute", right: -20, bottom: -10, width: 150, height: 120 }}>
             <Ionicons name="people" size={120} color="rgba(247, 115, 22, 0.1)" />
          </View>
        </AppCard>

        {/* Live Interactive Map Preview */}
        <View style={{ marginTop: 24, borderRadius: radii.xl, overflow: "hidden", borderWidth: 1, borderColor: brand.border, ...shadows.md }}>
          <View style={{ padding: 14, backgroundColor: brand.surface, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View>
              <Text style={{ fontSize: 16, fontWeight: "800", color: brand.text }}>Nearby Drivers & Map</Text>
              <Text style={{ fontSize: 12, color: brand.textMuted, marginTop: 2 }}>
                {nearbyDrivers.length > 0 ? `${nearbyDrivers.length} drivers active nearby` : "Tap map to choose pickup or destination"}
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleRequestRide}
              style={{ backgroundColor: brand.primary, paddingHorizontal: 14, paddingVertical: 6, borderRadius: radii.md }}
            >
              <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 12 }}>Open Booking</Text>
            </TouchableOpacity>
          </View>
          <RideMap
            userLocation={currentLocation ? { lat: currentLocation.latitude, lng: currentLocation.longitude } : undefined}
            nearbyDrivers={nearbyDrivers}
            interactivePlaceSelection={true}
            showControls={true}
            onPickupSelect={(loc) => {
              router.push(`/request-ride?pickupLat=${loc.lat}&pickupLng=${loc.lng}` as never);
            }}
            onDropoffSelect={(loc) => {
              router.push(`/request-ride?destLat=${loc.lat}&destLng=${loc.lng}` as never);
            }}
            style={{ height: 280 }}
          />
        </View>
      </ScrollView>
      {IS_DRIVER_APP ? <DriverNavBar /> : <PassengerNavBar />}
    </ScreenContainer>
  );
}
