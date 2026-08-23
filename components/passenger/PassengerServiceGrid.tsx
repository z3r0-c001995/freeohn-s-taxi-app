import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

export function PassengerServiceGrid() {
  const router = useRouter();

  const handleOpenRides = () => {
    router.push("/request-ride" as never);
  };

  return (
    <View style={styles.container}>
      {/* Row 1: Shops & Delivery */}
      <View style={styles.row}>
        {/* Shops Card */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.push("/promotions" as never)}
          style={[styles.halfCard, { backgroundColor: "#F3F4F6" }]}
        >
          <View style={styles.cardGraphicContainer}>
            <View style={styles.cardGraphicShadow}>
              <MaterialCommunityIcons name="basket-fill" size={44} color="#EF4444" />
              <MaterialCommunityIcons
                name="egg"
                size={22}
                color="#FBBF24"
                style={{ position: "absolute", left: -6, bottom: 0 }}
              />
            </View>
          </View>
          <Text style={styles.cardLabel}>Shops</Text>
        </TouchableOpacity>

        {/* Delivery Card */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleOpenRides}
          style={[styles.halfCard, { backgroundColor: "#F3F4F6" }]}
        >
          <View style={styles.cardGraphicContainer}>
            <View style={styles.cardGraphicShadow}>
              <MaterialCommunityIcons name="motorbike" size={46} color="#DC2626" />
              <MaterialCommunityIcons
                name="package-variant-closed"
                size={22}
                color="#D97706"
                style={{ position: "absolute", right: -4, top: 4 }}
              />
            </View>
          </View>
          <Text style={styles.cardLabel}>Delivery</Text>
        </TouchableOpacity>
      </View>

      {/* Row 2: Navigation & Food */}
      <View style={styles.row}>
        {/* Navigation Card */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleOpenRides}
          style={[styles.halfCard, { backgroundColor: "#F3F4F6" }]}
        >
          <View style={styles.cardGraphicContainer}>
            <View style={[styles.navBadgeSquare, { backgroundColor: "#15803D" }]}>
              <View style={styles.navInnerNumber}>
                <Text style={styles.navNumberText}>1</Text>
              </View>
              <MaterialCommunityIcons name="navigation" size={24} color="#FBBF24" style={{ marginTop: 2 }} />
            </View>
          </View>
          <Text style={styles.cardLabel}>Navigation</Text>
        </TouchableOpacity>

        {/* Food Card with -K99 Promo Badge */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.push("/promotions" as never)}
          style={[styles.halfCard, { backgroundColor: "#F3F4F6" }]}
        >
          {/* Promo Tag */}
          <View style={styles.discountBadge}>
            <Text style={styles.discountBadgeText}>-K99</Text>
          </View>
          <View style={styles.cardGraphicContainer}>
            <View style={styles.cardGraphicShadow}>
              <MaterialCommunityIcons name="food-drumstick" size={40} color="#EA580C" />
              <MaterialCommunityIcons
                name="food-takeout-box"
                size={24}
                color="#DC2626"
                style={{ position: "absolute", left: -8, bottom: -2 }}
              />
            </View>
          </View>
          <Text style={styles.cardLabel}>Food</Text>
        </TouchableOpacity>
      </View>

      {/* Row 3: Games, Cargo, and Wide Rides Card */}
      <View style={styles.row}>
        {/* Games Card */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.push("/favourites" as never)}
          style={[styles.thirdCard, { backgroundColor: "#F3F4F6" }]}
        >
          <View style={styles.smallCardGraphicContainer}>
            <Ionicons name="game-controller" size={32} color="#EAB308" />
          </View>
          <Text style={styles.cardLabel}>Games</Text>
        </TouchableOpacity>

        {/* Cargo Card */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleOpenRides}
          style={[styles.thirdCard, { backgroundColor: "#F3F4F6" }]}
        >
          <View style={styles.smallCardGraphicContainer}>
            <MaterialCommunityIcons name="truck-delivery" size={34} color="#EA580C" />
          </View>
          <Text style={styles.cardLabel}>Cargo</Text>
        </TouchableOpacity>

        {/* Highlighted Rides Card */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleOpenRides}
          style={[styles.ridesCard, { backgroundColor: "#F3F4F6" }]}
        >
          <View style={styles.ridesGraphicRow}>
            {/* 3D Car Visual */}
            <View style={styles.carGraphicWrapper}>
              <Ionicons name="car" size={38} color="#DC2626" />
              <View style={styles.carRoofWhite} />
            </View>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
            <Text style={styles.ridesMainLabel}>Rides</Text>
            <Text style={styles.ridesEtaLabel}> • from 4 min</Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
    marginBottom: 16,
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  halfCard: {
    flex: 1,
    height: 108,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    position: "relative",
    overflow: "hidden",
  },
  thirdCard: {
    flex: 1,
    height: 104,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
  ridesCard: {
    flex: 1.8,
    height: 104,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  cardGraphicContainer: {
    height: 58,
    justifyContent: "center",
    alignItems: "center",
  },
  smallCardGraphicContainer: {
    height: 52,
    justifyContent: "center",
    alignItems: "center",
  },
  cardGraphicShadow: {
    alignItems: "center",
    justifyContent: "center",
  },
  cardLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1E293B",
    marginTop: 2,
  },
  discountBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "#000000",
    borderRadius: 12,
    paddingHorizontal: 7,
    paddingVertical: 2,
    zIndex: 10,
  },
  discountBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  navBadgeSquare: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#16A34A",
  },
  navInnerNumber: {
    position: "absolute",
    top: 4,
    left: 6,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  navNumberText: {
    fontSize: 9,
    fontWeight: "900",
    color: "#15803D",
  },
  ridesGraphicRow: {
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  carGraphicWrapper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  carRoofWhite: {
    position: "absolute",
    top: 4,
    left: 8,
    right: 8,
    height: 6,
    backgroundColor: "#FFFFFF",
    borderRadius: 3,
    opacity: 0.9,
  },
  ridesMainLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F172A",
  },
  ridesEtaLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
  },
});
