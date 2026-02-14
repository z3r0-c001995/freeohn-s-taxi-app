import { Text, View, TextInput, TouchableOpacity, ScrollView, Alert } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useAppStore } from "@/lib/store";
import { createUser } from "@/lib/db-service";
import { Ionicons } from "@expo/vector-icons";
import { IS_DRIVER_APP } from "@/constants/app-variant";

export default function ProfileSetupScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const colors = useColors();
  const { setCurrentUser, setIsAuthenticated, persist } = useAppStore();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const phone = (params.phone as string) || "";
  const role: "rider" = "rider";

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
      Alert.alert("Error", "Please enter your name");
      return;
    }

    setIsLoading(true);
    try {
      // Create user in database
      const user = await createUser(phone, name, email || undefined, "phone", role);

      // Update store
      setCurrentUser(user);
      setIsAuthenticated(true);
      await persist();

      // Navigate to home
      router.replace("/(tabs)");
    } catch (error) {
      console.error("Error creating profile:", error);
      Alert.alert("Error", "Failed to create profile");
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
            <Text className="text-3xl font-bold text-foreground">Create Your Profile</Text>
            <Text className="text-base text-muted">Complete your information</Text>
          </View>

          {/* Name Input */}
          <View className="gap-2">
            <Text className="text-sm font-semibold text-foreground">Full Name</Text>
            <TextInput
              placeholder="John Doe"
              placeholderTextColor={colors.muted}
              value={name}
              onChangeText={setName}
              editable={!isLoading}
              className="border border-border rounded-lg px-4 py-3 text-base text-foreground"
              style={{ borderColor: colors.border }}
            />
          </View>

          {/* Email Input */}
          <View className="gap-2">
            <Text className="text-sm font-semibold text-foreground">Email (Optional)</Text>
            <TextInput
              placeholder="john@example.com"
              placeholderTextColor={colors.muted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              editable={!isLoading}
              className="border border-border rounded-lg px-4 py-3 text-base text-foreground"
              style={{ borderColor: colors.border }}
            />
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
              {isLoading ? "Creating Profile..." : "Complete Setup"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
