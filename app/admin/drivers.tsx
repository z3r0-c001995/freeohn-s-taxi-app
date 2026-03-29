import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Text, View } from "react-native";

import { AdminShell } from "@/components/admin/admin-shell";
import { AppBadge } from "@/components/ui/app-badge";
import { AppButton } from "@/components/ui/app-button";
import { AppCard } from "@/components/ui/app-card";
import { AppInput } from "@/components/ui/app-input";
import { radii } from "@/constants/design-system";
import { useBrandTheme } from "@/hooks/use-brand-theme";
import { useAdminPortalGuard } from "@/hooks/use-admin-portal-guard";
import {
  addDriverRideCredits,
  getAdminDrivers,
  setDriverVerification,
  updateDriverCredentials,
  type AdminDriversResponse,
} from "@/lib/admin-portal-api";
import { formatAuditTime } from "@/lib/admin-portal-types";

export default function AdminDriversScreen() {
  const brand = useBrandTheme();
  const { ready, logout } = useAdminPortalGuard();
  const [drivers, setDrivers] = useState<AdminDriversResponse["drivers"]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifyingDriverId, setVerifyingDriverId] = useState<string | null>(null);
  const [creditLoadingDriverId, setCreditLoadingDriverId] = useState<string | null>(null);
  const [creditTopups, setCreditTopups] = useState<Record<string, string>>({});
  const [credentialForms, setCredentialForms] = useState<
    Record<string, { openId: string; password: string; isActive: boolean }>
  >({});
  const [credentialSavingDriverId, setCredentialSavingDriverId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!ready) return;
    try {
      setLoading(true);
      const next = await getAdminDrivers();
      setDrivers(next.drivers);
      setCredentialForms((prev) => {
        const merged: Record<string, { openId: string; password: string; isActive: boolean }> = {};
        for (const driver of next.drivers) {
          const current = prev[driver.driverId];
          merged[driver.driverId] = {
            openId: current?.openId ?? driver.account?.openId ?? String(driver.userId),
            password: current?.password ?? "",
            isActive: current?.isActive ?? driver.account?.isActive ?? true,
          };
        }
        return merged;
      });
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load drivers.");
    } finally {
      setLoading(false);
    }
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    void refresh();
    const timer = setInterval(() => {
      void refresh();
    }, 7000);
    return () => clearInterval(timer);
  }, [ready, refresh]);

  const summary = useMemo(() => {
    const total = drivers.length;
    const verified = drivers.filter((driver) => driver.verified).length;
    const online = drivers.filter((driver) => driver.status?.isOnline).length;
    return { total, verified, online };
  }, [drivers]);

  const toggleVerification = async (driverId: string, verified: boolean) => {
    try {
      setVerifyingDriverId(driverId);
      await setDriverVerification(driverId, verified);
      await refresh();
    } catch (toggleError) {
      Alert.alert("Verification update failed", toggleError instanceof Error ? toggleError.message : "Unknown error");
    } finally {
      setVerifyingDriverId(null);
    }
  };

  const topUpCredits = async (driverId: string) => {
    const rawValue = creditTopups[driverId] ?? "";
    const ridesToAdd = Number(rawValue);
    if (!Number.isInteger(ridesToAdd) || ridesToAdd <= 0) {
      Alert.alert("Validation", "Enter a positive whole number for ride credits.");
      return;
    }

    try {
      setCreditLoadingDriverId(driverId);
      await addDriverRideCredits(driverId, ridesToAdd);
      setCreditTopups((prev) => ({ ...prev, [driverId]: "" }));
      await refresh();
      Alert.alert("Credits updated", `Added ${ridesToAdd} ride credits.`);
    } catch (topupError) {
      Alert.alert("Credit update failed", topupError instanceof Error ? topupError.message : "Unknown error");
    } finally {
      setCreditLoadingDriverId(null);
    }
  };

  const saveCredentials = async (driverId: string) => {
    const form = credentialForms[driverId];
    if (!form) {
      Alert.alert("Validation", "Credential form not ready. Refresh and try again.");
      return;
    }

    if (!form.openId.trim()) {
      Alert.alert("Validation", "Login Open ID is required.");
      return;
    }

    if (form.password.trim() && form.password.trim().length < 6) {
      Alert.alert("Validation", "New password must be at least 6 characters.");
      return;
    }

    try {
      setCredentialSavingDriverId(driverId);
      await updateDriverCredentials(driverId, {
        openId: form.openId.trim(),
        password: form.password.trim() || undefined,
        isActive: form.isActive,
      });
      setCredentialForms((prev) => ({
        ...prev,
        [driverId]: {
          ...prev[driverId],
          openId: form.openId.trim(),
          password: "",
          isActive: form.isActive,
        },
      }));
      await refresh();
      Alert.alert("Credentials saved", "Driver login credentials were updated.");
    } catch (credentialError) {
      Alert.alert(
        "Credentials update failed",
        credentialError instanceof Error ? credentialError.message : "Unknown error",
      );
    } finally {
      setCredentialSavingDriverId(null);
    }
  };

  if (!ready) {
    return null;
  }

  return (
    <AdminShell
      title="Drivers"
      subtitle="Identity, compliance checks, and operational status."
      activeTab="drivers"
      onLogout={() => {
        void logout();
      }}
      onRefresh={() => {
        void refresh();
      }}
      refreshLabel={loading ? "Refreshing..." : "Refresh Drivers"}
      statusLabel={loading ? "Refreshing" : "Admin"}
    >
      <View style={{ flexDirection: "row", gap: 10 }}>
        <AppCard style={{ flex: 1 }}>
          <Text style={{ fontSize: 12, color: brand.textMuted }}>Total drivers</Text>
          <Text style={{ marginTop: 4, fontSize: 24, fontWeight: "800", color: brand.text }}>{summary.total}</Text>
        </AppCard>
        <AppCard style={{ flex: 1 }}>
          <Text style={{ fontSize: 12, color: brand.textMuted }}>Verified</Text>
          <Text style={{ marginTop: 4, fontSize: 24, fontWeight: "800", color: brand.text }}>{summary.verified}</Text>
        </AppCard>
        <AppCard style={{ flex: 1 }}>
          <Text style={{ fontSize: 12, color: brand.textMuted }}>Online now</Text>
          <Text style={{ marginTop: 4, fontSize: 24, fontWeight: "800", color: brand.text }}>{summary.online}</Text>
        </AppCard>
      </View>

      {error ? (
        <AppCard tone="muted">
          <Text style={{ color: brand.danger, fontWeight: "700" }}>Driver list error</Text>
          <Text style={{ marginTop: 4, color: brand.textMuted, fontSize: 13 }}>{error}</Text>
        </AppCard>
      ) : null}

      <AppCard>
        <Text style={{ fontSize: 18, fontWeight: "800", color: brand.text }}>Driver Directory</Text>
        <Text style={{ marginTop: 4, fontSize: 13, color: brand.textMuted }}>
          Verify compliance and top up ride credits from this page.
        </Text>

        <View style={{ marginTop: 12, gap: 10 }}>
          {drivers.length === 0 ? (
            <Text style={{ color: brand.textMuted }}>No drivers found.</Text>
          ) : (
            drivers.map((driver) => (
              <View
                key={driver.driverId}
                style={{
                  borderRadius: radii.md,
                  borderWidth: 1,
                  borderColor: brand.border,
                  padding: 12,
                  backgroundColor: brand.surfaceMuted,
                }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: "800", color: brand.text }}>
                      {driver.personalInfo.fullName} ({driver.driverId})
                    </Text>
                    <Text style={{ marginTop: 2, color: brand.textMuted, fontSize: 12 }}>
                      userId {driver.userId} • {driver.personalInfo.phoneNumber} • NRC {driver.personalInfo.nrcNumber}
                    </Text>
                    <Text style={{ marginTop: 2, color: brand.textMuted, fontSize: 12 }}>
                      {driver.vehicle.make} {driver.vehicle.model} • {driver.vehicle.plateNumber} • {driver.vehicle.color}
                    </Text>
                  </View>
                  <AppBadge label={driver.status?.isOnline ? "ONLINE" : "OFFLINE"} tone={driver.status?.isOnline ? "success" : "neutral"} />
                </View>

                <Text style={{ marginTop: 2, color: brand.textMuted, fontSize: 12 }}>
                  Address: {driver.personalInfo.homeAddress}
                </Text>
                <Text style={{ marginTop: 2, color: brand.textMuted, fontSize: 12 }}>
                  Payout Settings: {driver.personalInfo.payoutMethod === "BANK" ? "Bank Account" : (driver.personalInfo.payoutMethod ? "Mobile Money" : "Not Set")} • Number: {driver.personalInfo.payoutAccountNumber || "N/A"}
                </Text>
                <Text style={{ marginTop: 2, color: brand.textMuted, fontSize: 12 }}>
                  Docs: DL {driver.compliance.driversLicenseNumber} • REG {driver.compliance.vehicleRegistrationNumber}
                </Text>
                <Text style={{ marginTop: 2, color: brand.textMuted, fontSize: 12 }}>
                  Upload refs: {driver.documents.driversLicenseDocumentRef}, {driver.documents.vehicleRegistrationDocumentRef}
                </Text>
                <Text style={{ marginTop: 2, color: brand.textMuted, fontSize: 12 }}>
                  Insurance: {driver.documents.insuranceDocumentRef} • Road tax: {driver.documents.roadTaxDocumentRef}
                </Text>
                <Text style={{ marginTop: 2, color: brand.textMuted, fontSize: 12 }}>
                  Fitness: {driver.documents.fitnessCertificateDocumentRef}
                </Text>
                <Text style={{ marginTop: 2, color: brand.textMuted, fontSize: 12 }}>
                  Compliance: license {driver.compliance.hasDriversLicense ? "yes" : "no"}, registration {driver.compliance.hasVehicleRegistrationDocument ? "yes" : "no"}, insurance {driver.compliance.insured ? "yes" : "no"}, tax {driver.compliance.roadTaxCleared ? "yes" : "no"}, fitness {driver.compliance.fitnessTestPassed ? "yes" : "no"}
                </Text>
                <Text style={{ marginTop: 2, color: brand.textMuted, fontSize: 12 }}>
                  Credits: purchased {driver.commercial.ridesPurchased}, used {driver.commercial.ridesCompleted}, remaining {driver.commercial.ridesRemaining}
                </Text>
                <Text style={{ marginTop: 2, color: brand.textMuted, fontSize: 12 }}>
                  Verified: {driver.verified ? "Yes" : "No"} • Rating: {driver.rating.toFixed(2)} • Trips: {driver.totalTrips}
                </Text>
                <Text style={{ marginTop: 2, color: brand.textMuted, fontSize: 12 }}>
                  Active trip: {driver.status?.activeTripId ?? "None"}
                </Text>
                <Text style={{ marginTop: 2, color: brand.textMuted, fontSize: 12 }}>
                  Audit: created {formatAuditTime(driver.audit.createdAt)} • updated {formatAuditTime(driver.audit.updatedAt)}
                </Text>
                <Text style={{ marginTop: 2, color: brand.textMuted, fontSize: 12 }}>
                  Login: {driver.account?.openId ?? "Not configured"} •{" "}
                  {driver.account?.isActive ? "Active" : "Inactive"} • last login{" "}
                  {formatAuditTime(driver.account?.lastLoginAt)}
                </Text>
                <Text style={{ marginTop: 2, color: brand.textMuted, fontSize: 12 }}>
                  Password updated: {formatAuditTime(driver.account?.passwordUpdatedAt)}
                </Text>

                <View style={{ marginTop: 8, gap: 8 }}>
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <AppInput
                        label="Add ride credits"
                        placeholder="e.g. 25"
                        keyboardType="number-pad"
                        value={creditTopups[driver.driverId] ?? ""}
                        onChangeText={(value) => setCreditTopups((prev) => ({ ...prev, [driver.driverId]: value }))}
                      />
                    </View>
                    <View style={{ width: 160, justifyContent: "flex-end" }}>
                      <AppButton
                        label="Top Up Credits"
                        size="sm"
                        loading={creditLoadingDriverId === driver.driverId}
                        onPress={() => {
                          void topUpCredits(driver.driverId);
                        }}
                      />
                    </View>
                  </View>
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <AppInput
                        label="Driver login open ID"
                        placeholder="phone / employee ID"
                        value={credentialForms[driver.driverId]?.openId ?? ""}
                        onChangeText={(value) =>
                          setCredentialForms((prev) => ({
                            ...prev,
                            [driver.driverId]: {
                              openId: value,
                              password: prev[driver.driverId]?.password ?? "",
                              isActive: prev[driver.driverId]?.isActive ?? true,
                            },
                          }))
                        }
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <AppInput
                        label="New password (optional)"
                        placeholder="leave blank to keep current"
                        secureTextEntry
                        value={credentialForms[driver.driverId]?.password ?? ""}
                        onChangeText={(value) =>
                          setCredentialForms((prev) => ({
                            ...prev,
                            [driver.driverId]: {
                              openId: prev[driver.driverId]?.openId ?? String(driver.userId),
                              password: value,
                              isActive: prev[driver.driverId]?.isActive ?? true,
                            },
                          }))
                        }
                      />
                    </View>
                  </View>
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <AppButton
                        label={
                          credentialForms[driver.driverId]?.isActive !== false
                            ? "Set Login Inactive"
                            : "Set Login Active"
                        }
                        size="sm"
                        variant={credentialForms[driver.driverId]?.isActive !== false ? "danger" : "success"}
                        onPress={() =>
                          setCredentialForms((prev) => ({
                            ...prev,
                            [driver.driverId]: {
                              openId: prev[driver.driverId]?.openId ?? String(driver.userId),
                              password: prev[driver.driverId]?.password ?? "",
                              isActive: !(prev[driver.driverId]?.isActive ?? true),
                            },
                          }))
                        }
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <AppButton
                        label="Save Credentials"
                        size="sm"
                        loading={credentialSavingDriverId === driver.driverId}
                        onPress={() => {
                          void saveCredentials(driver.driverId);
                        }}
                      />
                    </View>
                  </View>
                  <AppButton
                    label={driver.verified ? "Mark Unverified" : "Mark Verified"}
                    variant={driver.verified ? "danger" : "success"}
                    size="sm"
                    loading={verifyingDriverId === driver.driverId}
                    onPress={() => {
                      void toggleVerification(driver.driverId, !driver.verified);
                    }}
                  />
                </View>
              </View>
            ))
          )}
        </View>
      </AppCard>
    </AdminShell>
  );
}
