import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "@/components/screen-container";
import { DriverNavBar } from "@/components/navigation/DriverNavBar";
import { PassengerNavBar } from "@/components/navigation/PassengerNavBar";
import { AppCard } from "@/components/ui/app-card";
import { AppButton } from "@/components/ui/app-button";
import { IS_DRIVER_APP } from "@/constants/app-variant";
import { radii, shadows } from "@/constants/design-system";
import { useBrandTheme } from "@/hooks/use-brand-theme";
import { useAppStore } from "@/lib/store";

// In production this comes from DB favourites table + nearby driver check
const DEMO_FAVOURITES: Array<{
  id: string;
  name: string;
  vehicle: string;
  plate: string;
  rating: number;
  nearbyKm: number | null;
}> = [];

export default function FavouritesScreen() {
  const router = useRouter();
  const brand = useBrandTheme();
  const { currentLocation } = useAppStore();

  return (
    <ScreenContainer className="bg-background" containerClassName="bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <View style={{ gap: 16, paddingBottom: 24 }}>
          {/* Header */}
          <View
            style={{
              borderRadius: radii.xl,
              padding: 20,
              backgroundColor: "#0A1E49",
              ...shadows.md,
            }}
          >
            <TouchableOpacity
              onPress={() => router.back()}
              style={{ width: 38, height: 38, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center", marginBottom: 12 }}
            >
              <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={{ fontSize: 28, fontWeight: "800", color: "#FFFFFF" }}>Favourite Drivers</Text>
            <Text style={{ marginTop: 6, fontSize: 13, color: "#CBD5E1" }}>
              Drivers you trust — request them directly next time.
            </Text>
          </View>

          {DEMO_FAVOURITES.length === 0 ? (
            <AppCard>
              <View style={{ alignItems: "center", paddingVertical: 40, gap: 12 }}>
                <Ionicons name="heart-outline" size={56} color={brand.textMuted} />
                <Text style={{ fontSize: 18, fontWeight: "800", color: brand.text }}>No favourites yet</Text>
                <Text style={{ textAlign: "center", color: brand.textMuted, fontSize: 14, lineHeight: 20 }}>
                  After completing a ride, you can add the driver as a favourite. They'll show up here, and you can send them a targeted ride request whenever you see them nearby.
                </Text>
                <AppButton
                  label="Book a Ride"
                  onPress={() => router.push("/request-ride" as never)}
                  fullWidth={false}
                  style={{ marginTop: 8 }}
                />
              </View>
            </AppCard>
          ) : (
            DEMO_FAVOURITES.map((driver) => (
              <AppCard key={driver.id}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 26,
                      backgroundColor: brand.surfaceMuted,
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 14,
                    }}
                  >
                    <Ionicons name="person" size={28} color={brand.textMuted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: "800", fontSize: 16, color: brand.text }}>{driver.name}</Text>
                    <Text style={{ color: brand.textMuted, fontSize: 13, marginTop: 2 }}>
                      {driver.vehicle} · {driver.plate}
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
                      <Ionicons name="star" size={13} color="#F59E0B" />
                      <Text style={{ marginLeft: 4, fontSize: 13, color: brand.textMuted }}>{driver.rating}</Text>
                      {driver.nearbyKm !== null && (
                        <View style={{ marginLeft: 10, flexDirection: "row", alignItems: "center", backgroundColor: "#F0FDF4", borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 }}>
                          <Ionicons name="location" size={12} color="#22C55E" />
                          <Text style={{ marginLeft: 3, fontSize: 12, color: "#22C55E", fontWeight: "700" }}>{driver.nearbyKm.toFixed(1)} km away</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <AppButton
                    label="Request"
                    fullWidth={false}
                    onPress={() => router.push("/request-ride" as never)}
                    style={{ paddingHorizontal: 14 }}
                  />
                </View>
              </AppCard>
            ))
          )}
        </View>
      </ScrollView>
      {IS_DRIVER_APP ? <DriverNavBar /> : <PassengerNavBar />}
    </ScreenContainer>
  );
}
