import { useCallback, useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";

import { AdminShell } from "@/components/admin/admin-shell";
import { AppCard } from "@/components/ui/app-card";
import { useBrandTheme } from "@/hooks/use-brand-theme";
import { useAdminPortalGuard } from "@/hooks/use-admin-portal-guard";
import { getAdminOverview, type AdminOverviewResponse } from "@/lib/admin-portal-api";

export default function AdminOverviewScreen() {
  const brand = useBrandTheme();
  const { ready, adminUser, logout, error: authError } = useAdminPortalGuard();
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
      setError(loadError instanceof Error ? loadError.message : "Unable to load admin overview.");
    } finally {
      setLoading(false);
    }
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    void refresh();
    const timer = setInterval(() => {
      void refresh();
    }, 7000);
    return () => clearInterval(timer);
  }, [ready, refresh]);

  const counters = useMemo(() => {
    return [
      { label: "Total drivers", value: overview?.counts.totalDrivers ?? 0 },
      { label: "Online drivers", value: overview?.counts.onlineDrivers ?? 0 },
      { label: "Verified drivers", value: overview?.counts.verifiedDrivers ?? 0 },
      { label: "Active trips", value: overview?.counts.activeTrips ?? 0 },
      { label: "Completed trips", value: overview?.counts.completedTrips ?? 0 },
      { label: "Open incidents", value: overview?.counts.openIncidents ?? 0 },
    ];
  }, [overview]);

  if (!ready) {
    return null;
  }

  return (
    <AdminShell
      title="Admin Portal"
      subtitle={`Signed in as ${adminUser?.name ?? "Admin"}`}
      activeTab="overview"
      onLogout={() => {
        void logout();
      }}
      onRefresh={() => {
        void refresh();
      }}
      refreshLabel={loading ? "Refreshing..." : "Refresh Overview"}
      statusLabel={loading ? "Refreshing" : "Authenticated"}
    >
      <AppCard tone="muted">
        <Text style={{ fontSize: 17, fontWeight: "800", color: brand.text }}>Registration requirements</Text>
        <View style={{ marginTop: 8, gap: 4 }}>
          <Text style={{ color: brand.textMuted, fontSize: 12 }}>
            1) Driver identity: full name, phone, NRC, home address, emergency contact.
          </Text>
          <Text style={{ color: brand.textMuted, fontSize: 12 }}>
            2) Vehicle documents: license, vehicle registration, insurance, road tax, fitness certificate.
          </Text>
          <Text style={{ color: brand.textMuted, fontSize: 12 }}>
            3) Compliance: all checks required before verification and going online.
          </Text>
          <Text style={{ color: brand.textMuted, fontSize: 12 }}>
            4) Commercial: rides must be purchased from company admin.
          </Text>
        </View>
      </AppCard>

      {authError || error ? (
        <AppCard tone="muted">
          <Text style={{ color: brand.danger, fontWeight: "700" }}>Admin data error</Text>
          <Text style={{ marginTop: 4, color: brand.textMuted, fontSize: 13 }}>{authError ?? error}</Text>
        </AppCard>
      ) : null}

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {counters.map((item) => (
          <View
            key={item.label}
            style={{
              flexBasis: "32%",
              minWidth: 180,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: brand.border,
              paddingVertical: 12,
              paddingHorizontal: 12,
              backgroundColor: brand.surface,
            }}
          >
            <Text style={{ fontSize: 12, color: brand.textMuted }}>{item.label}</Text>
            <Text style={{ marginTop: 4, fontSize: 22, color: brand.text, fontWeight: "800" }}>
              {item.value}
            </Text>
          </View>
        ))}
      </View>

      <AppCard>
        <Text style={{ fontSize: 16, fontWeight: "800", color: brand.text }}>System health</Text>
        <Text style={{ marginTop: 6, fontSize: 13, color: brand.textMuted }}>
          Metrics timestamp: {overview?.metrics.timestamp ? new Date(overview.metrics.timestamp).toLocaleString() : "-"}
        </Text>
        <Text style={{ marginTop: 2, fontSize: 13, color: brand.textMuted }}>
          Generated at: {overview?.generatedAt ? new Date(overview.generatedAt).toLocaleString() : "-"}
        </Text>
      </AppCard>
    </AdminShell>
  );
}
