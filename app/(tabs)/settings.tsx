import { useState } from "react";
import { Alert, Image, ScrollView, Switch, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "@/components/screen-container";
import { AppBadge } from "@/components/ui/app-badge";
import { AppButton } from "@/components/ui/app-button";
import { AppCard } from "@/components/ui/app-card";
import { APP_LABEL } from "@/constants/app-variant";
import { APP_LOGO } from "@/constants/brand-assets";
import { radii, shadows } from "@/constants/design-system";
import { useBrandTheme } from "@/hooks/use-brand-theme";
import { useAppStore } from "@/lib/store";

export default function SettingsScreen() {
  const router = useRouter();
  const brand = useBrandTheme();
  const {
    currentUser,
    activeRide,
    setCurrentUser,
    setIsAuthenticated,
    setDriverProfile,
    setActiveRide,
    persist,
  } = useAppStore();
  const phone = (currentUser as Record<string, any> | null)?.phone;

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [locationEnabled, setLocationEnabled] = useState(true);

  if (!currentUser) {
    return (
      <ScreenContainer className="bg-background items-center justify-center">
        <Text style={{ color: brand.textMuted }}>Loading settings...</Text>
      </ScreenContainer>
    );
  }

  const handleLogout = async () => {
    Alert.alert("Sign out", "Do you want to sign out from this device?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          setActiveRide(null);
          setDriverProfile(null);
          setCurrentUser(null);
          setIsAuthenticated(false);
          await persist();
          router.replace("/(auth)/onboarding");
        },
      },
    ]);
  };

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
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Image
                  source={APP_LOGO}
                  style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: "#FFFFFF" }}
                  resizeMode="cover"
                />
                <View>
                  <Text style={{ color: "#CBD5E1", fontSize: 12 }}>Account</Text>
                  <Text style={{ color: "#FFFFFF", fontSize: 20, fontWeight: "800" }}>{currentUser.name}</Text>
                </View>
              </View>
              <AppBadge label={currentUser.role === "driver" ? "Driver" : "Seeker"} tone="primary" />
            </View>
            <Text style={{ marginTop: 10, color: "#CBD5E1", fontSize: 12 }}>{APP_LABEL}</Text>
          </View>

          <AppCard>
            <Text style={{ fontSize: 16, fontWeight: "800", color: brand.text }}>Profile</Text>
            <Text style={{ marginTop: 8, color: brand.textMuted, fontSize: 13 }}>
              Name: {currentUser.name}
            </Text>
            {phone ? (
              <Text style={{ marginTop: 3, color: brand.textMuted, fontSize: 13 }}>
                Phone: {String(phone)}
              </Text>
            ) : null}
            {currentUser.email ? (
              <Text style={{ marginTop: 3, color: brand.textMuted, fontSize: 13 }}>
                Email: {currentUser.email}
              </Text>
            ) : null}
          </AppCard>

          <AppCard>
            <Text style={{ fontSize: 16, fontWeight: "800", color: brand.text }}>Settings</Text>
            <View style={{ marginTop: 12, gap: 12 }}>
              <View
                style={{
                  borderRadius: radii.md,
                  borderWidth: 1,
                  borderColor: brand.border,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Text style={{ color: brand.text, fontWeight: "600" }}>Push notifications</Text>
                <Switch value={notificationsEnabled} onValueChange={setNotificationsEnabled} />
              </View>
              <View
                style={{
                  borderRadius: radii.md,
                  borderWidth: 1,
                  borderColor: brand.border,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Text style={{ color: brand.text, fontWeight: "600" }}>Location services</Text>
                <Switch value={locationEnabled} onValueChange={setLocationEnabled} />
              </View>
            </View>
          </AppCard>

          <AppCard tone="muted">
            <Text style={{ fontSize: 16, fontWeight: "800", color: brand.text }}>Quick actions</Text>
            <View style={{ marginTop: 10, gap: 8 }}>
              <AppButton
                label="Ride History"
                variant="outline"
                onPress={() => router.push("/ride-history" as never)}
                leftIcon={<Ionicons name="time-outline" size={16} color={brand.accent} />}
              />
              {activeRide?.driverId ? (
                <AppButton
                  label="Chat Driver"
                  variant="outline"
                  onPress={() => router.push("/(tabs)/chat")}
                  leftIcon={<Ionicons name="chatbubble-ellipses-outline" size={16} color={brand.accent} />}
                />
              ) : null}
              <TouchableOpacity
                onPress={() => router.push("/safety-center" as never)}
                style={{
                  borderRadius: radii.md,
                  borderWidth: 1,
                  borderColor: brand.border,
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Ionicons name="shield-checkmark-outline" size={18} color={brand.accent} />
                  <Text style={{ color: brand.text, fontWeight: "700" }}>Safety Center</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={brand.textMuted} />
              </TouchableOpacity>
            </View>
          </AppCard>

          <AppButton label="Sign Out" variant="danger" onPress={handleLogout} />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
