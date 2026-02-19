import { Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "@/components/screen-container";
import { AppBadge } from "@/components/ui/app-badge";
import { AppButton } from "@/components/ui/app-button";
import { AppCard } from "@/components/ui/app-card";
import { AppInput } from "@/components/ui/app-input";
import { radii, shadows } from "@/constants/design-system";
import { IS_DRIVER_APP } from "@/constants/app-variant";
import { useBrandTheme } from "@/hooks/use-brand-theme";
import { useAppStore } from "@/lib/store";
import { getDriverProfile, getUserByOpenId } from "@/lib/db-service";

const DEMO_REGISTERED_DRIVERS: Record<
  string,
  {
    user: {
      id: number;
      openId: string;
      name: string;
      email: string;
      role: "driver";
    };
    profile: {
      id: number;
      vehicleMake: string;
      vehicleModel: string;
      plateNumber: string;
      licenseNumber: string;
      currentLat: string;
      currentLng: string;
    };
  }
> = {
  "5551234567": {
    user: {
      id: 2001001,
      openId: "5551234567",
      name: "Demo Driver",
      email: "driver.demo@freeohn.app",
      role: "driver",
    },
    profile: {
      id: 3001001,
      vehicleMake: "Toyota",
      vehicleModel: "Prius",
      plateNumber: "KAA111A",
      licenseNumber: "DRV-1001",
      currentLat: "-1.286389",
      currentLng: "36.817223",
    },
  },
};

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

function getFallbackDriverSession(phone: string) {
  const record = DEMO_REGISTERED_DRIVERS[normalizePhone(phone)];
  if (!record) return null;

  const now = new Date();
  return {
    user: {
      id: record.user.id,
      openId: record.user.openId,
      name: record.user.name,
      email: record.user.email,
      loginMethod: "phone",
      role: "driver" as const,
      createdAt: now,
      updatedAt: now,
      lastSignedIn: now,
    },
    profile: {
      id: record.profile.id,
      userId: record.user.id,
      vehicleMake: record.profile.vehicleMake,
      vehicleModel: record.profile.vehicleModel,
      plateNumber: record.profile.plateNumber,
      licenseNumber: record.profile.licenseNumber,
      isOnline: false,
      currentLat: record.profile.currentLat,
      currentLng: record.profile.currentLng,
      totalEarnings: 0,
      totalTrips: 156,
      createdAt: now,
      updatedAt: now,
    },
  };
}

function formatTimer(totalSeconds: number) {
  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (safeSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export default function OTPVerificationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const brand = useBrandTheme();
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(110);
  const { setCurrentUser, setDriverProfile, setIsAuthenticated, persist } = useAppStore();

  const phone = (params.phone as string) || "";
  const role = IS_DRIVER_APP ? "driver" : "rider";
  const maskedPhone = useMemo(() => {
    const digits = normalizePhone(phone);
    if (digits.length < 4) return phone;
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`.trim();
  }, [phone]);

  useEffect(() => {
    if (IS_DRIVER_APP) return;
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleVerify = async () => {
    if (!otp.trim() || otp.length !== 6) {
      Alert.alert("Validation", "Please enter a valid 6-digit code.");
      return;
    }

    setIsLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 650));

      if (IS_DRIVER_APP) {
        const normalizedPhone = normalizePhone(phone);
        let user: any = null;
        let profile: any = null;

        try {
          user =
            (await getUserByOpenId(normalizedPhone)) ||
            (normalizedPhone !== phone ? await getUserByOpenId(phone) : null);
          if (user?.id) {
            profile = await getDriverProfile(user.id.toString());
          }
        } catch (dbError) {
          console.warn("[auth] Driver lookup via SQLite failed, trying fallback session.", dbError);
        }

        if ((!user || user.role !== "driver" || !profile) && normalizedPhone) {
          const fallback = getFallbackDriverSession(normalizedPhone);
          if (fallback) {
            user = fallback.user;
            profile = fallback.profile;
          }
        }

        if (!user || user.role !== "driver") {
          Alert.alert(
            "Driver Not Registered",
            "This account is not registered for driver access. Contact company owner/admin.",
          );
          return;
        }

        if (!profile) {
          Alert.alert("Driver Profile Missing", "Driver profile setup is incomplete. Contact operations.");
          return;
        }

        setCurrentUser(user as any);
        setDriverProfile(profile as any);
        setIsAuthenticated(true);
        await persist();
        router.replace("/(tabs)");
        return;
      }

      router.push({ pathname: "/profile-setup", params: { phone, role, otp } });
    } catch (error) {
      console.warn("[auth] OTP verification failed:", error);
      Alert.alert("Error", "Failed to verify OTP");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = () => {
    setSecondsRemaining(110);
    Alert.alert("Code sent", `Verification code sent to ${phone}`);
  };

  const handleOtpChange = (value: string) => {
    setOtp(value.replace(/[^0-9]/g, "").slice(0, 6));
  };

  if (IS_DRIVER_APP) {
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
                borderWidth: 1,
                borderColor: brand.border,
                backgroundColor: brand.surface,
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
              <Text style={{ fontSize: 26, fontWeight: "800", color: "#FFFFFF" }}>Verify Driver Login</Text>
              <Text style={{ marginTop: 8, color: "#CBD5E1", fontSize: 14 }}>
                Enter the OTP sent to {maskedPhone || phone}
              </Text>
            </View>

            <AppCard>
              <AppInput
                label="Verification Code"
                value={otp}
                onChangeText={handleOtpChange}
                keyboardType="number-pad"
                maxLength={6}
                placeholder="123456"
                autoFocus
              />
              <View style={{ marginTop: 16 }}>
                <AppButton
                  label={isLoading ? "Verifying..." : "Verify & Continue"}
                  variant="secondary"
                  loading={isLoading}
                  disabled={otp.length !== 6}
                  onPress={handleVerify}
                />
              </View>
              <View style={{ marginTop: 10, flexDirection: "row", justifyContent: "center", gap: 6 }}>
                <Text style={{ fontSize: 13, color: brand.textMuted }}>Need a new code?</Text>
                <TouchableOpacity onPress={handleResend}>
                  <Text style={{ fontSize: 13, color: brand.accent, fontWeight: "700" }}>Resend</Text>
                </TouchableOpacity>
              </View>
            </AppCard>
          </View>
        </ScrollView>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="bg-background" containerClassName="bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 18, paddingBottom: 30 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              width: 40,
              height: 40,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: radii.pill,
              borderWidth: 1,
              borderColor: brand.border,
              backgroundColor: brand.surface,
            }}
          >
            <Ionicons name="arrow-back" size={20} color={brand.text} />
          </TouchableOpacity>

          <View style={{ alignItems: "center", marginTop: 26 }}>
            <View
              style={{
                width: 106,
                height: 106,
                borderRadius: 999,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#0A1E49",
                ...shadows.md,
              }}
            >
              <Ionicons name="mail-outline" size={48} color={brand.primary} />
            </View>
            <Text style={{ marginTop: 18, fontSize: 32, fontWeight: "800", color: brand.text }}>
              Verification Code
            </Text>
            <Text style={{ marginTop: 8, fontSize: 14, color: brand.textMuted, textAlign: "center" }}>
              Please enter the code sent to {maskedPhone || phone}
            </Text>
            <View style={{ marginTop: 10 }}>
              <AppBadge label={formatTimer(secondsRemaining)} tone="primary" />
            </View>
          </View>

          <AppCard style={{ marginTop: 22 }}>
            <AppInput
              label="6-digit code"
              value={otp}
              onChangeText={handleOtpChange}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="123456"
              autoFocus
            />

            <View style={{ flexDirection: "row", justifyContent: "center", gap: 10, marginTop: 14 }}>
              {Array.from({ length: 6 }).map((_, index) => {
                const hasValue = Boolean(otp[index]);
                return (
                  <View
                    key={`otp-circle-${index}`}
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 999,
                      backgroundColor: hasValue ? brand.primary : "#E2E8F0",
                    }}
                  />
                );
              })}
            </View>

            <View style={{ marginTop: 18 }}>
              <AppButton
                label={isLoading ? "Verifying..." : "Verify Code"}
                loading={isLoading}
                disabled={otp.length !== 6}
                onPress={handleVerify}
              />
            </View>

            <View style={{ marginTop: 10, flexDirection: "row", justifyContent: "center", gap: 6 }}>
              <Text style={{ fontSize: 13, color: brand.textMuted }}>Didn&apos;t receive code?</Text>
              <TouchableOpacity onPress={handleResend}>
                <Text style={{ fontSize: 13, color: brand.accent, fontWeight: "700" }}>Resend</Text>
              </TouchableOpacity>
            </View>
          </AppCard>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
