import { useEffect, useRef } from "react";
import { Animated, Platform, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useAppStore } from "@/lib/store";
import { useBrandTheme } from "@/hooks/use-brand-theme";

/**
 * Floating persistent banner shown whenever there is an active or in-progress
 * ride, so the user can return to the trip screen from any tab.
 */
export function ActiveRideBanner() {
  const router = useRouter();
  const brand = useBrandTheme();
  const { activeRide } = useAppStore();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const isActive =
    activeRide?.status === "accepted" ||
    activeRide?.status === "in_progress" ||
    activeRide?.status === "requested";

  useEffect(() => {
    if (!isActive) return;

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isActive, pulseAnim]);

  if (!isActive || !activeRide) return null;

  const label =
    activeRide.status === "requested"
      ? "Finding your driver..."
      : activeRide.status === "accepted"
        ? "Driver on the way"
        : "Ride in progress";

  const fareLabel =
    activeRide.fareAmount > 0 ? ` · ZMW ${activeRide.fareAmount.toFixed(2)}` : "";

  return (
    <TouchableOpacity
      onPress={() => router.push(`/trip/${activeRide.id}` as never)}
      activeOpacity={0.85}
      style={{
        position: Platform.OS === "web" ? ("fixed" as any) : "absolute",
        bottom: 80,
        left: 16,
        right: 16,
        zIndex: 9000,
        elevation: 16,
        backgroundColor: brand.primary,
        borderRadius: 40,
        paddingVertical: 12,
        paddingHorizontal: 20,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        shadowColor: brand.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 14,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Animated.View
          style={{
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: "#4ADE80",
            opacity: pulseAnim,
          }}
        />
        <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 14 }}>
          {label}
          {fareLabel}
        </Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 13 }}>View</Text>
        <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.8)" />
      </View>
    </TouchableOpacity>
  );
}
