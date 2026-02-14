import { Text, View, TextInput, TouchableOpacity, ScrollView, Alert } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { validatePhoneNumber } from "@/lib/ride-utils";
import { Ionicons } from "@expo/vector-icons";
import { IS_DRIVER_APP } from "@/constants/app-variant";

export default function PhoneEntryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const colors = useColors();
  const [phone, setPhone] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const role = IS_DRIVER_APP ? "driver" : "rider";

  const handleContinue = async () => {
    if (!phone.trim()) {
      Alert.alert("Error", "Please enter your phone number");
      return;
    }

    if (!validatePhoneNumber(phone)) {
      Alert.alert("Error", "Please enter a valid phone number");
      return;
    }

    setIsLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      router.push({
        pathname: "/otp-verification",
        params: { phone, role },
      });
    } catch (error) {
      Alert.alert("Error", "Failed to process phone number");
    } finally {
      setIsLoading(false);
    }
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
            <Text className="text-3xl font-bold text-foreground">Enter Your Phone</Text>
            <Text className="text-base text-muted">We'll send you a verification code</Text>
          </View>

          {/* Phone Input */}
          <View className="gap-2">
            <Text className="text-sm font-semibold text-foreground">Phone Number</Text>
            <View
              className="flex-row items-center border border-border rounded-lg px-4 py-3 gap-2"
              style={{ borderColor: colors.border }}
            >
              <Text className="text-lg text-foreground">+</Text>
              <TextInput
                placeholder="1 (555) 123-4567"
                placeholderTextColor={colors.muted}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                editable={!isLoading}
                className="flex-1 text-base text-foreground"
              />
            </View>
            <Text className="text-xs text-muted">Standard rates may apply</Text>
          </View>

          {/* Role Info */}
          <View
            className="rounded-lg p-4 gap-2"
            style={{ backgroundColor: colors.surface }}
          >
            <View className="flex-row items-center gap-2">
              <Ionicons name={IS_DRIVER_APP ? "speedometer" : "car"} size={16} color={colors.primary} />
              <Text className="text-sm text-foreground font-semibold">
                {IS_DRIVER_APP ? "Driver sign in (company-registered)" : "Service seeker registration"}
              </Text>
            </View>
          </View>

          {/* Continue Button */}
          <TouchableOpacity
            onPress={handleContinue}
            disabled={isLoading}
            className="bg-primary rounded-lg py-4 items-center"
            style={{
              opacity: isLoading ? 0.6 : 1,
            }}
          >
            <Text className="text-white font-semibold text-base">
              {isLoading ? "Sending..." : "Continue"}
            </Text>
          </TouchableOpacity>

          {/* Terms */}
          <Text className="text-xs text-muted text-center">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
