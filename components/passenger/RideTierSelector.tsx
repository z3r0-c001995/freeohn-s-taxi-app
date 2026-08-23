import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

export type RideTierId = "economy" | "comfort" | "fastest";

interface RideTierSelectorProps {
  selectedTier: RideTierId;
  onSelectTier: (tier: RideTierId) => void;
  baseFare: number;
  etaMinutes?: number;
}

export function RideTierSelector({
  selectedTier,
  onSelectTier,
  baseFare,
  etaMinutes = 4,
}: RideTierSelectorProps) {
  const tiers = [
    {
      id: "economy" as RideTierId,
      name: "Economy",
      price: Math.max(25, Math.round(baseFare || 33)),
      prefix: "",
      etaBadge: `${etaMinutes} min`,
      badgeBg: "#FFFFFF",
      badgeColor: "#0F172A",
      carColor: "#334155",
      carType: "sedan",
    },
    {
      id: "comfort" as RideTierId,
      name: "Comfort",
      price: Math.max(30, Math.round((baseFare || 33) * 1.15)),
      prefix: "",
      etaBadge: `${etaMinutes + 8} min`,
      badgeBg: "#E2E8F0",
      badgeColor: "#475569",
      carColor: "#1E293B",
      carType: "suv",
    },
    {
      id: "fastest" as RideTierId,
      name: "Fastest",
      price: Math.max(25, Math.round(baseFare || 33)),
      prefix: "from ",
      etaBadge: `${etaMinutes} min`,
      badgeBg: "#22C55E",
      badgeColor: "#FFFFFF",
      carColor: "#DC2626",
      carType: "fast",
    },
  ];

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {tiers.map((tier) => {
          const isSelected = selectedTier === tier.id;
          return (
            <TouchableOpacity
              key={tier.id}
              activeOpacity={0.85}
              onPress={() => onSelectTier(tier.id)}
              style={[
                styles.tierCard,
                isSelected ? styles.tierCardSelected : styles.tierCardNormal,
              ]}
            >
              {/* Graphic + Badge Row */}
              <View style={styles.graphicContainer}>
                {/* 3D-styled Car Graphic */}
                <View style={styles.carGraphic}>
                  <MaterialCommunityIcons
                    name={tier.id === "comfort" ? "car-estate" : "car-side"}
                    size={38}
                    color={isSelected ? "#000000" : tier.carColor}
                  />
                </View>

                {/* Floating ETA Badge */}
                <View style={[styles.etaBadge, { backgroundColor: tier.badgeBg }]}>
                  <Text style={[styles.etaBadgeText, { color: tier.badgeColor }]}>
                    {tier.etaBadge}
                  </Text>
                </View>
              </View>

              {/* Title & Price */}
              <Text style={[styles.tierName, isSelected && styles.tierNameSelected]}>
                {tier.name}
              </Text>
              <Text style={[styles.tierPrice, isSelected && styles.tierPriceSelected]}>
                {tier.prefix}K {tier.price}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
  },
  scrollContent: {
    paddingHorizontal: 4,
    gap: 10,
  },
  tierCard: {
    width: 108,
    borderRadius: 20,
    padding: 10,
    alignItems: "flex-start",
    justifyContent: "space-between",
    height: 104,
  },
  tierCardNormal: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
  },
  tierCardSelected: {
    backgroundColor: "#E2E8F0",
    borderWidth: 2,
    borderColor: "#0F172A",
  },
  graphicContainer: {
    width: "100%",
    height: 38,
    position: "relative",
    justifyContent: "center",
  },
  carGraphic: {
    alignSelf: "flex-start",
  },
  etaBadge: {
    position: "absolute",
    top: -2,
    left: 2,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  etaBadgeText: {
    fontSize: 10,
    fontWeight: "800",
  },
  tierName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748B",
    marginTop: 4,
  },
  tierNameSelected: {
    color: "#0F172A",
    fontWeight: "900",
  },
  tierPrice: {
    fontSize: 15,
    fontWeight: "900",
    color: "#0F172A",
  },
  tierPriceSelected: {
    color: "#000000",
  },
});
