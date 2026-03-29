import { useCallback, useEffect, useState } from "react";
import { Text, View } from "react-native";

import { AdminShell } from "@/components/admin/admin-shell";
import { AppCard } from "@/components/ui/app-card";
import { radii } from "@/constants/design-system";
import { useBrandTheme } from "@/hooks/use-brand-theme";
import { useAdminPortalGuard } from "@/hooks/use-admin-portal-guard";
import { getAdminActivities, type AdminActivityResponse } from "@/lib/admin-portal-api";

export default function AdminActivityScreen() {
  const brand = useBrandTheme();
  const { ready, logout } = useAdminPortalGuard();
  const [activity, setActivity] = useState<AdminActivityResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!ready) return;
    try {
      setLoading(true);
      const next = await getAdminActivities(100);
      setActivity(next);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load activity feed.");
    } finally {
      setLoading(false);
    }
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    void refresh();
    const timer = setInterval(() => {
      void refresh();
    }, 6000);
    return () => clearInterval(timer);
  }, [ready, refresh]);

  if (!ready) {
    return null;
  }

  return (
    <AdminShell
      title="Activity"
      subtitle="Trips, events, dispatch queue, and incidents."
      activeTab="activity"
      onLogout={() => {
        void logout();
      }}
      onRefresh={() => {
        void refresh();
      }}
      refreshLabel={loading ? "Refreshing..." : "Refresh Activity"}
      statusLabel={loading ? "Refreshing" : "Admin"}
    >
      {error ? (
        <AppCard tone="muted">
          <Text style={{ color: brand.danger, fontWeight: "700" }}>Activity data error</Text>
          <Text style={{ marginTop: 4, color: brand.textMuted, fontSize: 13 }}>{error}</Text>
        </AppCard>
      ) : null}

      <AppCard>
        <Text style={{ fontSize: 18, fontWeight: "800", color: brand.text }}>Recent Trips</Text>
        <View style={{ marginTop: 10, gap: 8 }}>
          {(activity?.trips ?? []).slice(0, 20).map((trip: any) => (
            <View
              key={trip.id}
              style={{
                borderRadius: radii.md,
                borderWidth: 1,
                borderColor: brand.border,
                backgroundColor: brand.surfaceMuted,
                padding: 10,
              }}
            >
              <Text style={{ color: brand.text, fontWeight: "700", fontSize: 13 }}>
                {trip.id} • {trip.state}
              </Text>
              <Text style={{ marginTop: 3, color: brand.textMuted, fontSize: 12 }}>
                rider {trip.riderId} • driver {trip.driverId ?? "-"} • {trip.fare?.currency ?? "USD"} {Number(trip.fare?.total ?? 0).toFixed(2)}
              </Text>
            </View>
          ))}
        </View>
      </AppCard>

      <AppCard>
        <Text style={{ fontSize: 18, fontWeight: "800", color: brand.text }}>Trip Event Feed</Text>
        <View style={{ marginTop: 10, gap: 8 }}>
          {(activity?.tripEvents ?? []).slice(0, 24).map((event: any) => (
            <View key={event.id} style={{ gap: 2 }}>
              <Text style={{ color: brand.text, fontWeight: "700", fontSize: 12 }}>
                {event.toState} • {event.tripId}
              </Text>
              <Text style={{ color: brand.textMuted, fontSize: 11 }}>
                {event.actorRole}:{event.actorId} • {new Date(event.createdAt).toLocaleString()}
              </Text>
            </View>
          ))}
        </View>
      </AppCard>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <AppCard style={{ flex: 1 }}>
          <Text style={{ fontSize: 17, fontWeight: "800", color: brand.text }}>Dispatch Offers</Text>
          <Text style={{ marginTop: 6, color: brand.textMuted, fontSize: 13 }}>
            {(activity?.dispatchOffers ?? []).length} records in recent feed.
          </Text>
        </AppCard>
        <AppCard style={{ flex: 1 }}>
          <Text style={{ fontSize: 17, fontWeight: "800", color: brand.text }}>Safety Incidents</Text>
          <Text style={{ marginTop: 6, color: brand.textMuted, fontSize: 13 }}>
            {(activity?.incidents ?? []).length} incidents in recent feed.
          </Text>
        </AppCard>
      </View>
    </AdminShell>
  );
}
