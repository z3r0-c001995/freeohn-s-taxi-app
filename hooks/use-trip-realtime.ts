import { useCallback, useEffect, useState } from "react";
import { getTrip, createTripStream } from "@/lib/ride-hailing-api";

type UseTripRealtimeOptions = {
  pollIntervalMs?: number;
};

export function useTripRealtime(tripId: string | null, options: UseTripRealtimeOptions = {}) {
  const pollIntervalMs = options.pollIntervalMs ?? 4000;
  const [trip, setTrip] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    if (!tripId) return;

    let unsubscribeStream: (() => void) | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const start = async () => {
      await refresh();

      unsubscribeStream = createTripStream(tripId, (event) => {
        if (event?.type === "trip.updated" && event.trip) {
          setTrip(event.trip);
        }
        if (event?.type === "snapshot" && event.trip) {
          setTrip(event.trip);
        }
      });

      // Polling fallback for Android/native and unreliable stream networks.
      pollTimer = setInterval(() => {
        void refresh();
      }, pollIntervalMs);
    };

    void start();

    return () => {
      if (unsubscribeStream) unsubscribeStream();
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [pollIntervalMs, refresh, tripId]);

  return {
    trip,
    isLoading,
    error,
    refresh,
  };
}

