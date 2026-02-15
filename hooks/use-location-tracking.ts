import { useEffect, useRef, useCallback } from "react";
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

  const stopLocationTracking = useCallback(() => {
    if (locationSubscription.current) {
      locationSubscription.current.remove();
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
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        console.error("Foreground location permission denied");
        return;
      }

      if (config.enableBackground) {
        const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
        if (backgroundStatus !== "granted") {
          console.warn("Background location permission denied, using foreground only");
        }
      }

      setIsLocationTracking(true);

      // Start watching position
      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: config.accuracy,
          timeInterval: config.timeInterval,
          distanceInterval: config.distanceInterval,
        },
        async (location) => {
          const { latitude, longitude, heading, speed } = location.coords;
          const newLocation = { lat: latitude, lng: longitude };

          // Throttle updates
          if (!shouldUpdateLocation(newLocation, mode)) {
            return;
          }

          // Update store
          setCurrentLocation({ latitude, longitude });

          // Update last position
          lastLocation.current = newLocation;
          lastUpdateTime.current = Date.now();

          // Update database for drivers
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

              // Insert location history
              await insertLocationHistory(currentUser.id.toString(), latitude, longitude, heading || 0, speed || 0);
            } catch (error) {
              console.error("Failed to update driver location:", error);
            }
          }
        }
      );
    } catch (error) {
      console.error("Failed to start location tracking:", error);
      setIsLocationTracking(false);
    }
  }, [activeRide, currentUser, getTrackingMode, getTrackingConfig, setCurrentLocation, setIsLocationTracking, shouldUpdateLocation]);

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
