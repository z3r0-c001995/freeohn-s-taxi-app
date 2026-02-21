import { useMemo, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "@/components/screen-container";
import { AppBadge } from "@/components/ui/app-badge";
import { AppCard } from "@/components/ui/app-card";
import { radii, shadows } from "@/constants/design-system";
import { useBrandTheme } from "@/hooks/use-brand-theme";
import { useAppStore } from "@/lib/store";

type BadgeTone = "neutral" | "success" | "warning" | "danger";

export default function RideHistoryScreen() {
  const router = useRouter();
  const brand = useBrandTheme();
  const { rideHistory } = useAppStore();
  const [expanded, setExpanded] = useState<string | null>(null);

  const sorted = useMemo(() => {
    return [...rideHistory].sort((a, b) => {
      const aTime = new Date(a.requestedAt).getTime();
      const bTime = new Date(b.requestedAt).getTime();
      return bTime - aTime;
    });
  }, [rideHistory]);

  return (
    <ScreenContainer className="bg-background" containerClassName="bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <View style={{ gap: 16, paddingBottom: 20 }}>
          <View
            style={{
              borderRadius: radii.xl,
              padding: 18,
              backgroundColor: "#0A1E49",
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
              <AppBadge label={`${sorted.length} trips`} tone="primary" />
            </View>
            <Text style={{ marginTop: 14, fontSize: 28, fontWeight: "800", color: "#FFFFFF" }}>Ride History</Text>
            <Text style={{ marginTop: 6, fontSize: 13, color: "#CBD5E1" }}>
              View completed and cancelled trips with fare details.
            </Text>
          </View>

          {sorted.length === 0 ? (
            <AppCard tone="muted">
              <Text style={{ fontSize: 14, color: brand.textMuted }}>No completed rides yet.</Text>
            </AppCard>
          ) : null}

          {sorted.map((ride) => {
            const key = String(ride.id);
            const open = expanded === key;
            const dateText = new Date(ride.requestedAt).toLocaleString();
            const statusTone: BadgeTone =
              ride.status === "completed"
                ? "success"
                : ride.status === "cancelled"
                  ? "danger"
                  : ride.status === "in_progress"
                    ? "warning"
                    : "neutral";

            return (
              <TouchableOpacity key={key} activeOpacity={0.86} onPress={() => setExpanded(open ? null : key)}>
                <AppCard>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: "700", color: brand.text }}>Trip #{key.slice(-6)}</Text>
                      <Text style={{ marginTop: 2, fontSize: 12, color: brand.textMuted }}>{dateText}</Text>
                    </View>
                    <AppBadge label={ride.status.replace("_", " ").toUpperCase()} tone={statusTone} />
                  </View>

                  <View style={{ marginTop: 10, flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ fontSize: 13, color: brand.textMuted }}>Fare</Text>
                    <Text style={{ fontSize: 19, fontWeight: "800", color: brand.text }}>${ride.fareAmount.toFixed(2)}</Text>
                  </View>

                  {open ? (
                    <View style={{ marginTop: 10, gap: 4 }}>
                      <Text style={{ fontSize: 12, color: brand.textMuted }}>
                        Pickup: {ride.pickupAddress ?? "Pickup location selected"}
                      </Text>
                      <Text style={{ fontSize: 12, color: brand.textMuted }}>
                        Dropoff: {ride.dropoffAddress ?? "Dropoff location selected"}
                      </Text>
                      <Text style={{ fontSize: 12, color: brand.textMuted }}>
                        Distance: {ride.distanceMeters ? `${(ride.distanceMeters / 1000).toFixed(1)} km` : "--"}
                      </Text>
                    </View>
                  ) : null}
                </AppCard>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
