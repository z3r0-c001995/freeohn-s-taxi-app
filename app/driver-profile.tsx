import { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "@/components/screen-container";
import { DriverNavBar } from "@/components/navigation/DriverNavBar";
import { AppBadge } from "@/components/ui/app-badge";
import { AppButton } from "@/components/ui/app-button";
import { AppCard } from "@/components/ui/app-card";
import { radii, shadows } from "@/constants/design-system";
import { useBrandTheme } from "@/hooks/use-brand-theme";
import { getDriverDashboard, updateDriverPayoutSettings } from "@/lib/ride-hailing-api";
import { useAppStore } from "@/lib/store";
import type { DriverProfileRecord, DriverStatusRecord } from "@shared/ride-hailing";

export default function DriverProfileScreen() {
  const router = useRouter();
  const brand = useBrandTheme();
  const { currentUser } = useAppStore();

  const [profile, setProfile] = useState<DriverProfileRecord | null>(null);
  const [status, setStatus] = useState<DriverStatusRecord | null>(null);
  const [isSavingPayout, setIsSavingPayout] = useState(false);

  const [payoutMethod, setPayoutMethod] = useState<"MTN_MOMO" | "AIRTEL_MONEY" | "BANK">("MTN_MOMO");
  const [accountNumber, setAccountNumber] = useState(currentUser?.openId || "+260971000002");
  const [accountHolderName, setAccountHolderName] = useState(currentUser?.name || "Freeohn Driver");

  const loadProfile = useCallback(async () => {
    if (!currentUser) return;
    try {
      const data = await getDriverDashboard();
      if (data?.profile) {
        setProfile(data.profile);
      }
      if (data?.status) {
        setStatus(data.status);
      }
    } catch {
      // Fallback
    }
  }, [currentUser]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const handleSavePayout = async () => {
    try {
      setIsSavingPayout(true);
      await updateDriverPayoutSettings({
        payoutMethod,
        payoutAccountNumber: accountNumber.trim(),
      });
      Alert.alert("Payout Settings Saved", "Your mobile money payout details have been updated.");
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Unable to save payout settings");
    } finally {
      setIsSavingPayout(false);
    }
  };

  const remainingCredits = profile?.commercial
    ? Math.max(0, (profile.commercial.ridesPurchased ?? 0) - (profile.commercial.ridesCompleted ?? 0))
    : 50;

  return (
    <ScreenContainer className="bg-background" containerClassName="bg-background">
      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
          <View style={{ gap: 16, paddingHorizontal: 16, paddingTop: 16 }}>
            {/* Header */}
            <View
              style={[
                styles.headerCard,
                {
                  backgroundColor: "#0A1E49",
                  ...shadows.md,
                },
              ]}
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                  <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
                </TouchableOpacity>
                <AppBadge label="VERIFIED DRIVER" tone="success" />
              </View>
              <Text style={{ marginTop: 14, fontSize: 28, fontWeight: "900", color: "#FFFFFF" }}>Driver Profile</Text>
              <Text style={{ marginTop: 4, fontSize: 13, color: "#CBD5E1" }}>
                Identity, vehicle documentation & compliance records.
              </Text>
            </View>

            {/* Driver Identity Card */}
            <View
              style={[
                styles.idCard,
                {
                  backgroundColor: brand.surface,
                  borderColor: brand.border,
                },
              ]}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : "D"}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.name, { color: brand.text }]}>
                    {profile?.personalInfo?.fullName || currentUser?.name || "Freeohn Driver"}
                  </Text>
                  <Text style={[styles.phone, { color: brand.textMuted }]}>
                    {profile?.personalInfo?.phoneNumber || currentUser?.openId || "+260971000002"}
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 6 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Ionicons name="star" size={14} color="#F59E0B" />
                      <Text style={{ fontSize: 13, fontWeight: "800", color: brand.text }}>
                        {profile?.rating?.toFixed(1) || "5.0"}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 12, color: brand.textMuted }}>
                      {profile?.totalTrips || 0} Total Trips
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Vehicle Card */}
            <AppCard>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Ionicons name="car" size={20} color={brand.primary} />
                  <Text style={{ fontSize: 16, fontWeight: "800", color: brand.text }}>Vehicle Details</Text>
                </View>
                <View style={styles.plateBadge}>
                  <Text style={styles.plateText}>
                    {profile?.vehicle?.plateNumber || "ABC 1234 ZM"}
                  </Text>
                </View>
              </View>

              <View style={{ gap: 8 }}>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: brand.textMuted }]}>Make & Model</Text>
                  <Text style={[styles.detailValue, { color: brand.text }]}>
                    {profile?.vehicle?.make || "Toyota"} {profile?.vehicle?.model || "Aqua"}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: brand.textMuted }]}>Vehicle Color</Text>
                  <Text style={[styles.detailValue, { color: brand.text }]}>
                    {profile?.vehicle?.color || "Silver Metallic"}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: brand.textMuted }]}>License Class</Text>
                  <Text style={[styles.detailValue, { color: brand.text }]}>Class B (Public PSV)</Text>
                </View>
              </View>
            </AppCard>

            {/* Compliance & Verification Checklist */}
            <AppCard>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Ionicons name="shield-checkmark" size={20} color="#16A34A" />
                  <Text style={{ fontSize: 16, fontWeight: "800", color: brand.text }}>Compliance Records</Text>
                </View>
                <AppBadge label="100% COMPLIANT" tone="success" />
              </View>

              <View style={{ gap: 10 }}>
                {[
                  { label: "Driver's License", ref: profile?.compliance?.driversLicenseNumber || "DRV-1000", ok: true },
                  { label: "RATSA Road Tax Clearance", ref: "TAX-2026-OK", ok: true },
                  { label: "Vehicle Insurance", ref: "INS-ZM-5541", ok: true },
                  { label: "White Book Registration", ref: profile?.compliance?.vehicleRegistrationNumber || "REG-9912", ok: true },
                  { label: "Fitness Certificate", ref: "FIT-PASS-2026", ok: true },
                ].map((item) => (
                  <View
                    key={item.label}
                    style={[
                      styles.complianceRow,
                      {
                        backgroundColor: brand.surfaceMuted,
                        borderColor: brand.border,
                      },
                    ]}
                  >
                    <Ionicons name="checkmark-circle" size={20} color="#16A34A" />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.complianceLabel, { color: brand.text }]}>{item.label}</Text>
                      <Text style={[styles.complianceRef, { color: brand.textMuted }]}>Ref: {item.ref}</Text>
                    </View>
                    <Text style={{ fontSize: 11, fontWeight: "800", color: "#16A34A" }}>ACTIVE</Text>
                  </View>
                ))}
              </View>
            </AppCard>

            {/* Commercial Ride Credits */}
            <AppCard tone="primary">
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View>
                  <Text style={{ fontSize: 12, color: brand.textMuted }}>COMMERCIAL SUBSCRIPTION</Text>
                  <Text style={{ fontSize: 24, fontWeight: "900", color: brand.text }}>
                    {remainingCredits} Rides Left
                  </Text>
                  <Text style={{ fontSize: 12, color: "#16A34A", marginTop: 2, fontWeight: "700" }}>
                    ✓ 0% commission active
                  </Text>
                </View>
                <AppButton label="Top Up" size="sm" variant="secondary" onPress={() => {}} fullWidth={false} />
              </View>
            </AppCard>

            {/* Payout & MoMo Settings */}
            <AppCard>
              <Text style={{ fontSize: 16, fontWeight: "800", color: brand.text, marginBottom: 12 }}>
                Payout Details (Mobile Money)
              </Text>

              <View style={{ gap: 12 }}>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {(["MTN_MOMO", "AIRTEL_MONEY", "BANK"] as const).map((method) => (
                    <TouchableOpacity
                      key={method}
                      onPress={() => setPayoutMethod(method)}
                      style={[
                        styles.payoutPill,
                        {
                          backgroundColor: payoutMethod === method ? brand.primary : brand.surfaceMuted,
                          borderColor: payoutMethod === method ? brand.primary : brand.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.payoutPillText,
                          {
                            color: payoutMethod === method ? "#FFFFFF" : brand.text,
                            fontWeight: payoutMethod === method ? "800" : "600",
                          },
                        ]}
                      >
                        {method.replace("_", " ")}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View>
                  <Text style={[styles.inputLabel, { color: brand.textMuted }]}>Phone / Account Number</Text>
                  <TextInput
                    value={accountNumber}
                    onChangeText={setAccountNumber}
                    placeholder="+260..."
                    style={[styles.input, { borderColor: brand.border, color: brand.text }]}
                  />
                </View>

                <View>
                  <Text style={[styles.inputLabel, { color: brand.textMuted }]}>Account Name</Text>
                  <TextInput
                    value={accountHolderName}
                    onChangeText={setAccountHolderName}
                    placeholder="Full Name"
                    style={[styles.input, { borderColor: brand.border, color: brand.text }]}
                  />
                </View>

                <AppButton
                  label="Save Payout Settings"
                  loading={isSavingPayout}
                  onPress={() => void handleSavePayout()}
                />
              </View>
            </AppCard>
          </View>
        </ScrollView>

        {/* Bottom Navigation */}
        <DriverNavBar />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerCard: {
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#1E3A8A",
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.16)",
  },
  idCard: {
    borderRadius: 20,
    padding: 18,
    borderWidth: 1.5,
    ...shadows.md,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "900",
  },
  name: {
    fontSize: 18,
    fontWeight: "800",
  },
  phone: {
    fontSize: 13,
    marginTop: 2,
  },
  plateBadge: {
    backgroundColor: "#FEF08A",
    borderWidth: 1.5,
    borderColor: "#000000",
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  plateText: {
    color: "#000000",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 1,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  detailLabel: {
    fontSize: 13,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: "700",
  },
  complianceRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  complianceLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
  complianceRef: {
    fontSize: 11,
    marginTop: 1,
  },
  payoutPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  payoutPillText: {
    fontSize: 11,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    fontWeight: "600",
  },
});
