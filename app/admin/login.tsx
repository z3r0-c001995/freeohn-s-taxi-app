import { useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "@/components/screen-container";
import { AppButton } from "@/components/ui/app-button";
import { AppCard } from "@/components/ui/app-card";
import { AppInput } from "@/components/ui/app-input";
import { radii, shadows } from "@/constants/design-system";
import { useBrandTheme } from "@/hooks/use-brand-theme";
import { clearAdminPortalSession, getAdminPortalSession, saveAdminPortalSession } from "@/lib/admin-portal-auth";
import { adminLogin, getAdminAuthMe, setAdminPortalRuntimeSession } from "@/lib/admin-portal-api";

export default function AdminLoginScreen() {
  const router = useRouter();
  const brand = useBrandTheme();
  const defaultOpenId =
    process.env.EXPO_PUBLIC_ADMIN_PORTAL_OPEN_ID || process.env.EXPO_PUBLIC_DEV_ADMIN_USER_ID || "9001";

  const [openId, setOpenId] = useState(defaultOpenId);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  const helperText = useMemo(() => {
    if (process.env.EXPO_PUBLIC_ADMIN_PORTAL_OPEN_ID) {
      return `Use admin ID ${process.env.EXPO_PUBLIC_ADMIN_PORTAL_OPEN_ID}.`;
    }
    return "Use your configured admin open ID.";
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      const existingSession = await getAdminPortalSession();
      if (!existingSession) {
        setCheckingSession(false);
        return;
      }

      setAdminPortalRuntimeSession(existingSession);
      try {
        await getAdminAuthMe();
        router.replace("/admin");
      } catch {
        await clearAdminPortalSession();
        setAdminPortalRuntimeSession(null);
      } finally {
        setCheckingSession(false);
      }
    };

    void bootstrap();
  }, [router]);

  const handleLogin = async () => {
    if (!openId.trim() || !password.trim()) {
      Alert.alert("Validation", "Admin ID and password are required.");
      return;
    }

    try {
      setLoading(true);
      const response = await adminLogin(openId.trim(), password);

      const session = {
        authMode: response.authMode,
        accessToken: response.accessToken,
        devUserId: response.devUserId,
        openId: response.user.openId,
        userName: response.user.name,
        loggedInAt: new Date().toISOString(),
      };

      await saveAdminPortalSession(session);
      setAdminPortalRuntimeSession(session);
      await getAdminAuthMe();
      router.replace("/admin");
    } catch (error) {
      setAdminPortalRuntimeSession(null);
      await clearAdminPortalSession();
      Alert.alert("Login failed", error instanceof Error ? error.message : "Unable to authenticate admin.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer className="bg-background" containerClassName="bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <View style={{ flex: 1, justifyContent: "center", gap: 16, paddingBottom: 20 }}>
          <View
            style={{
              borderRadius: radii.xl,
              backgroundColor: "#0A1E49",
              padding: 18,
              ...shadows.md,
            }}
          >
            <View
              style={{
                width: 42,
                height: 42,
                borderRadius: 999,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(255,255,255,0.14)",
              }}
            >
              <Ionicons name="shield-checkmark-outline" size={22} color="#FFFFFF" />
            </View>
            <Text style={{ marginTop: 14, fontSize: 30, fontWeight: "800", color: "#FFFFFF" }}>Admin Portal Login</Text>
            <Text style={{ marginTop: 6, color: "#CBD5E1", fontSize: 13 }}>
              Authenticate to manage drivers, compliance, and operations.
            </Text>
          </View>

          <AppCard>
            <AppInput
              label="Admin Open ID"
              placeholder="9001"
              value={openId}
              onChangeText={setOpenId}
              editable={!loading}
              autoCapitalize="none"
            />
            <View style={{ marginTop: 10 }}>
              <AppInput
                label="Password"
                placeholder="Enter admin portal password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                editable={!loading}
              />
            </View>
            <Text style={{ marginTop: 8, fontSize: 12, color: brand.textMuted }}>{helperText}</Text>
            <View style={{ marginTop: 14 }}>
              <AppButton
                label={checkingSession || loading ? "Signing in..." : "Sign In"}
                loading={checkingSession || loading}
                onPress={() => {
                  void handleLogin();
                }}
              />
            </View>
          </AppCard>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
