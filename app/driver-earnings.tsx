import { useMemo } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "@/components/screen-container";
import { AppBadge } from "@/components/ui/app-badge";
import { AppCard } from "@/components/ui/app-card";
import { radii, shadows } from "@/constants/design-system";
import { useBrandTheme } from "@/hooks/use-brand-theme";
import { useAppStore } from "@/lib/store";

export default function DriverEarningsScreen() {
  const router = useRouter();
  const brand = useBrandTheme();
  const { rideHistory } = useAppStore();

  const completedTrips = useMemo(() => rideHistory.filter((ride) => ride.status === "completed"), [rideHistory]);
  const todayTotal = useMemo(
    () => completedTrips.reduce((sum, ride) => sum + (Number.isFinite(ride.fareAmount) ? ride.fareAmount : 0), 0),
    [completedTrips],
  );

  const weeklyData = useMemo(() => {
    const data = [0, 0, 0, 0, 0, 0, 0];
    const now = new Date();

    completedTrips.forEach((ride) => {
      const rideDate = new Date(ride.requestedAt);
      const diffDays = Math.floor((now.getTime() - rideDate.getTime()) / (24 * 60 * 60 * 1000));
      if (diffDays >= 0 && diffDays < 7) {
        const bucket = 6 - diffDays;
        data[bucket] += ride.fareAmount;
      }
    });

    return data;
  }, [completedTrips]);

  const maxWeekValue = Math.max(...weeklyData, 1);

  return (
    <ScreenContainer className="bg-background" containerClassName="bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <View style={{ gap: 16, paddingBottom: 20 }}>
          <View
            style={{
              borderRadius: radii.xl,
              padding: 18,
              backgroundColor: "#0F1E4A",
              ...shadows.md,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <TouchableOpacity
                onPress={() => router.back()}
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 999,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "rgba(255,255,255,0.14)",
                }}
              >
                <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
              </TouchableOpacity>
              <AppBadge label={`${completedTrips.length} completed`} tone="success" />
            </View>
            <Text style={{ marginTop: 14, fontSize: 28, fontWeight: "800", color: "#FFFFFF" }}>Earnings</Text>
            <Text style={{ marginTop: 6, fontSize: 13, color: "#CBD5E1" }}>Daily and weekly performance overview.</Text>
          </View>

          <AppCard>
            <Text style={{ fontSize: 14, color: brand.textMuted }}>Today&apos;s earnings</Text>
            <Text style={{ marginTop: 4, fontSize: 38, fontWeight: "800", color: brand.text }}>${todayTotal.toFixed(2)}</Text>
            <Text style={{ marginTop: 4, fontSize: 12, color: brand.textMuted }}>
              {completedTrips.length} trips completed
            </Text>
          </AppCard>

          <AppCard tone="muted">
            <Text style={{ fontSize: 16, fontWeight: "800", color: brand.text }}>Weekly Summary</Text>
            <View style={{ marginTop: 14, flexDirection: "row", alignItems: "flex-end", gap: 8, height: 140 }}>
              {weeklyData.map((value, index) => {
                const height = Math.max(8, Math.round((value / maxWeekValue) * 120));
                return (
                  <View key={`bar-${index}`} style={{ flex: 1, alignItems: "center" }}>
                    <View
                      style={{
                        width: "100%",
                        height,
                        borderRadius: 8,
                        backgroundColor: index === 6 ? brand.accent : brand.primary,
                        opacity: index === 6 ? 1 : 0.75,
                      }}
                    />
                    <Text style={{ marginTop: 6, fontSize: 11, color: brand.textMuted }}>{index + 1}</Text>
                  </View>
                );
              })}
            </View>
          </AppCard>

          <AppCard>
            <Text style={{ fontSize: 16, fontWeight: "800", color: brand.text }}>Trip Breakdown</Text>
            <View style={{ marginTop: 12, gap: 10 }}>
              {completedTrips.slice(0, 15).map((trip) => (
                <View
                  key={String(trip.id)}
                  style={{
                    borderRadius: radii.md,
                    borderWidth: 1,
                    borderColor: brand.border,
                    backgroundColor: brand.surfaceMuted,
                    padding: 12,
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: brand.text }}>Trip #{String(trip.id).slice(-6)}</Text>
                    <Text style={{ marginTop: 2, fontSize: 11, color: brand.textMuted }}>
                      {new Date(trip.requestedAt).toLocaleString()}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 16, fontWeight: "800", color: brand.text }}>${trip.fareAmount.toFixed(2)}</Text>
                </View>
              ))}

              {completedTrips.length === 0 ? (
                <Text style={{ fontSize: 13, color: brand.textMuted }}>No earnings yet.</Text>
              ) : null}
            </View>
          </AppCard>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
