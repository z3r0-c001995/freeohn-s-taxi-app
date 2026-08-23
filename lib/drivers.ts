import { supabase } from "./supabase";
import type { Database } from "@/types/database";

export type DriverRow = Database["public"]["Tables"]["drivers"]["Row"];

/**
 * Update driver online/offline duty status and latest GPS coordinates
 */
export async function updateDriverStatus(
  driverId: string,
  isOnline: boolean,
  currentLat?: number,
  currentLng?: number
) {
  const updates: Partial<DriverRow> = {
    is_online: isOnline,
    location_updated_at: new Date().toISOString(),
  };

  if (currentLat !== undefined) updates.current_lat = currentLat;
  if (currentLng !== undefined) updates.current_lng = currentLng;

  const { data, error } = await supabase
    .from("drivers")
    .update(updates)
    .eq("id", driverId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Record a location heartbeat ping into driver_locations table
 */
export async function recordDriverLocation(
  driverId: string,
  latitude: number,
  longitude: number,
  accuracy?: number,
  heading?: number,
  speed?: number
) {
  const { error } = await supabase.from("driver_locations").insert({
    driver_id: driverId,
    latitude,
    longitude,
    accuracy,
    heading,
    speed,
  });

  if (error) console.warn("[recordDriverLocation] error:", error);
}

/**
 * Fetch verified online drivers for map clustering and nearest dispatch
 */
export async function fetchOnlineDrivers() {
  const { data, error } = await supabase
    .from("drivers")
    .select("*, profiles(*), vehicles(*)")
    .eq("is_online", true)
    .eq("is_verified", true);

  if (error) throw error;
  return data;
}

/**
 * Subscribe to realtime GPS location updates from a driver
 */
export function subscribeToDriverLocation(
  driverId: string,
  onLocation: (loc: { latitude: number; longitude: number; heading?: number; speed?: number }) => void
) {
  const channel = supabase
    .channel(`driver_location:${driverId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "driver_locations",
        filter: `driver_id=eq.${driverId}`,
      },
      (payload) => {
        if (payload.new) {
          onLocation(payload.new as any);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
