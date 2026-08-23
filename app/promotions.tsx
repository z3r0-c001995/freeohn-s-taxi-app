import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "@/components/screen-container";
import { DriverNavBar } from "@/components/navigation/DriverNavBar";
import { PassengerNavBar } from "@/components/navigation/PassengerNavBar";
import { AppCard } from "@/components/ui/app-card";
import { IS_DRIVER_APP } from "@/constants/app-variant";
import { radii, shadows } from "@/constants/design-system";
import { useBrandTheme } from "@/hooks/use-brand-theme";

// Static demo promotions — in production these come from the admin portal DB
const DEMO_PROMOS = [
  {
    id: "1",
    title: "New User Bonus",
    description: "Get 20% off your first 3 rides with Freeohn!",
    discount: 20,
    code: "WELCOME20",
    validTo: "2026-06-30",
    color: "#F97316",
    bg: "#FFF7ED",
  },
  {
    id: "2",
    title: "Weekend Special",
    description: "Enjoy 15% off all rides every Saturday and Sunday in Mansa.",
    discount: 15,
    code: "WEEKEND15",
    validTo: "2026-04-30",
    color: "#8B5CF6",
    bg: "#F5F3FF",
  },
  {
    id: "3",
    title: "Refer & Save",
    description: "Invite a friend and both of you get 10% off your next ride.",
    discount: 10,
    code: "REFER10",
    validTo: "2026-12-31",
    color: "#22C55E",
    bg: "#F0FDF4",
  },
];

export default function PromotionsScreen() {
  const router = useRouter();
  const brand = useBrandTheme();

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
            <Text style={{ fontSize: 28, fontWeight: "800", color: "#FFFFFF" }}>Promotions</Text>
            <Text style={{ marginTop: 6, fontSize: 13, color: "#CBD5E1" }}>
              Active deals for riders in Mansa &amp; Luapula Province
            </Text>
          </View>

          {DEMO_PROMOS.map((promo) => (
            <AppCard key={promo.id}>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 16,
                    backgroundColor: promo.bg,
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 14,
                  }}
                >
                  <Ionicons name="pricetag" size={24} color={promo.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "800", fontSize: 16, color: brand.text }}>{promo.title}</Text>
                  <Text style={{ fontSize: 12, color: brand.textMuted, marginTop: 2 }}>
                    Valid until {promo.validTo}
                  </Text>
                </View>
                <View
                  style={{
                    backgroundColor: promo.bg,
                    borderRadius: 20,
                    paddingHorizontal: 12,
                    paddingVertical: 4,
                  }}
                >
                  <Text style={{ fontWeight: "800", fontSize: 15, color: promo.color }}>
                    {promo.discount}% OFF
                  </Text>
                </View>
              </View>

              <Text style={{ color: brand.textMuted, fontSize: 14, lineHeight: 20 }}>
                {promo.description}
              </Text>

              <View
                style={{
                  marginTop: 14,
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: brand.surfaceMuted,
                  borderRadius: radii.md,
                  padding: 12,
                }}
              >
                <Ionicons name="copy-outline" size={16} color={brand.textMuted} />
                <Text style={{ marginLeft: 8, fontWeight: "700", color: brand.text, letterSpacing: 1.5 }}>
                  {promo.code}
                </Text>
                <Text style={{ marginLeft: 4, fontSize: 12, color: brand.textMuted }}>(tap to copy)</Text>
              </View>
            </AppCard>
          ))}
        </View>
      </ScrollView>
      {IS_DRIVER_APP ? <DriverNavBar /> : <PassengerNavBar />}
    </ScreenContainer>
  );
}
