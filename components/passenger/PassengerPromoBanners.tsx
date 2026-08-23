import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

export function PassengerPromoBanners() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      {/* 1. Main Hero Promotional Banner */}
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => router.push("/promotions" as never)}
        style={styles.heroBanner}
      >
        {/* Top subtle badge */}
        <View style={styles.heroHeaderRow}>
          <View style={styles.badgePill}>
            <MaterialCommunityIcons name="shield-check" size={14} color="#15803D" />
            <Text style={styles.badgeText}>OFFICIAL PARTNER</Text>
          </View>
        </View>

        <View style={styles.heroContentRow}>
          {/* Text details */}
          <View style={styles.heroTextColumn}>
            <Text style={styles.heroTitle}>
              GET THE 2026 ELECTION{"\n"}RESULTS ONLINE:
            </Text>
            <View style={styles.heroUrlPill}>
              <Ionicons name="globe-outline" size={12} color="#0F172A" />
              <Text style={styles.heroUrlText}>https://results.elections.org.zm</Text>
            </View>
          </View>

          {/* Graphic Icon */}
          <View style={styles.heroGraphicContainer}>
            <MaterialCommunityIcons name="laptop" size={72} color="#1E293B" />
          </View>
        </View>

        {/* Decorative corner stripes */}
        <View style={styles.heroDecoGreen} />
        <View style={styles.heroDecoRed} />
      </TouchableOpacity>

      {/* 2. Two-Column Deal Banners */}
      <View style={styles.dealsRow}>
        {/* Left Deal Card: Narottis Skillet */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => router.push("/promotions" as never)}
          style={[styles.dealCard, { backgroundColor: "#E2E8F0" }]}
        >
          <View style={styles.dealGraphicWrapper}>
            <MaterialCommunityIcons name="pot-steam" size={48} color="#EA580C" />
          </View>
          <View style={styles.dealBottomTag}>
            <Text style={styles.dealBrandTitle}>NAROTTIS</Text>
            <Text style={styles.dealSubtitle}>Special Skillet Meal</Text>
          </View>
        </TouchableOpacity>

        {/* Right Deal Card: Rump Steak & Onion Rings (K99 Special) */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => router.push("/promotions" as never)}
          style={[styles.dealCard, { backgroundColor: "#581C87" }]}
        >
          <View style={styles.dealSteakHeader}>
            <Text style={styles.dealSteakTitle}>RUMP STEAK,{"\n"}FRIES & ONION{"\n"}RINGS</Text>
          </View>

          {/* Price Badges */}
          <View style={styles.priceContainer}>
            <Text style={styles.originalPrice}>K249</Text>
            <View style={styles.dealPriceTag}>
              <Text style={styles.dealPriceText}>K99</Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 14,
    marginTop: 8,
    marginBottom: 24,
  },
  heroBanner: {
    borderRadius: 24,
    backgroundColor: "#F8FAFC",
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    overflow: "hidden",
    position: "relative",
  },
  heroHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  badgePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#166534",
    letterSpacing: 0.5,
  },
  heroContentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroTextColumn: {
    flex: 1.4,
  },
  heroTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#0F172A",
    lineHeight: 20,
    letterSpacing: 0.2,
  },
  heroUrlPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#E2E8F0",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: "flex-start",
    marginTop: 8,
  },
  heroUrlText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#334155",
  },
  heroGraphicContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  heroDecoGreen: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 60,
    height: 4,
    backgroundColor: "#16A34A",
  },
  heroDecoRed: {
    position: "absolute",
    top: 4,
    right: 0,
    width: 40,
    height: 4,
    backgroundColor: "#DC2626",
  },
  dealsRow: {
    flexDirection: "row",
    gap: 12,
  },
  dealCard: {
    flex: 1,
    height: 160,
    borderRadius: 24,
    padding: 14,
    justifyContent: "space-between",
    overflow: "hidden",
  },
  dealGraphicWrapper: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dealBottomTag: {
    backgroundColor: "rgba(255, 255, 255, 0.85)",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    alignItems: "center",
  },
  dealBrandTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: 0.5,
  },
  dealSubtitle: {
    fontSize: 11,
    color: "#475569",
    fontWeight: "600",
  },
  dealSteakHeader: {
    paddingTop: 4,
  },
  dealSteakTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: "#FFFFFF",
    lineHeight: 18,
    letterSpacing: 0.2,
  },
  priceContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
    marginTop: 10,
  },
  originalPrice: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FCA5A5",
    textDecorationLine: "line-through",
  },
  dealPriceTag: {
    backgroundColor: "#FACC15",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
  },
  dealPriceText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#000000",
  },
});
