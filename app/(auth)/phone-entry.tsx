import { Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "@/components/screen-container";
import { AppButton } from "@/components/ui/app-button";
import { AppCard } from "@/components/ui/app-card";
import { AppInput } from "@/components/ui/app-input";
import { radii, shadows } from "@/constants/design-system";
import { IS_DRIVER_APP } from "@/constants/app-variant";
import { useBrandTheme } from "@/hooks/use-brand-theme";
import { validatePhoneNumber } from "@/lib/ride-utils";

function DriverPhoneEntry() {
  const router = useRouter();
  const brand = useBrandTheme();
  const [phone, setPhone] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleContinue = async () => {
    if (!phone.trim()) {
      Alert.alert("Validation", "Please enter your phone number.");
      return;
    }

    if (!validatePhoneNumber(phone)) {
      Alert.alert("Validation", "Please enter a valid phone number.");
      return;
    }

    setIsLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      router.push({ pathname: "/otp-verification", params: { phone, role: "driver" } });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScreenContainer className="bg-background" containerClassName="bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: 24, gap: 16 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              width: 40,
              height: 40,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: radii.pill,
              backgroundColor: brand.surface,
              borderColor: brand.border,
              borderWidth: 1,
            }}
          >
            <Ionicons name="arrow-back" size={20} color={brand.text} />
          </TouchableOpacity>

          <View
            style={{
              borderRadius: radii.xl,
              padding: 20,
              backgroundColor: "#0F1E4A",
              borderWidth: 1,
              borderColor: "#1D4ED8",
              ...shadows.md,
            }}
          >
            <Text style={{ fontSize: 26, fontWeight: "800", color: "#FFFFFF" }}>Driver Login</Text>
            <Text style={{ marginTop: 8, color: "#CBD5E1", fontSize: 14 }}>
              Enter your company-approved number to access dispatch.
            </Text>
          </View>

          <AppCard>
            <AppInput
              label="Phone Number"
              placeholder="+260 97 123 4567"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              editable={!isLoading}
              autoFocus
            />
            <View style={{ marginTop: 16 }}>
              <AppButton label="Send Verification Code" variant="secondary" loading={isLoading} onPress={handleContinue} />
            </View>
            <Text style={{ marginTop: 10, fontSize: 12, color: brand.textMuted }}>
              Drivers are registered by company owner/admin. Self signup is disabled.
            </Text>
          </AppCard>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

function SeekerPhoneEntry() {
  const router = useRouter();
  const brand = useBrandTheme();
  const [phone, setPhone] = useState("");
  const [countryCode, setCountryCode] = useState("+260");
  const [isLoading, setIsLoading] = useState(false);

  const handleContinue = async () => {
    const fullPhone = `${countryCode}${phone}`.replace(/\s+/g, "");
    if (!phone.trim()) {
      Alert.alert("Validation", "Please enter your phone number.");
      return;
    }

    if (!validatePhoneNumber(fullPhone)) {
      Alert.alert("Validation", "Please enter a valid phone number.");
      return;
    }

    setIsLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      router.push({ pathname: "/otp-verification", params: { phone: fullPhone, role: "rider" } });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScreenContainer className="bg-background" containerClassName="bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <View style={{ flex: 1, justifyContent: "space-between", paddingBottom: 24 }}>
          <View
            style={{
              minHeight: 280,
              backgroundColor: "#0A1E49",
              borderBottomLeftRadius: 104,
              borderBottomRightRadius: 104,
              paddingHorizontal: 24,
              paddingTop: 26,
              paddingBottom: 20,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                position: "absolute",
                width: 240,
                height: 240,
                borderRadius: 999,
                backgroundColor: "rgba(249,115,22,0.32)",
                top: -120,
                right: -40,
              }}
            />
            <TouchableOpacity
              onPress={() => router.back()}
              style={{
                width: 40,
                height: 40,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: radii.pill,
                backgroundColor: "rgba(255,255,255,0.14)",
              }}
            >
              <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
            </TouchableOpacity>

            <Text style={{ marginTop: 26, fontSize: 30, fontWeight: "800", color: "#FFFFFF" }}>
              Sign In
            </Text>
            <Text style={{ marginTop: 8, fontSize: 14, color: "#CBD5E1" }}>
              Register or login to book a ride in minutes.
            </Text>
          </View>

          <View style={{ paddingHorizontal: 24, marginTop: -12 }}>
            <AppCard>
              <Text style={{ fontSize: 16, color: brand.textMuted }}>Phone Number</Text>
              <View
                style={{
                  marginTop: 12,
                  borderRadius: radii.md,
                  borderWidth: 1,
                  borderColor: brand.border,
                  backgroundColor: brand.surface,
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 12,
                }}
              >
                <TouchableOpacity
                  onPress={() => setCountryCode((prev) => (prev === "+260" ? "+994" : "+260"))}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 5,
                    paddingVertical: 14,
                    paddingRight: 10,
                  }}
                >
                  <Text style={{ color: brand.text, fontSize: 15, fontWeight: "600" }}>{countryCode}</Text>
                  <Ionicons name="chevron-down" size={14} color={brand.textMuted} />
                </TouchableOpacity>
                <View style={{ width: 1, height: 20, backgroundColor: brand.border }} />
                <View style={{ flex: 1 }}>
                  <AppInput
                    placeholder="97 123 4567"
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                    editable={!isLoading}
                    style={{ borderWidth: 0, paddingVertical: 14, paddingHorizontal: 10 }}
                  />
                </View>
              </View>

              <View style={{ marginTop: 18 }}>
                <AppButton label="Continue" loading={isLoading} onPress={handleContinue} />
              </View>

              <Text style={{ marginTop: 10, fontSize: 12, color: brand.textMuted, textAlign: "center" }}>
                By continuing you agree to Freeohn&apos;s Ride App Terms.
              </Text>
            </AppCard>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

export default function PhoneEntryScreen() {
  if (IS_DRIVER_APP) {
    return <DriverPhoneEntry />;
  }

  return <SeekerPhoneEntry />;
}
