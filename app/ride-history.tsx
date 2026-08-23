import { useMemo, useState, useEffect } from "react";
import { ScrollView, Text, TouchableOpacity, View, ActivityIndicator, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "@/components/screen-container";
import { DriverNavBar } from "@/components/navigation/DriverNavBar";
import { PassengerNavBar } from "@/components/navigation/PassengerNavBar";
import { AppBadge } from "@/components/ui/app-badge";
import { AppCard } from "@/components/ui/app-card";
import { IS_DRIVER_APP } from "@/constants/app-variant";
import { radii, shadows } from "@/constants/design-system";
import { useBrandTheme } from "@/hooks/use-brand-theme";
import { getTrips } from "@/lib/ride-hailing-api";
import { mapRemoteTripToLocal } from "@/lib/ride-utils";

type BadgeTone = "neutral" | "success" | "warning" | "danger";

export default function RideHistoryScreen() {
  const router = useRouter();
  const brand = useBrandTheme();
  const [trips, setTrips] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchHistory = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const data = await getTrips();
      setTrips((data ?? []).map(mapRemoteTripToLocal));
    } catch {
      // silently fail — history is best-effort
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchHistory(true);
  };

  const sorted = useMemo(() => {
    return [...trips].sort((a, b) => {
      const aTime = new Date(a.requestedAt).getTime();
      const bTime = new Date(b.requestedAt).getTime();
      return bTime - aTime;
    });
  }, [trips]);

  return (
    <ScreenContainer className="bg-background" containerClassName="bg-background">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
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
            <Text style={{ marginTop: 14, fontSize: 28, fontWeight: "800", color: "#FFFFFF" }}>Receipts</Text>
            <Text style={{ marginTop: 6, fontSize: 13, color: "#CBD5E1" }}>
              View completed trips, fares, and payment details.
            </Text>
          </View>

          {isLoading ? (
            <ActivityIndicator size="large" color="#F59E0B" style={{ marginTop: 40 }} />
          ) : sorted.length === 0 ? (
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
                    <Text style={{ fontSize: 19, fontWeight: "800", color: brand.text }}>ZMW {ride.fareAmount.toFixed(2)}</Text>
                  </View>
                  
                  <View style={{ marginTop: 4, flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ fontSize: 13, color: brand.textMuted }}>Payment Method</Text>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: brand.text }}>Cash</Text>
                  </View>

                  {open ? (
                    <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: brand.border, gap: 6 }}>
                      <Text style={{ fontSize: 12, color: brand.textMuted }}>
                        <Text style={{ fontWeight: "700" }}>Pickup:</Text> {ride.pickupAddress ?? "Location selected"}
                      </Text>
                      <Text style={{ fontSize: 12, color: brand.textMuted }}>
                        <Text style={{ fontWeight: "700" }}>Dropoff:</Text> {ride.dropoffAddress ?? "Location selected"}
                      </Text>
                      <Text style={{ fontSize: 12, color: brand.textMuted }}>
                        <Text style={{ fontWeight: "700" }}>Distance:</Text> {ride.distanceMeters ? `${(ride.distanceMeters / 1000).toFixed(1)} km` : "--"}
                      </Text>
                    </View>
                  ) : null}
                </AppCard>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
      {IS_DRIVER_APP ? <DriverNavBar /> : <PassengerNavBar />}
    </ScreenContainer>
  );
}
