import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

export type RideTierId =
  | "economy"
  | "comfort"
  | "fastest"
  | "moto_std"
  | "moto_fast"
  | "moto_plus"
  | "del_bike"
  | "del_moto"
  | "del_cab";

interface RideTierSelectorProps {
  selectedTier: RideTierId;
  onSelectTier: (tier: RideTierId) => void;
  baseFare: number;
  etaMinutes?: number;
  serviceType?: "taxi" | "moto" | "delivery";
}

export function RideTierSelector({
  selectedTier,
  onSelectTier,
  baseFare,
  etaMinutes = 4,
  serviceType = "taxi",
}: RideTierSelectorProps) {
  // Dynamic tiers based on Freeohn's logistics service
  const getTiers = () => {
    if (serviceType === "moto") {
      return [
        {
          id: "moto_std" as RideTierId,
          name: "Moto Standard",
          price: Math.max(15, Math.round((baseFare || 33) * 0.6)),
          prefix: "",
          etaBadge: `2 min`,
          badgeBg: "#FFFFFF",
          badgeColor: "#0F172A",
          iconName: "motorbike",
          carColor: "#EA580C",
        },
        {
          id: "moto_fast" as RideTierId,
          name: "Moto Fast",
          price: Math.max(18, Math.round((baseFare || 33) * 0.7)),
          prefix: "",
          etaBadge: `2 min`,
          badgeBg: "#22C55E",
          badgeColor: "#FFFFFF",
          iconName: "motorbike",
          carColor: "#DC2626",
        },
        {
          id: "moto_plus" as RideTierId,
          name: "Moto Plus",
          price: Math.max(22, Math.round((baseFare || 33) * 0.8)),
          prefix: "",
          etaBadge: `3 min`,
          badgeBg: "#E2E8F0",
          badgeColor: "#475569",
          iconName: "motorbike-electric",
          carColor: "#1E293B",
        },
      ];
    }

    if (serviceType === "delivery") {
      return [
        {
          id: "del_bike" as RideTierId,
          name: "Bicycle",
          price: Math.max(15, Math.round((baseFare || 33) * 0.5)),
          prefix: "up to 5kg • ",
          etaBadge: `8 min`,
          badgeBg: "#FFFFFF",
          badgeColor: "#0F172A",
          iconName: "bicycle",
          carColor: "#2563EB",
        },
        {
          id: "del_moto" as RideTierId,
          name: "Motorbike",
          price: Math.max(22, Math.round((baseFare || 33) * 0.75)),
          prefix: "up to 20kg • ",
          etaBadge: `3 min`,
          badgeBg: "#22C55E",
          badgeColor: "#FFFFFF",
          iconName: "motorbike",
          carColor: "#EA580C",
        },
        {
          id: "del_cab" as RideTierId,
          name: "Cab / Van",
          price: Math.max(35, Math.round((baseFare || 33) * 1.25)),
          prefix: "up to 200kg • ",
          etaBadge: `5 min`,
          badgeBg: "#E2E8F0",
          badgeColor: "#475569",
          iconName: "truck-delivery",
          carColor: "#DC2626",
        },
      ];
    }

    // Default: Taxi Hauling
    return [
      {
        id: "economy" as RideTierId,
        name: "Economy",
        price: Math.max(25, Math.round(baseFare || 33)),
        prefix: "",
        etaBadge: `${etaMinutes} min`,
        badgeBg: "#FFFFFF",
        badgeColor: "#0F172A",
        iconName: "car-side",
        carColor: "#334155",
      },
      {
        id: "comfort" as RideTierId,
        name: "Comfort",
        price: Math.max(30, Math.round((baseFare || 33) * 1.15)),
        prefix: "",
        etaBadge: `${etaMinutes + 8} min`,
        badgeBg: "#E2E8F0",
        badgeColor: "#475569",
        iconName: "car-estate",
        carColor: "#1E293B",
      },
      {
        id: "fastest" as RideTierId,
        name: "Fastest",
        price: Math.max(25, Math.round(baseFare || 33)),
        prefix: "from ",
        etaBadge: `${etaMinutes} min`,
        badgeBg: "#22C55E",
        badgeColor: "#FFFFFF",
        iconName: "car-sports",
        carColor: "#DC2626",
      },
    ];
  };

  const tiers = getTiers();

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
                <View style={styles.carGraphic}>
                  <MaterialCommunityIcons
                    name={tier.iconName as never}
                    size={36}
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
                K {tier.price}
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
