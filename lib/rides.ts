import { supabase } from "./supabase";
import type { Database, RideStatus } from "@/types/database";

export type RideRow = Database["public"]["Tables"]["rides"]["Row"];
export type RideInsert = Database["public"]["Tables"]["rides"]["Insert"];

/**
 * Fetch rides for current customer or driver
 */
export async function fetchUserRides(userId: string) {
  const { data, error } = await supabase
    .from("rides")
    .select("*")
    .or(`customer_id.eq.${userId},driver_id.eq.${userId}`)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data as RideRow[];
}

/**
 * Fetch a single ride by ID with status history and driver profile
 */
export async function fetchRideById(rideId: string) {
  const { data, error } = await supabase
    .from("rides")
    .select("*, ride_status_history(*)")
    .eq("id", rideId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Create a new ride request directly in Supabase
 */
export async function createRideRequest(payload: RideInsert) {
  const { data, error } = await supabase
    .from("rides")
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data as RideRow;
}

/**
 * Update ride status
 */
export async function updateRideStatus(rideId: string, status: RideStatus, notes?: string) {
  const updates: Partial<RideRow> = { status };
  if (status === "accepted") updates.accepted_at = new Date().toISOString();
  if (status === "in_progress") updates.started_at = new Date().toISOString();
  if (status === "completed") updates.completed_at = new Date().toISOString();
  if (status === "cancelled") updates.cancelled_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("rides")
    .update(updates)
    .eq("id", rideId)
    .select()
    .single();

  if (error) throw error;
  return data as RideRow;
}

/**
 * Subscribe to realtime updates for a specific ride
 */
export function subscribeToRide(rideId: string, onUpdate: (ride: RideRow) => void) {
  const channel = supabase
    .channel(`ride:${rideId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "rides",
        filter: `id=eq.${rideId}`,
      },
      (payload) => {
        if (payload.new) {
          onUpdate(payload.new as RideRow);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
