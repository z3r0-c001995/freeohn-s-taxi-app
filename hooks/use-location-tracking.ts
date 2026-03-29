import { useEffect, useRef, useCallback } from "react";
import { Alert, Linking, Platform } from "react-native";
import * as Location from "expo-location";
import { useAppStore } from "@/lib/store";
import { updateDriverLocation, insertLocationHistory } from "@/lib/db-service";
import { updateDriverLocation as updateRemoteDriverLocation } from "@/lib/ride-hailing-api";

type TrackingMode = "rider_passive" | "driver_online" | "ride_in_progress";

export function useLocationTracking() {
  const {
    currentUser,
    activeRide,
    isLocationTracking,
    setIsLocationTracking,
    setCurrentLocation
  } = useAppStore();
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const webPollingTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastUpdateTime = useRef<number>(0);
  const lastLocation = useRef<{ lat: number; lng: number } | null>(null);

  const isRideInProgress = useCallback(() => {
    if (!activeRide) return false;
    const ride = activeRide as any;
    return ride?.status === "in_progress" || ride?.state === "IN_PROGRESS";
  }, [activeRide]);

  const getTrackingMode = useCallback((): TrackingMode => {
    if (isRideInProgress()) {
      return "ride_in_progress";
    }
    if (currentUser?.role === "driver") {
      return "driver_online";
    }
    return "rider_passive";
  }, [currentUser?.role, isRideInProgress]);

  const getTrackingConfig = useCallback((mode: TrackingMode) => {
    switch (mode) {
      case "ride_in_progress":
        return {
          accuracy: Location.Accuracy.High,
          timeInterval: 2000, // 2 seconds
          distanceInterval: 5, // 5 meters
          enableBackground: true,
        };
      case "driver_online":
        return {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 5000, // 5 seconds
          distanceInterval: 10, // 10 meters
          enableBackground: true,
        };
      case "rider_passive":
      default:
        return {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 30000, // 30 seconds
          distanceInterval: 100, // 100 meters
          enableBackground: false,
        };
    }
  }, []);

  const shouldUpdateLocation = useCallback((newLocation: { lat: number; lng: number }, mode: TrackingMode): boolean => {
    const now = Date.now();
    const config = getTrackingConfig(mode);
    const elapsedMs = now - lastUpdateTime.current;

    if (!lastLocation.current) {
      return true;
    }

    const distanceMeters =
      Math.sqrt(
        Math.pow(newLocation.lat - lastLocation.current.lat, 2) +
          Math.pow(newLocation.lng - lastLocation.current.lng, 2),
      ) * 111000; // Rough conversion to meters

    // Push updates immediately when movement exceeds the threshold.
    if (distanceMeters >= config.distanceInterval) {
      return true;
    }

    // Heartbeat update for realtime presence even when stationary.
    return elapsedMs >= config.timeInterval;
  }, [getTrackingConfig]);

  const processLocationUpdate = useCallback(
    async (
      latitude: number,
      longitude: number,
      heading: number | null | undefined,
      speed: number | null | undefined,
      mode: TrackingMode,
    ) => {
      if (!currentUser) return;
      const newLocation = { lat: latitude, lng: longitude };

      if (!shouldUpdateLocation(newLocation, mode)) {
        return;
      }

      setCurrentLocation({ latitude, longitude });
      lastLocation.current = newLocation;
      lastUpdateTime.current = Date.now();

      if (currentUser.role === "driver") {
        try {
          const tripId = activeRide?.id ? String(activeRide.id) : undefined;
          try {
            await updateRemoteDriverLocation({
              lat: latitude,
              lng: longitude,
              heading: heading ?? undefined,
              speed: speed ?? undefined,
              tripId,
            });
          } catch {
            await updateDriverLocation(currentUser.id.toString(), latitude, longitude);
          }

          await insertLocationHistory(
            currentUser.id.toString(),
            latitude,
            longitude,
            heading || 0,
            speed || 0,
          );
        } catch (error) {
          console.error("Failed to update driver location:", error);
        }
      }
    },
    [activeRide, currentUser, setCurrentLocation, shouldUpdateLocation],
  );

  const stopLocationTracking = useCallback(() => {
    if (webPollingTimer.current) {
      clearInterval(webPollingTimer.current);
      webPollingTimer.current = null;
    }

    if (locationSubscription.current) {
      try {
        if (typeof locationSubscription.current.remove === "function") {
          locationSubscription.current.remove();
        }
      } catch (error) {
        // Web runtime occasionally returns a stale emitter-backed subscription.
        // Continue cleanup instead of crashing the screen.
        console.warn("Location subscription cleanup failed:", error);
      }
      locationSubscription.current = null;
    }
    setIsLocationTracking(false);
  }, [setIsLocationTracking]);

  const startLocationTracking = useCallback(async () => {
    if (!currentUser) return;

    try {
      const mode = getTrackingMode();
      const config = getTrackingConfig(mode);

      // Request permissions based on mode
      const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        console.error("Foreground location permission denied");
        if (!canAskAgain) {
          Alert.alert(
            "Location Required",
            "Please enable location permissions in settings to track your ride.",
            [
              { text: "Cancel", style: "cancel" },
              { text: "Open Settings", onPress: () => Linking.openSettings() }
            ]
          );
        }
        return;
      }

      if (config.enableBackground && Platform.OS !== "web") {
        const { status: bgStatus, canAskAgain: bgCanAskAgain } = await Location.requestBackgroundPermissionsAsync();
        if (bgStatus !== "granted") {
          console.warn("Background location permission denied, using foreground only");
          if (!bgCanAskAgain) {
            Alert.alert(
              "Background Location Recommended",
              "For best results as a driver, please select 'Allow all the time' in settings.",
              [
                { text: "Cancel", style: "cancel" },
                { text: "Open Settings", onPress: () => Linking.openSettings() }
              ]
            );
          }
        }
      }

      setIsLocationTracking(true);

      if (Platform.OS === "web") {
        const poll = async () => {
          try {
            const location = await Location.getCurrentPositionAsync({
              accuracy: config.accuracy,
            });
            const { latitude, longitude, heading, speed } = location.coords;
            await processLocationUpdate(latitude, longitude, heading, speed, mode);
          } catch (error) {
            console.error("Failed to poll web location:", error);
          }
        };

        await poll();
        webPollingTimer.current = setInterval(() => {
          void poll();
        }, config.timeInterval);
        return;
      }

      // Start watching position
      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: config.accuracy,
          timeInterval: config.timeInterval,
          distanceInterval: config.distanceInterval,
        },
        async (location) => {
          const { latitude, longitude, heading, speed } = location.coords;
          await processLocationUpdate(latitude, longitude, heading, speed, mode);
        }
      );
    } catch (error) {
      console.error("Failed to start location tracking:", error);
      setIsLocationTracking(false);
    }
  }, [currentUser, getTrackingMode, getTrackingConfig, processLocationUpdate, setIsLocationTracking]);

  // Auto-manage tracking based on mode
  useEffect(() => {
    const mode = getTrackingMode();
    const shouldTrack = mode !== "rider_passive";

    if (shouldTrack && !isLocationTracking) {
      startLocationTracking();
    } else if (!shouldTrack && isLocationTracking) {
      stopLocationTracking();
    }

    return () => {
      stopLocationTracking();
    };
  }, [activeRide, currentUser, getTrackingMode, isLocationTracking, startLocationTracking, stopLocationTracking]);

  return {
    isTracking: isLocationTracking,
    mode: getTrackingMode(),
    startTracking: startLocationTracking,
    stopTracking: stopLocationTracking,
  };
}
