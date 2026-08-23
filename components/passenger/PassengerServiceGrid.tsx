import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert, Modal } from "react-native";
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from "@expo/vector-icons";
import { useRouter } from "expo-router";

export function PassengerServiceGrid() {
  const router = useRouter();
  const [comingSoonModal, setComingSoonModal] = useState<{
    visible: boolean;
    title: string;
    description: string;
    icon: string;
  }>({
    visible: false,
    title: "",
    description: "",
    icon: "clock-outline",
  });

  const handleOpenRides = (serviceType: "taxi" | "moto" | "delivery") => {
    router.push({
      pathname: "/request-ride" as never,
      params: { service: serviceType },
    });
  };

  const handleComingSoon = (title: string, description: string, icon: string) => {
    setComingSoonModal({
      visible: true,
      title,
      description,
      icon,
    });
  };

  return (
    <View style={styles.container}>
      {/* Row 1: Taxi Hauling & Motorbike Hauling */}
      <View style={styles.row}>
        {/* 1. Taxi Hauling Card */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => handleOpenRides("taxi")}
          style={[styles.halfCard, { backgroundColor: "#F3F4F6" }]}
        >
          <View style={styles.cardGraphicContainer}>
            <View style={styles.carGraphicWrapper}>
              <Ionicons name="car" size={42} color="#DC2626" />
              <View style={styles.carSpeedLine} />
            </View>
          </View>
          <View style={styles.labelRow}>
            <Text style={styles.cardMainTitle}>Taxi Hauling</Text>
            <Text style={styles.cardEtaSubtitle}>• from 3 min</Text>
          </View>
        </TouchableOpacity>

        {/* 2. Motorbike Hauling Card */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => handleOpenRides("moto")}
          style={[styles.halfCard, { backgroundColor: "#F3F4F6" }]}
        >
          <View style={styles.cardGraphicContainer}>
            <View style={styles.motoGraphicWrapper}>
              <MaterialCommunityIcons name="motorbike" size={44} color="#EA580C" />
              <MaterialCommunityIcons
                name="lightning-bolt"
                size={18}
                color="#FBBF24"
                style={{ position: "absolute", top: -2, right: -4 }}
              />
            </View>
          </View>
          <View style={styles.labelRow}>
            <Text style={styles.cardMainTitle}>Motorbike Hauling</Text>
            <Text style={styles.cardEtaSubtitle}>• from 2 min</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Row 2: Delivery (Bike • Motorbike • Cab) */}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => handleOpenRides("delivery")}
        style={[styles.fullDeliveryCard, { backgroundColor: "#F3F4F6" }]}
      >
        <View style={styles.deliveryContentRow}>
          <View style={styles.deliveryTextColumn}>
            <View style={styles.deliveryHeaderRow}>
              <Text style={styles.deliveryMainTitle}>Delivery</Text>
              <View style={styles.activePill}>
                <Text style={styles.activePillText}>ACTIVE</Text>
              </View>
            </View>
            <Text style={styles.deliverySubtext}>Bike • Motorbike • Cab</Text>
            <Text style={styles.deliveryDescription}>
              Instant courier & parcel transport based on your package size
            </Text>
          </View>

          {/* Graphic cluster: Bike, Moto, Cab, Box */}
          <View style={styles.deliveryIconsCluster}>
            <View style={styles.parcelIconBadge}>
              <MaterialCommunityIcons name="package-variant-closed" size={32} color="#DC2626" />
            </View>
            <View style={styles.vehiclePillsRow}>
              <MaterialCommunityIcons name="bicycle" size={16} color="#475569" />
              <MaterialCommunityIcons name="motorbike" size={16} color="#475569" />
              <MaterialCommunityIcons name="car-side" size={16} color="#475569" />
            </View>
          </View>
        </View>
      </TouchableOpacity>

      {/* Row 3: Courier & Cleaning Services (Coming Soon) */}
      <View style={styles.row}>
        {/* 4. Courier Card (Coming Soon) */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() =>
            handleComingSoon(
              "Freeohn Courier",
              "Our express nationwide parcel delivery and document logistics service is launching soon across Zambia!",
              "truck-fast"
            )
          }
          style={[styles.halfCard, styles.comingSoonCard]}
        >
          <View style={styles.comingSoonBadge}>
            <Text style={styles.comingSoonBadgeText}>COMING SOON</Text>
          </View>
          <View style={styles.cardGraphicContainer}>
            <MaterialCommunityIcons name="truck-fast" size={38} color="#94A3B8" />
          </View>
          <Text style={styles.comingSoonLabel}>Courier</Text>
        </TouchableOpacity>

        {/* 5. Cleaning Services Card (Coming Soon) */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() =>
            handleComingSoon(
              "Cleaning Services",
              "Professional home, office, and commercial cleaning on-demand by Freeohn logistics will be available soon!",
              "sparkles"
            )
          }
          style={[styles.halfCard, styles.comingSoonCard]}
        >
          <View style={styles.comingSoonBadge}>
            <Text style={styles.comingSoonBadgeText}>COMING SOON</Text>
          </View>
          <View style={styles.cardGraphicContainer}>
            <MaterialCommunityIcons name="spray-bottle" size={38} color="#94A3B8" />
          </View>
          <Text style={styles.comingSoonLabel}>Cleaning Services</Text>
        </TouchableOpacity>
      </View>

      {/* Coming Soon Interactive Modal */}
      <Modal
        visible={comingSoonModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setComingSoonModal((prev) => ({ ...prev, visible: false }))}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconContainer}>
              <MaterialCommunityIcons
                name={comingSoonModal.icon as never}
                size={40}
                color="#EA580C"
              />
            </View>

            <Text style={styles.modalTitle}>{comingSoonModal.title}</Text>
            <View style={styles.modalBadge}>
              <Text style={styles.modalBadgeText}>COMING SOON</Text>
            </View>

            <Text style={styles.modalDesc}>{comingSoonModal.description}</Text>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setComingSoonModal((prev) => ({ ...prev, visible: false }))}
              style={styles.modalBtn}
            >
              <Text style={styles.modalBtnText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    height: 112,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    position: "relative",
    overflow: "hidden",
  },
  cardGraphicContainer: {
    height: 52,
    justifyContent: "center",
    alignItems: "center",
  },
  carGraphicWrapper: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  carSpeedLine: {
    position: "absolute",
    bottom: -2,
    width: 28,
    height: 3,
    backgroundColor: "#FCA5A5",
    borderRadius: 2,
  },
  motoGraphicWrapper: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  labelRow: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  cardMainTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
    textAlign: "center",
  },
  cardEtaSubtitle: {
    fontSize: 11,
    fontWeight: "600",
    color: "#DC2626",
    marginTop: 1,
  },
  fullDeliveryCard: {
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  deliveryContentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  deliveryTextColumn: {
    flex: 1,
    paddingRight: 12,
  },
  deliveryHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 2,
  },
  deliveryMainTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0F172A",
  },
  activePill: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  activePillText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#16A34A",
    letterSpacing: 0.5,
  },
  deliverySubtext: {
    fontSize: 13,
    fontWeight: "700",
    color: "#EA580C",
    marginBottom: 4,
  },
  deliveryDescription: {
    fontSize: 11,
    color: "#64748B",
    lineHeight: 15,
  },
  deliveryIconsCluster: {
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  parcelIconBadge: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
  },
  vehiclePillsRow: {
    flexDirection: "row",
    gap: 6,
    backgroundColor: "#E2E8F0",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  comingSoonCard: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    opacity: 0.85,
  },
  comingSoonBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  comingSoonBadgeText: {
    fontSize: 8,
    fontWeight: "800",
    color: "#B45309",
    letterSpacing: 0.4,
  },
  comingSoonLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  modalIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FFEDD5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 6,
  },
  modalBadge: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    marginBottom: 12,
  },
  modalBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#B45309",
  },
  modalDesc: {
    fontSize: 13,
    color: "#475569",
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 20,
  },
  modalBtn: {
    width: "100%",
    backgroundColor: "#0F172A",
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
  },
  modalBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});

