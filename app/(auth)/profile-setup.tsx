import { Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "@/components/screen-container";
import { AppButton } from "@/components/ui/app-button";
import { AppCard } from "@/components/ui/app-card";
import { AppInput } from "@/components/ui/app-input";
import { IS_DRIVER_APP } from "@/constants/app-variant";
import { radii } from "@/constants/design-system";
import { useBrandTheme } from "@/hooks/use-brand-theme";
import { useAppStore } from "@/lib/store";
import { createUser } from "@/lib/db-service";

export default function ProfileSetupScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const brand = useBrandTheme();
  const { setCurrentUser, setIsAuthenticated, persist } = useAppStore();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const phone = (params.phone as string) || "";
  const role: "rider" = "rider";

  function buildFallbackUser() {
    const now = new Date();
    return {
      id: Date.now(),
      openId: phone,
      name: name.trim(),
      email: email || null,
      loginMethod: "phone",
      role,
      createdAt: now,
      updatedAt: now,
      lastSignedIn: now,
    };
  }

  const handleContinue = async () => {
    if (IS_DRIVER_APP) {
      Alert.alert(
        "Driver Registration Restricted",
        "Drivers are registered by the company owner/admin. Please sign in with your pre-registered account.",
      );
      router.replace("/phone-entry");
      return;
    }

    if (!name.trim()) {
      Alert.alert("Validation", "Please enter your full name.");
      return;
    }

    setIsLoading(true);
    try {
      let user: any;
      try {
        user = await createUser(phone, name, email || undefined, "phone", role);
      } catch (dbError) {
        console.warn("[auth] Falling back to in-memory profile creation.", dbError);
        user = buildFallbackUser();
      }

      setCurrentUser(user);
      setIsAuthenticated(true);
      await persist();
      router.replace("/(tabs)");
    } catch (error) {
      console.error("Error creating profile:", error);
      Alert.alert("Error", "Failed to create profile");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScreenContainer className="bg-background" containerClassName="bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: 24, gap: 18 }}>
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

          <View>
            <Text style={{ fontSize: 30, fontWeight: "800", color: brand.text }}>Create Profile</Text>
            <Text style={{ marginTop: 6, fontSize: 14, color: brand.textMuted }}>
              Complete setup to start booking rides.
            </Text>
          </View>

          <AppCard>
            <AppInput
              label="Full Name"
              placeholder="John Doe"
              value={name}
              onChangeText={setName}
              editable={!isLoading}
            />
            <View style={{ marginTop: 14 }}>
              <AppInput
                label="Email (Optional)"
                placeholder="john@example.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                editable={!isLoading}
                autoCapitalize="none"
              />
            </View>

            <View style={{ marginTop: 18 }}>
              <AppButton
                label={isLoading ? "Creating Profile..." : "Complete Setup"}
                loading={isLoading}
                onPress={handleContinue}
              />
            </View>
          </AppCard>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
