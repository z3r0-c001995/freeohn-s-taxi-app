import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { useRouter, usePathname } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useBrandTheme } from "@/hooks/use-brand-theme";
import { radii, shadows } from "@/constants/design-system";

export interface DriverNavItem {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
  route: string;
  badge?: number;
}

export function DriverNavBar() {
  const router = useRouter();
  const pathname = usePathname();
  const brand = useBrandTheme();

  const navItems: DriverNavItem[] = [
    {
      id: "drive",
      label: "Drive",
      icon: "car-outline",
      iconActive: "car",
      route: "/driver-dashboard",
    },
    {
      id: "earnings",
      label: "Earnings",
      icon: "wallet-outline",
      iconActive: "wallet",
      route: "/driver-earnings",
    },
    {
      id: "trips",
      label: "Trips",
      icon: "time-outline",
      iconActive: "time",
      route: "/ride-history",
    },
    {
      id: "profile",
      label: "Profile",
      icon: "shield-checkmark-outline",
      iconActive: "shield-checkmark",
      route: "/driver-profile",
    },
    {
      id: "settings",
      label: "Settings",
      icon: "settings-outline",
      iconActive: "settings",
      route: "/(tabs)/settings",
    },
  ];

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: brand.surface,
          borderTopColor: brand.border,
        },
      ]}
    >
      <View style={styles.navRow}>
        {navItems.map((item) => {
          const isActive = pathname === item.route || (item.id === "drive" && pathname === "/");
          return (
            <TouchableOpacity
              key={item.id}
              onPress={() => {
                if (!isActive) {
                  router.push(item.route as never);
                }
              }}
              style={styles.navButton}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.iconWrap,
                  isActive && {
                    backgroundColor: "#EFF6FF",
                  },
                ]}
              >
                <Ionicons
                  name={isActive ? item.iconActive : item.icon}
                  size={22}
                  color={isActive ? brand.primary : brand.textMuted}
                />
                {item.badge ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{item.badge}</Text>
                  </View>
                ) : null}
              </View>
              <Text
                style={[
                  styles.label,
                  {
                    color: isActive ? brand.primary : brand.textMuted,
                    fontWeight: isActive ? "800" : "600",
                  },
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    paddingTop: 8,
    paddingBottom: Platform.OS === "web" ? 14 : 24,
    ...shadows.lg,
  },
  navRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingHorizontal: 8,
  },
  navButton: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    paddingVertical: 4,
  },
  iconWrap: {
    width: 44,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  label: {
    fontSize: 11,
    marginTop: 2,
    letterSpacing: 0.2,
  },
  badge: {
    position: "absolute",
    top: -2,
    right: 4,
    backgroundColor: "#EF4444",
    borderRadius: 9,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    color: "#FFF",
    fontSize: 10,
    fontWeight: "800",
  },
});
