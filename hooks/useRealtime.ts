import { useEffect, useState } from "react";
import { subscribeToRide, type RideRow } from "@/lib/rides";
import { subscribeToDriverLocation } from "@/lib/drivers";

export function useRealtimeRide(rideId?: string | null) {
  const [ride, setRide] = useState<RideRow | null>(null);

  useEffect(() => {
    if (!rideId) return;

    const unsubscribe = subscribeToRide(rideId, (updatedRide) => {
      setRide(updatedRide);
    });

    return () => {
      unsubscribe();
    };
  }, [rideId]);

  return { ride, setRide };
}

export function useRealtimeDriverLocation(driverId?: string | null) {
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
    heading?: number;
    speed?: number;
  } | null>(null);

  useEffect(() => {
    if (!driverId) return;

    const unsubscribe = subscribeToDriverLocation(driverId, (newLoc) => {
      setLocation(newLoc);
    });

    return () => {
      unsubscribe();
    };
  }, [driverId]);

  return { location };
}
