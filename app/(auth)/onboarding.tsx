import { ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "@/components/screen-container";
import { AppButton } from "@/components/ui/app-button";
import { AppCard } from "@/components/ui/app-card";
import { APP_LABEL, IS_DRIVER_APP } from "@/constants/app-variant";
import { radii, shadows } from "@/constants/design-system";
import { useBrandTheme } from "@/hooks/use-brand-theme";

function DriverOnboarding() {
  const router = useRouter();
  const brand = useBrandTheme();

  return (
    <ScreenContainer className="bg-background" containerClassName="bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: 24, gap: 18 }}>
          <View
            style={{
              borderRadius: radii.xl,
              padding: 24,
              borderWidth: 1,
              borderColor: brand.border,
              backgroundColor: "#0F1E4A",
              ...shadows.md,
            }}
          >
            <Text style={{ fontSize: 32, fontWeight: "800", color: "#FFFFFF" }}>Freeohn&apos;s</Text>
            <Text style={{ marginTop: 6, fontSize: 15, color: "#CBD5E1" }}>{APP_LABEL}</Text>
            <View style={{ marginTop: 22, gap: 12 }}>
              {[
                "Owner-managed driver access",
                "Dispatch and trip controls",
                "Live GPS and earnings summary",
              ].map((item) => (
                <View key={item} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Ionicons name="checkmark-circle" size={20} color={brand.accent} />
                  <Text style={{ color: "#E2E8F0", fontSize: 14 }}>{item}</Text>
                </View>
              ))}
            </View>
          </View>

          <AppCard>
            <Text style={{ fontSize: 22, fontWeight: "700", color: brand.text }}>Driver Access</Text>
            <Text style={{ marginTop: 6, fontSize: 14, color: brand.textMuted }}>
              Sign in using the phone number registered by company operations.
            </Text>
            <View style={{ marginTop: 16 }}>
              <AppButton
                label="Continue to Driver Login"
                variant="secondary"
                onPress={() => {
                  router.push({ pathname: "/phone-entry", params: { role: "driver" } });
                }}
              />
            </View>
          </AppCard>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

function SeekerOnboarding() {
  const router = useRouter();
  const brand = useBrandTheme();

  return (
    <ScreenContainer className="bg-background" containerClassName="bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <View style={{ flex: 1, justifyContent: "space-between", paddingBottom: 28 }}>
          <View
            style={{
              minHeight: 318,
              borderBottomLeftRadius: 110,
              borderBottomRightRadius: 110,
              backgroundColor: "#0A1E49",
              alignItems: "center",
              justifyContent: "flex-end",
              paddingBottom: 22,
              paddingHorizontal: 24,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                position: "absolute",
                width: 260,
                height: 260,
                borderRadius: 999,
                backgroundColor: "rgba(249, 115, 22, 0.35)",
                top: -120,
                right: -50,
              }}
            />
            <View
              style={{
                width: 96,
                height: 96,
                borderRadius: 32,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(255,255,255,0.08)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.2)",
              }}
            >
              <Text style={{ fontSize: 52, fontWeight: "800", color: brand.primary }}>F</Text>
            </View>
            <Text style={{ marginTop: 14, color: "#F8FAFC", fontWeight: "800", fontSize: 28 }}>
              Freeohn&apos;s Ride App
            </Text>
            <Text style={{ marginTop: 6, color: "#CBD5E1", fontSize: 14 }}>
              Fast, reliable rides with live tracking.
            </Text>
          </View>

          <View style={{ paddingHorizontal: 24, marginTop: -10, gap: 16 }}>
            <AppCard>
              <Text style={{ fontSize: 24, fontWeight: "700", color: brand.text }}>Welcome</Text>
              <Text style={{ marginTop: 8, color: brand.textMuted, fontSize: 14 }}>
                Register once and book rides with transparent fare, ETA, and safety tools.
              </Text>
              <View style={{ marginTop: 18 }}>
                <AppButton
                  label="Get Started"
                  onPress={() => {
                    router.push({ pathname: "/phone-entry", params: { role: "rider" } });
                  }}
                />
              </View>
              <View style={{ marginTop: 10 }}>
                <AppButton
                  label="Driver Portal"
                  variant="outline"
                  onPress={() => {
                    router.push({ pathname: "/phone-entry", params: { role: "driver" } });
                  }}
                />
              </View>
            </AppCard>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

export default function OnboardingScreen() {
  if (IS_DRIVER_APP) {
    return <DriverOnboarding />;
  }

  return <SeekerOnboarding />;
}
