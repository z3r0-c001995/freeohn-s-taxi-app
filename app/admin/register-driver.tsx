import { useState } from "react";
import { Alert, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { AdminShell } from "@/components/admin/admin-shell";
import { AppButton } from "@/components/ui/app-button";
import { AppCard } from "@/components/ui/app-card";
import { AppInput } from "@/components/ui/app-input";
import { radii } from "@/constants/design-system";
import { useBrandTheme } from "@/hooks/use-brand-theme";
import { useAdminPortalGuard } from "@/hooks/use-admin-portal-guard";
import { registerDriver } from "@/lib/admin-portal-api";
import { DEFAULT_DRIVER_FORM, type DriverFormState } from "@/lib/admin-portal-types";

function ComplianceToggle({
  label,
  value,
  onPress,
}: {
  label: string;
  value: boolean;
  onPress: () => void;
}) {
  const brand = useBrandTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: value ? brand.success : brand.border,
        paddingVertical: 11,
        paddingHorizontal: 12,
        backgroundColor: value ? "#ECFDF3" : brand.surface,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <Text style={{ color: brand.text, fontWeight: "700" }}>{label}</Text>
      <Ionicons
        name={value ? "checkmark-circle" : "ellipse-outline"}
        size={20}
        color={value ? brand.success : brand.textMuted}
      />
    </TouchableOpacity>
  );
}

export default function AdminRegisterDriverScreen() {
  const { ready, logout } = useAdminPortalGuard();
  const [form, setForm] = useState<DriverFormState>(DEFAULT_DRIVER_FORM);
  const [submitting, setSubmitting] = useState(false);

  const submitDriver = async () => {
    const parsedUserId = Number(form.userId);
    if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
      Alert.alert("Validation", "Provide a valid numeric user ID for the driver.");
      return;
    }

    const ridesPurchased = Number(form.ridesPurchased);
    if (!Number.isInteger(ridesPurchased) || ridesPurchased <= 0) {
      Alert.alert("Validation", "Rides purchased must be a positive whole number.");
      return;
    }

    if (form.loginPassword.trim() && form.loginPassword.trim().length < 6) {
      Alert.alert("Validation", "Driver login password must be at least 6 characters.");
      return;
    }

    if (
      !form.fullName.trim() ||
      !form.phoneNumber.trim() ||
      !form.nrcNumber.trim() ||
      !form.homeAddress.trim() ||
      !form.vehicleMake.trim() ||
      !form.vehicleModel.trim() ||
      !form.vehicleColor.trim() ||
      !form.plateNumber.trim() ||
      !form.driversLicenseNumber.trim() ||
      !form.vehicleRegistrationNumber.trim() ||
      !form.driversLicenseDocumentRef.trim() ||
      !form.vehicleRegistrationDocumentRef.trim() ||
      !form.insuranceDocumentRef.trim() ||
      !form.roadTaxDocumentRef.trim() ||
      !form.fitnessCertificateDocumentRef.trim()
    ) {
      Alert.alert("Validation", "Fill all required personal, document, and vehicle fields.");
      return;
    }

    if (
      form.verified &&
      (!form.hasDriversLicense ||
        !form.hasVehicleRegistrationDocument ||
        !form.insured ||
        !form.roadTaxCleared ||
        !form.fitnessTestPassed)
    ) {
      Alert.alert("Validation", "All compliance checks must be confirmed before verification.");
      return;
    }

    try {
      setSubmitting(true);
      await registerDriver({
        userId: parsedUserId,
        vehicleMake: form.vehicleMake.trim(),
        vehicleModel: form.vehicleModel.trim(),
        vehicleColor: form.vehicleColor.trim(),
        plateNumber: form.plateNumber.trim().toUpperCase(),
        personalInfo: {
          fullName: form.fullName.trim(),
          phoneNumber: form.phoneNumber.trim(),
          nrcNumber: form.nrcNumber.trim(),
          homeAddress: form.homeAddress.trim(),
          emergencyContactName: form.emergencyContactName.trim() || undefined,
          emergencyContactPhone: form.emergencyContactPhone.trim() || undefined,
        },
        compliance: {
          driversLicenseNumber: form.driversLicenseNumber.trim(),
          vehicleRegistrationNumber: form.vehicleRegistrationNumber.trim(),
          hasDriversLicense: form.hasDriversLicense,
          hasVehicleRegistrationDocument: form.hasVehicleRegistrationDocument,
          insured: form.insured,
          roadTaxCleared: form.roadTaxCleared,
          fitnessTestPassed: form.fitnessTestPassed,
        },
        commercial: {
          ridesPurchased,
          notes: form.adminNotes.trim() || undefined,
        },
        documents: {
          driversLicenseDocumentRef: form.driversLicenseDocumentRef.trim(),
          vehicleRegistrationDocumentRef: form.vehicleRegistrationDocumentRef.trim(),
          insuranceDocumentRef: form.insuranceDocumentRef.trim(),
          roadTaxDocumentRef: form.roadTaxDocumentRef.trim(),
          fitnessCertificateDocumentRef: form.fitnessCertificateDocumentRef.trim(),
        },
        account: {
          openId: form.loginOpenId.trim() || undefined,
          password: form.loginPassword.trim() || undefined,
          isActive: form.loginActive,
        },
        verified: form.verified,
      });
      setForm(DEFAULT_DRIVER_FORM);
      Alert.alert("Driver registered", "Driver profile and compliance record saved.");
    } catch (error) {
      Alert.alert("Register failed", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  };

  if (!ready) {
    return null;
  }

  return (
    <AdminShell
      title="Register Driver"
      subtitle="Capture personal, compliance, and commercial details."
      activeTab="register"
      onLogout={() => {
        void logout();
      }}
      statusLabel="Admin"
    >
      <AppCard>
        <Text style={{ fontSize: 18, fontWeight: "800" }}>Driver Registration Form</Text>
        <Text style={{ marginTop: 4, fontSize: 13, color: "#64748B" }}>
          Required: personal information, documents, compliance checks, and rides purchased.
        </Text>
        <View style={{ marginTop: 12, gap: 10 }}>
          <AppInput
            label="Driver user ID"
            placeholder="e.g. 2001005"
            keyboardType="number-pad"
            value={form.userId}
            onChangeText={(value) => setForm((prev) => ({ ...prev, userId: value }))}
          />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <AppInput
                label="Full name"
                placeholder="Driver full legal name"
                value={form.fullName}
                onChangeText={(value) => setForm((prev) => ({ ...prev, fullName: value }))}
              />
            </View>
            <View style={{ flex: 1 }}>
              <AppInput
                label="Phone number"
                placeholder="+26097xxxxxxx"
                value={form.phoneNumber}
                onChangeText={(value) => setForm((prev) => ({ ...prev, phoneNumber: value }))}
              />
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <AppInput
                label="NRC number"
                placeholder="123456/78/9"
                value={form.nrcNumber}
                onChangeText={(value) => setForm((prev) => ({ ...prev, nrcNumber: value }))}
              />
            </View>
            <View style={{ flex: 1 }}>
              <AppInput
                label="Home address"
                placeholder="Driver home address"
                value={form.homeAddress}
                onChangeText={(value) => setForm((prev) => ({ ...prev, homeAddress: value }))}
              />
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <AppInput
                label="Emergency contact name (optional)"
                placeholder="Emergency contact name"
                value={form.emergencyContactName}
                onChangeText={(value) => setForm((prev) => ({ ...prev, emergencyContactName: value }))}
              />
            </View>
            <View style={{ flex: 1 }}>
              <AppInput
                label="Emergency contact phone (optional)"
                placeholder="+26097xxxxxxx"
                value={form.emergencyContactPhone}
                onChangeText={(value) => setForm((prev) => ({ ...prev, emergencyContactPhone: value }))}
              />
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <AppInput
                label="Vehicle make"
                placeholder="Toyota"
                value={form.vehicleMake}
                onChangeText={(value) => setForm((prev) => ({ ...prev, vehicleMake: value }))}
              />
            </View>
            <View style={{ flex: 1 }}>
              <AppInput
                label="Vehicle model"
                placeholder="Prius"
                value={form.vehicleModel}
                onChangeText={(value) => setForm((prev) => ({ ...prev, vehicleModel: value }))}
              />
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <AppInput
                label="Vehicle color"
                placeholder="Silver"
                value={form.vehicleColor}
                onChangeText={(value) => setForm((prev) => ({ ...prev, vehicleColor: value }))}
              />
            </View>
            <View style={{ flex: 1 }}>
              <AppInput
                label="Plate number"
                placeholder="KAA111A"
                value={form.plateNumber}
                onChangeText={(value) => setForm((prev) => ({ ...prev, plateNumber: value.toUpperCase() }))}
              />
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <AppInput
                label="Driver license number"
                placeholder="DL-12345"
                value={form.driversLicenseNumber}
                onChangeText={(value) => setForm((prev) => ({ ...prev, driversLicenseNumber: value }))}
              />
            </View>
            <View style={{ flex: 1 }}>
              <AppInput
                label="Vehicle registration number"
                placeholder="VR-12345"
                value={form.vehicleRegistrationNumber}
                onChangeText={(value) => setForm((prev) => ({ ...prev, vehicleRegistrationNumber: value }))}
              />
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <AppInput
                label="Driver license document ref"
                placeholder="dl_driver_2001.pdf"
                value={form.driversLicenseDocumentRef}
                onChangeText={(value) => setForm((prev) => ({ ...prev, driversLicenseDocumentRef: value }))}
              />
            </View>
            <View style={{ flex: 1 }}>
              <AppInput
                label="Vehicle registration doc ref"
                placeholder="reg_driver_2001.pdf"
                value={form.vehicleRegistrationDocumentRef}
                onChangeText={(value) => setForm((prev) => ({ ...prev, vehicleRegistrationDocumentRef: value }))}
              />
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <AppInput
                label="Insurance document ref"
                placeholder="insurance_driver_2001.pdf"
                value={form.insuranceDocumentRef}
                onChangeText={(value) => setForm((prev) => ({ ...prev, insuranceDocumentRef: value }))}
              />
            </View>
            <View style={{ flex: 1 }}>
              <AppInput
                label="Road tax document ref"
                placeholder="road_tax_driver_2001.pdf"
                value={form.roadTaxDocumentRef}
                onChangeText={(value) => setForm((prev) => ({ ...prev, roadTaxDocumentRef: value }))}
              />
            </View>
          </View>

          <AppInput
            label="Fitness certificate ref"
            placeholder="fitness_driver_2001.pdf"
            value={form.fitnessCertificateDocumentRef}
            onChangeText={(value) => setForm((prev) => ({ ...prev, fitnessCertificateDocumentRef: value }))}
          />

          <ComplianceToggle
            label="Driver license document checked"
            value={form.hasDriversLicense}
            onPress={() => setForm((prev) => ({ ...prev, hasDriversLicense: !prev.hasDriversLicense }))}
          />
          <ComplianceToggle
            label="Vehicle registration document checked"
            value={form.hasVehicleRegistrationDocument}
            onPress={() =>
              setForm((prev) => ({
                ...prev,
                hasVehicleRegistrationDocument: !prev.hasVehicleRegistrationDocument,
              }))
            }
          />
          <ComplianceToggle
            label="Vehicle insured"
            value={form.insured}
            onPress={() => setForm((prev) => ({ ...prev, insured: !prev.insured }))}
          />
          <ComplianceToggle
            label="Road tax cleared (RATSA)"
            value={form.roadTaxCleared}
            onPress={() => setForm((prev) => ({ ...prev, roadTaxCleared: !prev.roadTaxCleared }))}
          />
          <ComplianceToggle
            label="Fitness test passed"
            value={form.fitnessTestPassed}
            onPress={() => setForm((prev) => ({ ...prev, fitnessTestPassed: !prev.fitnessTestPassed }))}
          />

          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <AppInput
                label="Rides purchased from company"
                placeholder="50"
                keyboardType="number-pad"
                value={form.ridesPurchased}
                onChangeText={(value) => setForm((prev) => ({ ...prev, ridesPurchased: value }))}
              />
            </View>
            <View style={{ flex: 1 }}>
              <AppInput
                label="Admin notes (optional)"
                placeholder="Contract/package notes"
                value={form.adminNotes}
                onChangeText={(value) => setForm((prev) => ({ ...prev, adminNotes: value }))}
              />
            </View>
          </View>

          <Text style={{ marginTop: 4, fontSize: 14, fontWeight: "800", color: "#0F172A" }}>
            Driver Login Credentials
          </Text>
          <Text style={{ marginTop: -2, fontSize: 12, color: "#64748B" }}>
            Managed by admin. Open ID and password are used by the driver account.
          </Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <AppInput
                label="Login Open ID (optional)"
                placeholder="Defaults to phone number or user ID"
                value={form.loginOpenId}
                onChangeText={(value) => setForm((prev) => ({ ...prev, loginOpenId: value }))}
              />
            </View>
            <View style={{ flex: 1 }}>
              <AppInput
                label="Temporary password"
                placeholder="At least 6 characters"
                value={form.loginPassword}
                secureTextEntry
                onChangeText={(value) => setForm((prev) => ({ ...prev, loginPassword: value }))}
              />
            </View>
          </View>
          <ComplianceToggle
            label="Driver account active"
            value={form.loginActive}
            onPress={() => setForm((prev) => ({ ...prev, loginActive: !prev.loginActive }))}
          />

          <ComplianceToggle
            label="Mark verified at creation"
            value={form.verified}
            onPress={() => setForm((prev) => ({ ...prev, verified: !prev.verified }))}
          />

          <AppButton
            label={submitting ? "Registering..." : "Register Driver"}
            loading={submitting}
            onPress={() => {
              void submitDriver();
            }}
            leftIcon={<Ionicons name="person-add" size={16} color="#FFFFFF" />}
          />
        </View>
      </AppCard>
    </AdminShell>
  );
}
