import type { ReactNode } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "@/components/screen-container";
import { AppBadge } from "@/components/ui/app-badge";
import { AppButton } from "@/components/ui/app-button";
import { radii, shadows } from "@/constants/design-system";
import { useBrandTheme } from "@/hooks/use-brand-theme";

type AdminTab = "overview" | "register" | "drivers" | "activity" | "metrics";

type AdminShellProps = {
  title: string;
  subtitle: string;
  activeTab: AdminTab;
  onLogout: () => void;
  onRefresh?: () => void;
  refreshLabel?: string;
  statusLabel?: string;
  children: ReactNode;
};

const TABS: { key: AdminTab; label: string; route: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "overview", label: "Overview", route: "/admin", icon: "speedometer-outline" },
  { key: "register", label: "Register", route: "/admin/register-driver", icon: "person-add-outline" },
  { key: "drivers", label: "Drivers", route: "/admin/drivers", icon: "car-outline" },
  { key: "activity", label: "Activity", route: "/admin/activity", icon: "pulse-outline" },
  { key: "metrics", label: "Metrics", route: "/admin/metrics", icon: "analytics-outline" },
];

export function AdminShell({
  title,
  subtitle,
  activeTab,
  onLogout,
  onRefresh,
  refreshLabel = "Refresh",
  statusLabel = "Admin",
  children,
}: AdminShellProps) {
  const router = useRouter();
  const brand = useBrandTheme();

  return (
    <ScreenContainer className="bg-background" containerClassName="bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <View style={{ gap: 14, paddingBottom: 20 }}>
          <View
            style={{
              borderRadius: radii.xl,
              backgroundColor: "#0A1E49",
              padding: 18,
              ...shadows.md,
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <TouchableOpacity
                onPress={() => router.replace("/(tabs)")}
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
              <View style={{ flexDirection: "row", gap: 8 }}>
                <AppBadge label={statusLabel} tone="primary" />
                <AppButton
                  label="Logout"
                  variant="outline"
                  size="sm"
                  fullWidth={false}
                  style={{ minWidth: 96 }}
                  onPress={onLogout}
                />
              </View>
            </View>
            <Text style={{ marginTop: 14, color: "#FFFFFF", fontSize: 28, fontWeight: "800" }}>{title}</Text>
            <Text style={{ marginTop: 6, color: "#CBD5E1", fontSize: 13 }}>{subtitle}</Text>
            {onRefresh ? (
              <View style={{ marginTop: 12 }}>
                <AppButton
                  label={refreshLabel}
                  variant="outline"
                  fullWidth={false}
                  style={{ alignSelf: "flex-start", minWidth: 140 }}
                  leftIcon={<Ionicons name="refresh" size={16} color={brand.accent} />}
                  onPress={onRefresh}
                />
              </View>
            ) : null}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {TABS.map((tab) => {
                const active = tab.key === activeTab;
                return (
                  <TouchableOpacity
                    key={tab.key}
                    onPress={() => router.push(tab.route as never)}
                    style={{
                      borderRadius: radii.pill,
                      borderWidth: 1,
                      borderColor: active ? brand.primary : brand.border,
                      backgroundColor: active ? "#FFF7ED" : brand.surface,
                      paddingVertical: 9,
                      paddingHorizontal: 12,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Ionicons name={tab.icon} size={15} color={active ? brand.primary : brand.textMuted} />
                    <Text style={{ fontSize: 12, fontWeight: "700", color: active ? brand.primary : brand.text }}>
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {children}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
