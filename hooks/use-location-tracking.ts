import { useEffect, useRef, useCallback } from "react";
import * as Location from "expo-location";
import { useAppStore } from "@/lib/store";
import { updateDriverLocation, insertLocationHistory } from "@/lib/db-service";

type TrackingMode = "rider_passive" | "driver_online" | "ride_in_progress";

export function useLocationTracking() {
  const {
    currentUser,
    driverProfile,
    activeRide,
    isLocationTracking,
    setIsLocationTracking,
    setCurrentLocation
  } = useAppStore();
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const lastUpdateTime = useRef<number>(0);
  const lastLocation = useRef<{ lat: number; lng: number } | null>(null);

  const getTrackingMode = useCallback((): TrackingMode => {
    if (activeRide && activeRide.status === "in_progress") {
      return "ride_in_progress";
    }
    if (currentUser?.role === "driver" && driverProfile?.isOnline) {
      return "driver_online";
    }
    return "rider_passive";
  }, [currentUser?.role, driverProfile?.isOnline, activeRide]);

  const getTrackingConfig = (mode: TrackingMode) => {
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
          timeInterval: 10000, // 10 seconds
          distanceInterval: 50, // 50 meters
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
  };

  const shouldUpdateLocation = (newLocation: { lat: number; lng: number }, mode: TrackingMode): boolean => {
    const now = Date.now();
    const config = getTrackingConfig(mode);

    // Check time interval
    if (now - lastUpdateTime.current < config.timeInterval) {
      return false;
    }

    // Check distance interval
    if (lastLocation.current) {
      const distance = Math.sqrt(
        Math.pow(newLocation.lat - lastLocation.current.lat, 2) +
        Math.pow(newLocation.lng - lastLocation.current.lng, 2)
      ) * 111000; // Rough conversion to meters
      if (distance < config.distanceInterval) {
        return false;
      }
    }

    return true;
  };

  const startLocationTracking = async () => {
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
              await updateDriverLocation(currentUser.id.toString(), latitude, longitude);

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
  };

  const stopLocationTracking = () => {
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }
    setIsLocationTracking(false);
  };

  // Auto-manage tracking based on mode
  useEffect(() => {
    const mode = getTrackingMode();
    const shouldTrack = mode !== "rider_passive" || currentUser?.role === "driver";

    if (shouldTrack && !isLocationTracking) {
      startLocationTracking();
    } else if (!shouldTrack && isLocationTracking) {
      stopLocationTracking();
    }

    return () => {
      stopLocationTracking();
    };
  }, [getTrackingMode, isLocationTracking, currentUser]);

  return {
    isTracking: isLocationTracking,
    mode: getTrackingMode(),
    startTracking: startLocationTracking,
    stopTracking: stopLocationTracking,
  };
}