import { supabase } from "./supabase";
import type { Database } from "@/types/database";

export type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];

/**
 * Fetch unread and recent notifications for the logged-in user
 */
export async function fetchUserNotifications(userId: string) {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) throw error;
  return data as NotificationRow[];
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(notificationId: string) {
  const { data, error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .select()
    .single();

  if (error) throw error;
  return data as NotificationRow;
}

/**
 * Subscribe to realtime incoming notifications
 */
export function subscribeToNotifications(
  userId: string,
  onNotification: (notif: NotificationRow) => void
) {
  const channel = supabase
    .channel(`notifications:${userId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        if (payload.new) {
          onNotification(payload.new as NotificationRow);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
