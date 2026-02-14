import { Text, View, TextInput, TouchableOpacity, ScrollView, Alert } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { Ionicons } from "@expo/vector-icons";
import { IS_DRIVER_APP } from "@/constants/app-variant";
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

export default function OTPVerificationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const colors = useColors();
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { setCurrentUser, setDriverProfile, setIsAuthenticated, persist } = useAppStore();

  const phone = (params.phone as string) || "";
  const role = IS_DRIVER_APP ? "driver" : "rider";

  const handleVerify = async () => {
    if (!otp.trim() || otp.length !== 6) {
      Alert.alert("Error", "Please enter a valid 6-digit code");
      return;
    }

    setIsLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));

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
            "This driver account is not registered yet. Ask the company owner/admin to register your driver profile first.",
          );
          return;
        }

        if (!profile) {
          Alert.alert(
            "Driver Profile Missing",
            "Driver profile is missing. Ask the company owner/admin to complete your registration.",
          );
          return;
        }

        setCurrentUser(user as any);
        setDriverProfile(profile as any);
        setIsAuthenticated(true);
        await persist();
        router.replace("/(tabs)");
        return;
      }

      router.push({
        pathname: "/profile-setup",
        params: { phone, role, otp },
      });
    } catch (error) {
      console.warn("[auth] OTP verification failed:", error);
      Alert.alert("Error", "Failed to verify OTP");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    Alert.alert("Success", "Verification code sent to " + phone);
  };

  return (
    <ScreenContainer className="bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <View className="flex-1 justify-center px-6 gap-6">
          {/* Back Button */}
          <TouchableOpacity onPress={() => router.back()} className="mb-4">
            <Ionicons name="arrow-back" size={24} color={colors.foreground} />
          </TouchableOpacity>

          {/* Header */}
          <View className="gap-2">
            <Text className="text-3xl font-bold text-foreground">Verify Your Phone</Text>
            <Text className="text-base text-muted">
              {"We've sent a code to "}{phone}
            </Text>
          </View>

          {/* OTP Input */}
          <View className="gap-2">
            <Text className="text-sm font-semibold text-foreground">Verification Code</Text>
            <TextInput
              placeholder="000000"
              placeholderTextColor={colors.muted}
              value={otp}
              onChangeText={(text) => setOtp(text.replace(/[^0-9]/g, "").slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
              editable={!isLoading}
              className="border border-border rounded-lg px-4 py-3 text-center text-2xl font-bold text-foreground tracking-widest"
              style={{ borderColor: colors.border }}
            />
          </View>

          {/* Verify Button */}
          <TouchableOpacity
            onPress={handleVerify}
            disabled={isLoading || otp.length !== 6}
            className="bg-primary rounded-lg py-4 items-center"
            style={{
              opacity: isLoading || otp.length !== 6 ? 0.6 : 1,
            }}
          >
            <Text className="text-white font-semibold text-base">
              {isLoading ? "Verifying..." : "Verify"}
            </Text>
          </TouchableOpacity>

          {/* Resend Code */}
          <View className="flex-row justify-center gap-1">
            <Text className="text-sm text-muted">{"Didn't receive code?"}</Text>
            <TouchableOpacity onPress={handleResend} disabled={isLoading}>
              <Text className="text-sm font-semibold" style={{ color: colors.primary }}>
                Resend
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
