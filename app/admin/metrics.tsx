import { useCallback, useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";

import { AdminShell } from "@/components/admin/admin-shell";
import { AppCard } from "@/components/ui/app-card";
import { useBrandTheme } from "@/hooks/use-brand-theme";
import { useAdminPortalGuard } from "@/hooks/use-admin-portal-guard";
import { getAdminOverview, type AdminOverviewResponse } from "@/lib/admin-portal-api";

export default function AdminMetricsScreen() {
  const brand = useBrandTheme();
  const { ready, logout } = useAdminPortalGuard();
  const [overview, setOverview] = useState<AdminOverviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!ready) return;
    try {
      setLoading(true);
      const next = await getAdminOverview();
      setOverview(next);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load metrics.");
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

  const counters = useMemo(() => {
    return Object.entries(overview?.metrics.counters ?? {}).sort((a, b) => b[1] - a[1]);
  }, [overview]);

  const gauges = useMemo(() => {
    return Object.entries(overview?.metrics.gauges ?? {}).sort((a, b) => b[1] - a[1]);
  }, [overview]);

  if (!ready) {
    return null;
  }

  return (
    <AdminShell
      title="System Metrics"
      subtitle="Dispatch latency, acceptance rate, and operational counters."
      activeTab="metrics"
      onLogout={() => {
        void logout();
      }}
      onRefresh={() => {
        void refresh();
      }}
      refreshLabel={loading ? "Refreshing..." : "Refresh Metrics"}
      statusLabel={loading ? "Refreshing" : "Admin"}
    >
      {error ? (
        <AppCard tone="muted">
          <Text style={{ color: brand.danger, fontWeight: "700" }}>Metrics error</Text>
          <Text style={{ marginTop: 4, color: brand.textMuted, fontSize: 13 }}>{error}</Text>
        </AppCard>
      ) : null}

      <AppCard>
        <Text style={{ fontSize: 18, fontWeight: "800", color: brand.text }}>Counters</Text>
        <View style={{ marginTop: 10, gap: 6 }}>
          {counters.length === 0 ? (
            <Text style={{ color: brand.textMuted, fontSize: 12 }}>No counters collected yet.</Text>
          ) : (
            counters.map(([name, value]) => (
              <View key={name} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ color: brand.textMuted, fontSize: 12 }}>{name}</Text>
                <Text style={{ color: brand.text, fontWeight: "700", fontSize: 12 }}>{value}</Text>
              </View>
            ))
          )}
        </View>
      </AppCard>

      <AppCard>
        <Text style={{ fontSize: 18, fontWeight: "800", color: brand.text }}>Gauges</Text>
        <View style={{ marginTop: 10, gap: 6 }}>
          {gauges.length === 0 ? (
            <Text style={{ color: brand.textMuted, fontSize: 12 }}>No gauges collected yet.</Text>
          ) : (
            gauges.map(([name, value]) => (
              <View key={name} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ color: brand.textMuted, fontSize: 12 }}>{name}</Text>
                <Text style={{ color: brand.text, fontWeight: "700", fontSize: 12 }}>{value}</Text>
              </View>
            ))
          )}
        </View>
        <Text style={{ marginTop: 10, color: brand.textMuted, fontSize: 12 }}>
          Timestamp: {overview?.metrics.timestamp ? new Date(overview.metrics.timestamp).toLocaleString() : "-"}
        </Text>
      </AppCard>
    </AdminShell>
  );
}
