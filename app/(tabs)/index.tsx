import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Location from "expo-location";

import { ScreenContainer } from "@/components/screen-container";
import { DriverNavBar } from "@/components/navigation/DriverNavBar";
import { PassengerNavBar } from "@/components/navigation/PassengerNavBar";
import { PassengerServiceGrid } from "@/components/passenger/PassengerServiceGrid";
import { PassengerPromoBanners } from "@/components/passenger/PassengerPromoBanners";
import { AppButton } from "@/components/ui/app-button";
import { APP_LABEL, IS_DRIVER_APP, IS_SEEKER_APP } from "@/constants/app-variant";
import { radii, shadows } from "@/constants/design-system";
import { useBrandTheme } from "@/hooks/use-brand-theme";
import { useLocationTracking } from "@/hooks/use-location-tracking";
import { useAppStore } from "@/lib/store";
import { trpc } from "@/lib/trpc";
import { mapRemoteTripToLocal } from "@/lib/ride-utils";
import {
  getAvailableRides,
  getDriverProfile,
  getRideById,
  startRide,
  completeRide,
} from "@/lib/db-service";
import {
  completeTrip as completeRemoteTrip,
  getDriverRequests,
  getNearbyDrivers,
  getTrip as getRemoteTrip,
  startTrip as startRemoteTrip,
} from "@/lib/ride-hailing-api";
import type { NearbyDriverMarker } from "@/lib/maps/map-types";

// Suggested destinations based on real Lusaka & Mansa points of interest
const POPULAR_DESTINATIONS = [
  {
    id: "lifestyle",
    name: "Lifestyle Health & Fitness",
    address: "Lusaka, University of Zambia",
    lat: -15.395,
    lng: 28.332,
    icon: "dumbbell" as const,
    iconType: "material" as const,
    iconColor: "#64748B",
    bg: "#F1F5F9",
  },
  {
    id: "kfc",
    name: "Kentucky Fried Chicken",
    address: "Manda Hill Mall, Great East Road, Lusaka",
    lat: -15.401,
    lng: 28.307,
    icon: "silverware-fork-knife" as const,
    iconType: "material" as const,
    iconColor: "#64748B",
    bg: "#F1F5F9",
  },
  {
    id: "eastpark",
    name: "East Park Mall",
    address: "Great East Road, Lusaka",
    lat: -15.392,
    lng: 28.327,
    icon: "shopping" as const,
    iconType: "material" as const,
    iconColor: "#64748B",
    bg: "#F1F5F9",
  },
];

export default function HomeScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const brand = useBrandTheme();
  const defaultLocation = { latitude: -15.3875, longitude: 28.3228 }; // Default to Lusaka hub
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
    savedLocations,
  } = useAppStore();

  const { isTracking } = useLocationTracking();
  const trpcUtils = trpc.useUtils();
  const [availableRides, setAvailableRides] = useState<any[]>([]);
  const [nearbyDrivers, setNearbyDrivers] = useState<NearbyDriverMarker[]>([]);
  const [currentLocationAddress, setCurrentLocationAddress] = useState("Kaunda Square Stage 1, 9061");
  const lastResolvedLocationKeyRef = useRef("");

  useEffect(() => {
    if (!isHydrated) return;

    if (!isAuthenticated) {
      if (pathname.startsWith("/admin")) {
        return;
      }
      router.replace("/(auth)/onboarding");
      return;
    }

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
      setCurrentLocationAddress("Kaunda Square Stage 1, 9061");
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
        if (!cancelled && response.address) {
          setCurrentLocationAddress(response.address);
        }
      } catch {
        if (!cancelled) {
          setCurrentLocationAddress("Kaunda Square Stage 1, 9061");
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

  const handleStartRide = async (rideId: string) => {
    try {
      let updatedRide: any = null;
      try {
        const remote = await startRemoteTrip(rideId, { pin: "" });
        updatedRide = mapRemoteTripToLocal(remote.trip ?? remote);
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

  const handleSelectSuggestedPlace = (place: (typeof POPULAR_DESTINATIONS)[0]) => {
    router.push(
      `/request-ride?dest=${encodeURIComponent(place.name)}&destLat=${place.lat}&destLng=${place.lng}` as never,
    );
  };

  const handleOpenSearch = () => {
    router.push("/request-ride" as never);
  };

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
          <AppButton label="Switch Account" onPress={() => router.push("/(auth)/onboarding")} fullWidth={false} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="bg-background" containerClassName="bg-background">
      <View style={styles.mainWrapper}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* 1. Header Bar: Menu Icon, Stylized FREEOHN Logo, and Current Location */}
          <View style={styles.headerRow}>
            {/* Left Hamburger Icon */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => router.push("/settings" as never)}
              style={styles.menuButton}
            >
              <Ionicons name="menu" size={28} color="#0F172A" />
            </TouchableOpacity>

            {/* Center Brand Logo & Location Subtitle */}
            <View style={styles.brandCenterContainer}>
              <Text style={styles.brandTitleText}>FREEOHN</Text>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleOpenSearch}
                style={styles.locationSubtitleRow}
              >
                <Text style={styles.locationSubtitleText} numberOfLines={1}>
                  {currentLocationAddress}
                </Text>
                <Ionicons name="chevron-forward" size={14} color="#0F172A" style={{ marginLeft: 2 }} />
              </TouchableOpacity>
            </View>

            {/* Right Placeholder for visual symmetry */}
            <View style={{ width: 40 }} />
          </View>

          {/* 2. Service Category Grid (Shops, Delivery, Navigation, Food, Games, Cargo, Rides) */}
          <PassengerServiceGrid />

          {/* 3. "Where to?" Search Pill Card */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleOpenSearch}
            style={styles.whereToCard}
          >
            <View style={styles.whereToLeft}>
              <View style={styles.whereToCarIconContainer}>
                <Ionicons name="car" size={24} color="#DC2626" />
              </View>
              <Text style={styles.whereToText}>Where to?</Text>
            </View>

            <View style={styles.whereToRightCircle}>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </View>
          </TouchableOpacity>

          {/* 4. Recent / Popular Suggested Destinations */}
          <View style={styles.destinationsContainer}>
            {POPULAR_DESTINATIONS.map((item, idx) => (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.7}
                onPress={() => handleSelectSuggestedPlace(item)}
                style={[
                  styles.destinationRow,
                  idx !== POPULAR_DESTINATIONS.length - 1 && styles.destinationDivider,
                ]}
              >
                <View style={[styles.destIconContainer, { backgroundColor: item.bg }]}>
                  <MaterialCommunityIcons name={item.icon} size={22} color={item.iconColor} />
                </View>
                <View style={styles.destInfoColumn}>
                  <Text style={styles.destTitleText} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.destAddressText} numberOfLines={1}>
                    {item.address}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* 5. Promotional Banners & Food Specials */}
          <PassengerPromoBanners />
        </ScrollView>

        {/* 6. Standard 5-tab Bottom Navigation */}
        {IS_DRIVER_APP ? <DriverNavBar /> : <PassengerNavBar />}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  mainWrapper: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    paddingTop: 4,
  },
  menuButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  brandCenterContainer: {
    alignItems: "center",
    flex: 1,
  },
  brandTitleText: {
    fontSize: 28,
    fontWeight: "900",
    color: "#EA580C", // Vibrant Yango/Freeohn brand red-orange
    fontStyle: "italic",
    letterSpacing: -0.5,
  },
  locationSubtitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
    maxWidth: 240,
  },
  locationSubtitleText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0F172A",
  },
  whereToCard: {
    backgroundColor: "#F1F5F9",
    borderRadius: 24,
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  whereToLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  whereToCarIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  whereToText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  whereToRightCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
  },
  destinationsContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  destinationRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },
  destinationDivider: {
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  destIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  destInfoColumn: {
    flex: 1,
  },
  destTitleText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 2,
  },
  destAddressText: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "500",
  },
});
