import { useCallback, useEffect, useState } from "react";
import { getTrip, createTripStream } from "@/lib/ride-hailing-api";
import { connectTripSocket } from "@/lib/realtime/trip-socket";

type UseTripRealtimeOptions = {
  pollIntervalMs?: number;
};

type DriverLocation = {
  tripId: string;
  driverId: string;
  lat: number;
  lng: number;
  heading: number | null;
  speed: number | null;
  timestamp: string;
};

export function useTripRealtime(tripId: string | null, options: UseTripRealtimeOptions = {}) {
  const pollIntervalMs = options.pollIntervalMs ?? 4000;
  const [trip, setTrip] = useState<any | null>(null);
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transport, setTransport] = useState<"websocket" | "sse" | "polling">("polling");

  const refresh = useCallback(async () => {
    if (!tripId) return;
    try {
      setIsLoading(true);
      const nextTrip = await getTrip(tripId);
      setTrip(nextTrip);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch trip");
    } finally {
      setIsLoading(false);
    }
  }, [tripId]);

  const handleRealtimeEvent = useCallback((event: any) => {
    if (!event || typeof event !== "object") return;

    if (event.type === "trip.updated" && event.trip) {
      setTrip(event.trip);
      return;
    }
    if (event.type === "snapshot" && event.trip) {
      setTrip(event.trip);
      return;
    }
    if (event.type === "driver.location") {
      setDriverLocation({
        tripId: String(event.tripId),
        driverId: String(event.driverId),
        lat: Number(event.lat),
        lng: Number(event.lng),
        heading: typeof event.heading === "number" ? event.heading : null,
        speed: typeof event.speed === "number" ? event.speed : null,
        timestamp: String(event.timestamp ?? new Date().toISOString()),
      });
    }
  }, []);

  useEffect(() => {
    if (!tripId) return;

    let unsubscribeSocket: (() => void) | null = null;
    let unsubscribeStream: (() => void) | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const startSseFallback = () => {
      if (unsubscribeStream) return;
      unsubscribeStream = createTripStream(tripId, handleRealtimeEvent);
      if (unsubscribeStream) {
        setTransport("sse");
      }
    };

    const start = async () => {
      await refresh();

      try {
        unsubscribeSocket = await connectTripSocket({
          tripId,
          onEvent: handleRealtimeEvent,
          onConnected: () => {
            setTransport("websocket");
            if (unsubscribeStream) {
              unsubscribeStream();
              unsubscribeStream = null;
            }
          },
          onError: () => {
            startSseFallback();
          },
        });
      } catch {
        startSseFallback();
      }

      // Polling fallback for Android/native and unreliable stream networks.
      pollTimer = setInterval(() => {
        void refresh();
      }, pollIntervalMs);
    };

    void start();

    return () => {
      if (unsubscribeSocket) unsubscribeSocket();
      if (unsubscribeStream) unsubscribeStream();
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [handleRealtimeEvent, pollIntervalMs, refresh, tripId]);

  return {
    trip,
    driverLocation,
    isLoading,
    error,
    transport,
    refresh,
  };
}
