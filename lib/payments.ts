import { supabase } from "./supabase";
import type { Database } from "@/types/database";

export type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];

/**
 * Fetch payments for a customer or driver
 */
export async function fetchUserPayments(customerId: string) {
  const { data, error } = await supabase
    .from("payments")
    .select("*, rides(*)")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Record a new payment entry for a completed trip
 */
export async function createPayment(payload: {
  ride_id: string;
  customer_id: string;
  amount: number;
  currency?: string;
  provider?: string;
  provider_reference?: string;
  status?: string;
}) {
  const { data, error } = await supabase
    .from("payments")
    .insert({
      ride_id: payload.ride_id,
      customer_id: payload.customer_id,
      amount: payload.amount,
      currency: payload.currency || "ZMW",
      provider: payload.provider || "CASH",
      provider_reference: payload.provider_reference,
      status: payload.status || "completed",
      paid_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data as PaymentRow;
}
