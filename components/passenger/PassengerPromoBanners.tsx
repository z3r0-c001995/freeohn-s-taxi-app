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
            <MaterialCommunityIcons name="truck-fast" size={14} color="#15803D" />
            <Text style={styles.badgeText}>FREEOHN LOGISTICS</Text>
          </View>
        </View>

        <View style={styles.heroContentRow}>
          {/* Text details */}
          <View style={styles.heroTextColumn}>
            <Text style={styles.heroTitle}>
              FAST & RELIABLE{"\n"}DISPATCH & HAULING:
            </Text>
            <View style={styles.heroUrlPill}>
              <Ionicons name="flash" size={12} color="#DC2626" />
              <Text style={styles.heroUrlText}>Taxi • Motorbike • Delivery</Text>
            </View>
          </View>

          {/* Graphic Icon */}
          <View style={styles.heroGraphicContainer}>
            <MaterialCommunityIcons name="truck-check" size={72} color="#1E293B" />
          </View>
        </View>

        {/* Decorative corner stripes */}
        <View style={styles.heroDecoGreen} />
        <View style={styles.heroDecoRed} />
      </TouchableOpacity>

      {/* 2. Two-Column Deal Banners */}
      <View style={styles.dealsRow}>
        {/* Left Deal Card: Moto Haul Special */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => router.push({ pathname: "/request-ride" as never, params: { service: "moto" } })}
          style={[styles.dealCard, { backgroundColor: "#E2E8F0" }]}
        >
          <View style={styles.dealGraphicWrapper}>
            <MaterialCommunityIcons name="motorbike" size={48} color="#EA580C" />
          </View>
          <View style={styles.dealBottomTag}>
            <Text style={styles.dealBrandTitle}>MOTO HAUL</Text>
            <Text style={styles.dealSubtitle}>Express City Trips from K15</Text>
          </View>
        </TouchableOpacity>

        {/* Right Deal Card: Cab & Cargo Delivery */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => router.push({ pathname: "/request-ride" as never, params: { service: "delivery" } })}
          style={[styles.dealCard, { backgroundColor: "#1E293B" }]}
        >
          <View style={styles.dealSteakHeader}>
            <Text style={styles.dealSteakTitle}>PARCEL & CAB{"\n"}DELIVERY{"\n"}SPECIAL</Text>
          </View>

          {/* Price Badges */}
          <View style={styles.priceContainer}>
            <Text style={styles.originalPrice}>K50</Text>
            <View style={styles.dealPriceTag}>
              <Text style={styles.dealPriceText}>K35</Text>
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
