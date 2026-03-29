import { useCallback, useEffect, useState } from "react";
import { Alert, Linking, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "@/components/screen-container";
import { AppBadge } from "@/components/ui/app-badge";
import { AppButton } from "@/components/ui/app-button";
import { AppCard } from "@/components/ui/app-card";
import { APP_LABEL, IS_DRIVER_APP } from "@/constants/app-variant";
import { radii, shadows } from "@/constants/design-system";
import { useBrandTheme } from "@/hooks/use-brand-theme";
import { getDriverProfile as getLocalDriverProfile } from "@/lib/db-service";
import { getDriverDashboard, updateDriverPayoutSettings } from "@/lib/ride-hailing-api";
import { useAppStore } from "@/lib/store";
import type { DriverProfileRecord, DriverStatusRecord } from "@shared/ride-hailing";

type DriverDashboardResponse = {
  profile: DriverProfileRecord;
  status: DriverStatusRecord | null;
};

type CurrentUserLike = {
  id: number;
  name: string | null;
  openId?: string | null;
  phone?: string | null;
};

function toLocalProfile(user: CurrentUserLike, local: Awaited<ReturnType<typeof getLocalDriverProfile>>): DriverProfileRecord {
  const nowIso = new Date().toISOString();
  return {
    driverId: `local-driver-${user.id}`,
    userId: user.id,
    verified: false,
    rating: 5,
    totalTrips: local?.totalTrips ?? 0,
    vehicle: {
      make: local?.vehicleMake ?? "Not provided",
      model: local?.vehicleModel ?? "Not provided",
      color: "Not provided",
      plateNumber: local?.plateNumber ?? "Not provided",
    },
    personalInfo: {
      fullName: user.name ?? "Not provided",
      phoneNumber: user.openId ?? user.phone ?? "Not provided",
      nrcNumber: "Not provided",
      homeAddress: "Not provided",
      emergencyContactName: null,
      emergencyContactPhone: null,
    },
    compliance: {
      driversLicenseNumber: local?.licenseNumber ?? "Not provided",
      vehicleRegistrationNumber: "Not provided",
      hasDriversLicense: Boolean(local?.licenseNumber),
      hasVehicleRegistrationDocument: false,
      insured: false,
      roadTaxCleared: false,
      fitnessTestPassed: false,
    },
    commercial: {
      ridesPurchased: 0,
      ridesCompleted: 0,
      notes: "Local profile fallback",
    },
    documents: {
      driversLicenseDocumentRef: "",
      vehicleRegistrationDocumentRef: "",
      insuranceDocumentRef: "",
      roadTaxDocumentRef: "",
      fitnessCertificateDocumentRef: "",
    },
    audit: {
      createdAt: local?.createdAt?.toISOString?.() ?? nowIso,
      updatedAt: local?.updatedAt?.toISOString?.() ?? nowIso,
      createdByAdminId: null,
      updatedByAdminId: null,
      verificationReviewedAt: null,
      compliance: {
        driversLicenseCheckedAt: null,
        vehicleRegistrationCheckedAt: null,
        insuranceCheckedAt: null,
        roadTaxCheckedAt: null,
        fitnessCheckedAt: null,
      },
    },
  };
}

function formatTime(value: string | null | undefined): string {
  if (!value) return "Pending";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Pending";
  return parsed.toLocaleString();
}

function ComplianceBadge({ label, ok }: { label: string; ok: boolean }) {
  return (
    <View
      style={{
        borderRadius: 999,
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderWidth: 1,
        borderColor: ok ? "#22C55E" : "#F59E0B",
        backgroundColor: ok ? "#ECFDF3" : "#FFF7ED",
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: "700", color: ok ? "#166534" : "#9A3412" }}>
        {label}: {ok ? "OK" : "Pending"}
      </Text>
    </View>
  );
}

function StatBox({ label, value, icon, brand }: any) {
  return (
    <View style={{ flex: 1, backgroundColor: brand.surface, borderRadius: radii.lg, padding: 16, borderWidth: 1, borderColor: brand.border, alignItems: "center", ...shadows.sm }}>
      <Ionicons name={icon} size={24} color={brand.primary} />
      <Text style={{ fontSize: 22, fontWeight: "800", color: brand.text, marginTop: 10 }}>{value}</Text>
      <Text style={{ fontSize: 12, color: brand.textMuted, marginTop: 2, fontWeight: "500" }}>{label}</Text>
    </View>
  );
}

function InfoRow({ label, value, icon, brand, noBorder = false }: any) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: noBorder ? 0 : 1, borderBottomColor: "rgba(0,0,0,0.04)" }}>
      <View style={{ width: 40, height: 40, borderRadius: 999, backgroundColor: "rgba(29,78,216,0.08)", alignItems: "center", justifyContent: "center", marginRight: 14 }}>
        <Ionicons name={icon} size={18} color={brand.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 11, color: brand.textMuted, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: "700" }}>{label}</Text>
        <Text style={{ fontSize: 14, fontWeight: "600", color: brand.text, marginTop: 2 }}>{value}</Text>
      </View>
    </View>
  );
}

export default function DriverProfileScreen() {
  const router = useRouter();
  const brand = useBrandTheme();
  const currentUser = useAppStore((state) => state.currentUser);

  const [profile, setProfile] = useState<DriverProfileRecord | null>(null);
  const [status, setStatus] = useState<DriverStatusRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [isEditingPayout, setIsEditingPayout] = useState(false);
  const [savingPayout, setSavingPayout] = useState(false);
  const [editPayoutNumber, setEditPayoutNumber] = useState("");
  const [editPayoutMethod, setEditPayoutMethod] = useState<"MOBILE_MONEY" | "BANK">("MOBILE_MONEY");

  const loadProfile = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const dashboard = (await getDriverDashboard()) as DriverDashboardResponse;
      setProfile(dashboard.profile);
      setStatus(dashboard.status);
      setIsOfflineMode(false);
      setError(null);
      return;
    } catch (apiError) {
      const message =
        apiError instanceof Error ? apiError.message : "Unable to load driver profile from backend";
      try {
        const localProfile = await getLocalDriverProfile(String(currentUser.id));
        if (localProfile) {
          setProfile(toLocalProfile(currentUser as CurrentUserLike, localProfile));
          setStatus(null);
          setIsOfflineMode(true);
          setError(message);
          return;
        }
      } catch {
        // Ignore local fallback errors and show original API error.
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  const savePayoutConfig = async () => {
    if (!profile) return;
    setSavingPayout(true);
    try {
      await updateDriverPayoutSettings({
        payoutMethod: editPayoutMethod,
        payoutAccountNumber: editPayoutNumber.trim() || null,
      });
      setIsEditingPayout(false);
      void loadProfile(); // Refresh profile values
      Alert.alert("Success", "Payout settings updated.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update payout settings";
      Alert.alert("Error", message);
    } finally {
      setSavingPayout(false);
    }
  };

  useEffect(() => {
    if (!IS_DRIVER_APP) {
      Alert.alert("Unavailable", "This page is only for the driver app.", [
        { text: "OK", onPress: () => router.replace("/(tabs)/settings") },
      ]);
      return;
    }
    if (!currentUser) return;
    void loadProfile();
  }, [currentUser, loadProfile, router]);

  if (!IS_DRIVER_APP) {
    return null;
  }

  if (!currentUser) {
    return (
      <ScreenContainer className="bg-background items-center justify-center">
        <Text style={{ color: brand.textMuted }}>Loading driver profile...</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="bg-background" containerClassName="bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <View style={{ gap: 16, paddingBottom: 20 }}>
          <View
            style={{
              borderRadius: radii.xl,
              padding: 18,
              backgroundColor: "#0A1E49",
              ...shadows.md,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <TouchableOpacity
                onPress={() => router.back()}
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
                <AppBadge
                  label={profile?.verified ? "Verified" : "Unverified"}
                  tone={profile?.verified ? "success" : "warning"}
                />
                <AppBadge
                  label={status?.isOnline ? "ONLINE" : "OFFLINE"}
                  tone={status?.isOnline ? "success" : "neutral"}
                />
              </View>
            </View>
            <Text style={{ marginTop: 14, color: "#FFFFFF", fontSize: 28, fontWeight: "800" }}>Driver Profile</Text>
            <Text style={{ marginTop: 6, color: "#CBD5E1", fontSize: 13 }}>{APP_LABEL}</Text>
            <View style={{ marginTop: 12 }}>
              <AppButton
                label={loading ? "Refreshing..." : "Refresh Profile"}
                loading={loading}
                variant="outline"
                onPress={() => {
                  void loadProfile();
                }}
                fullWidth={false}
                style={{ alignSelf: "flex-start", minWidth: 160 }}
                leftIcon={<Ionicons name="refresh" size={16} color={brand.accent} />}
              />
            </View>
          </View>

          {profile ? (
            <>
              <View style={{ flexDirection: "row", gap: 12, paddingHorizontal: 4 }}>
                <StatBox label="Rating" value={profile.rating.toFixed(2)} icon="star" brand={brand} />
                <StatBox label="Total Trips" value={profile.totalTrips} icon="car-sport" brand={brand} />
                <StatBox label="Credits" value={Math.max(0, profile.commercial.ridesPurchased - profile.commercial.ridesCompleted)} icon="wallet" brand={brand} />
              </View>

              <AppCard style={{ marginTop: 6, padding: 0, overflow: "hidden" }}>
                <View style={{ backgroundColor: "rgba(0,0,0,0.02)", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: brand.border, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ fontSize: 15, fontWeight: "800", color: brand.text }}>Payout Configuration</Text>
                  {!isEditingPayout && !isOfflineMode && (
                    <TouchableOpacity onPress={() => {
                        setEditPayoutNumber(profile.personalInfo.payoutAccountNumber || "");
                        setEditPayoutMethod(profile.personalInfo.payoutMethod || "MOBILE_MONEY");
                        setIsEditingPayout(true);
                      }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: "700", color: brand.primary }}>Edit</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <View style={{ paddingHorizontal: 16 }}>
                  {isEditingPayout ? (
                    <View style={{ paddingVertical: 16, gap: 12 }}>
                      <View>
                        <Text style={{ fontSize: 13, fontWeight: "600", color: brand.textMuted, marginBottom: 6 }}>Payout Method</Text>
                        <View style={{ flexDirection: "row", gap: 10 }}>
                          <TouchableOpacity
                            onPress={() => setEditPayoutMethod("MOBILE_MONEY")}
                            style={{ flex: 1, padding: 10, borderWidth: 1, borderRadius: radii.md, alignItems: "center", borderColor: editPayoutMethod === "MOBILE_MONEY" ? brand.primary : brand.border, backgroundColor: editPayoutMethod === "MOBILE_MONEY" ? `${brand.primary}10` : brand.surface }}
                          >
                            <Text style={{ fontSize: 13, fontWeight: "600", color: editPayoutMethod === "MOBILE_MONEY" ? brand.primary : brand.text }}>Mobile Money</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => setEditPayoutMethod("BANK")}
                            style={{ flex: 1, padding: 10, borderWidth: 1, borderRadius: radii.md, alignItems: "center", borderColor: editPayoutMethod === "BANK" ? brand.primary : brand.border, backgroundColor: editPayoutMethod === "BANK" ? `${brand.primary}10` : brand.surface }}
                          >
                            <Text style={{ fontSize: 13, fontWeight: "600", color: editPayoutMethod === "BANK" ? brand.primary : brand.text }}>Bank Account</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                      
                      <View>
                        <Text style={{ fontSize: 13, fontWeight: "600", color: brand.textMuted, marginBottom: 6 }}>Account / Mobile Number</Text>
                        <TextInput
                          value={editPayoutNumber}
                          onChangeText={setEditPayoutNumber}
                          placeholder="e.g. 0971234567"
                          placeholderTextColor={brand.textMuted}
                          style={{
                            borderWidth: 1,
                            borderColor: brand.border,
                            borderRadius: radii.md,
                            paddingHorizontal: 16,
                            paddingVertical: 12,
                            fontSize: 15,
                            color: brand.text,
                            backgroundColor: brand.surface,
                          }}
                          keyboardType="phone-pad"
                        />
                      </View>

                      <View style={{ flexDirection: "row", gap: 12, marginTop: 4 }}>
                        <AppButton
                          label="Cancel"
                          variant="outline"
                          onPress={() => setIsEditingPayout(false)}
                          style={{ flex: 1 }}
                          disabled={savingPayout}
                        />
                        <AppButton
                          label={savingPayout ? "Saving..." : "Save Settings"}
                          onPress={savePayoutConfig}
                          style={{ flex: 1 }}
                          loading={savingPayout}
                        />
                      </View>
                    </View>
                  ) : (
                    <>
                      <InfoRow label="Payout Method" value={profile.personalInfo.payoutMethod === "BANK" ? "Bank Account" : (profile.personalInfo.payoutMethod ? "Mobile Money" : "Not Set")} icon="wallet" brand={brand} />
                      <InfoRow label="Account Number" value={profile.personalInfo.payoutAccountNumber || "Not Set"} icon="cash-outline" brand={brand} noBorder />
                    </>
                  )}
                </View>
              </AppCard>

              <AppCard style={{ marginTop: 6, padding: 0, overflow: "hidden" }}>
                <View style={{ backgroundColor: "rgba(0,0,0,0.02)", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: brand.border }}>
                  <Text style={{ fontSize: 15, fontWeight: "800", color: brand.text }}>Personal Details</Text>
                </View>
                <View style={{ paddingHorizontal: 16 }}>
                  <InfoRow label="Full Name" value={profile.personalInfo.fullName} icon="person" brand={brand} />
                  <InfoRow label="Phone Number" value={profile.personalInfo.phoneNumber || "-"} icon="call" brand={brand} />
                  <InfoRow label="NRC Number" value={profile.personalInfo.nrcNumber || "-"} icon="id-card" brand={brand} />
                  <InfoRow label="Home Address" value={profile.personalInfo.homeAddress || "-"} icon="home" brand={brand} />
                  <InfoRow label="Emergency Contact" value={`${profile.personalInfo.emergencyContactName || "-"} (${profile.personalInfo.emergencyContactPhone || "-"})`} icon="medical" brand={brand} noBorder />
                </View>
              </AppCard>

              <AppCard style={{ padding: 0, overflow: "hidden" }}>
                <View style={{ backgroundColor: "rgba(0,0,0,0.02)", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: brand.border }}>
                  <Text style={{ fontSize: 15, fontWeight: "800", color: brand.text }}>Vehicle Details</Text>
                </View>
                <View style={{ paddingHorizontal: 16 }}>
                  <InfoRow label="Vehicle Make & Model" value={`${profile.vehicle.make} ${profile.vehicle.model}`} icon="car" brand={brand} />
                  <InfoRow label="Color" value={profile.vehicle.color} icon="color-palette" brand={brand} />
                  <InfoRow label="Plate Number" value={profile.vehicle.plateNumber} icon="pricetag" brand={brand} noBorder />
                </View>
              </AppCard>

              <AppCard style={{ padding: 0, overflow: "hidden" }}>
                <View style={{ backgroundColor: "rgba(0,0,0,0.02)", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: brand.border }}>
                  <Text style={{ fontSize: 15, fontWeight: "800", color: brand.text }}>Compliance & Legal</Text>
                </View>
                <View style={{ paddingHorizontal: 16 }}>
                  <InfoRow label="Driver License" value={profile.compliance.driversLicenseNumber || "-"} icon="card" brand={brand} />
                  <InfoRow label="Vehicle Registration" value={profile.compliance.vehicleRegistrationNumber || "-"} icon="document-text" brand={brand} noBorder />
                </View>
                
                <View style={{ padding: 16, paddingTop: 6, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  <ComplianceBadge label="License" ok={profile.compliance.hasDriversLicense} />
                  <ComplianceBadge label="Registration" ok={profile.compliance.hasVehicleRegistrationDocument} />
                  <ComplianceBadge label="Insurance" ok={profile.compliance.insured} />
                  <ComplianceBadge label="RATSA tax" ok={profile.compliance.roadTaxCleared} />
                  <ComplianceBadge label="Fitness" ok={profile.compliance.fitnessTestPassed} />
                </View>
              </AppCard>

              <AppCard tone="muted" style={{ padding: 0, overflow: "hidden" }}>
                <View style={{ backgroundColor: "rgba(0,0,0,0.03)", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: brand.border }}>
                  <Text style={{ fontSize: 13, fontWeight: "800", color: brand.textMuted }}>Audit Trail & Documents</Text>
                </View>
                <View style={{ padding: 16 }}>
                  <Text style={{ fontSize: 12, color: brand.textMuted, marginBottom: 4 }}>
                    <Text style={{ fontWeight: "700" }}>Created:</Text> {formatTime(profile.audit.createdAt)}
                  </Text>
                  <Text style={{ fontSize: 12, color: brand.textMuted, marginBottom: 4 }}>
                    <Text style={{ fontWeight: "700" }}>Last verification:</Text> {formatTime(profile.audit.verificationReviewedAt)}
                  </Text>
                  <View style={{ marginTop: 8, gap: 4 }}>
                    {profile.documents.driversLicenseDocumentRef ? (
                      <TouchableOpacity onPress={() => Linking.openURL(profile.documents.driversLicenseDocumentRef)}>
                        <Text style={{ fontSize: 12, color: brand.primary, textDecorationLine: "underline" }}>Driver license document: View</Text>
                      </TouchableOpacity>
                    ) : (
                      <Text style={{ fontSize: 12, color: brand.textMuted }}>Driver license document: Pending</Text>
                    )}
                    
                    {profile.documents.vehicleRegistrationDocumentRef ? (
                      <TouchableOpacity onPress={() => Linking.openURL(profile.documents.vehicleRegistrationDocumentRef)}>
                        <Text style={{ fontSize: 12, color: brand.primary, textDecorationLine: "underline" }}>Vehicle reg document: View</Text>
                      </TouchableOpacity>
                    ) : (
                      <Text style={{ fontSize: 12, color: brand.textMuted }}>Vehicle reg document: Pending</Text>
                    )}
                  </View>
                </View>
              </AppCard>
            </>
          ) : (
            <AppCard tone="muted">
              <Text style={{ color: brand.textMuted }}>No driver profile data available yet.</Text>
            </AppCard>
          )}

          {isOfflineMode ? (
            <AppCard tone="muted">
              <Text style={{ fontSize: 12, color: brand.textMuted }}>
                Offline/local fallback mode is active. Some admin-managed profile fields may be unavailable.
              </Text>
            </AppCard>
          ) : null}

          {error ? (
            <AppCard tone="muted">
              <Text style={{ color: brand.textMuted, fontSize: 12 }}>Profile sync note: {error}</Text>
            </AppCard>
          ) : null}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
