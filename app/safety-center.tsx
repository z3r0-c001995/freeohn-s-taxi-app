import { Alert, Linking, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { apiCall } from "@/lib/_core/api";

export default function SafetyCenterScreen() {
  const router = useRouter();
  const colors = useColors();

  const handleContactSupport = async () => {
    try {
      const result = await apiCall<{ support: { phone: string; email: string; emergencyPhone: string } }>(
        "/api/support/contact",
        {
          method: "POST",
          body: JSON.stringify({ message: "Need support assistance from Safety Center" }),
        },
      );
      Alert.alert(
        "Support channels",
        `Phone: ${result.support.phone}\nEmail: ${result.support.email}\nEmergency: ${result.support.emergencyPhone}`,
      );
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Unable to reach support");
    }
  };

  return (
    <ScreenContainer className="bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <View className="gap-5 pb-8">
          <View className="flex-row items-center justify-between">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-10 h-10 rounded-full items-center justify-center"
              style={{ backgroundColor: colors.surface }}
            >
              <Ionicons name="arrow-back" size={22} color={colors.foreground} />
            </TouchableOpacity>
            <Text className="text-lg font-bold text-foreground">Safety Center</Text>
            <View className="w-10" />
          </View>

          <View className="rounded-xl p-4 gap-3" style={{ backgroundColor: colors.surface }}>
            <Text className="text-base font-semibold text-foreground">Emergency SOS</Text>
            <Text className="text-sm text-muted">
              Use SOS from active trip screen to notify support and trigger emergency flow.
            </Text>
          </View>

          <View className="rounded-xl p-4 gap-3" style={{ backgroundColor: colors.surface }}>
            <Text className="text-base font-semibold text-foreground">Trusted Contact Sharing</Text>
            <Text className="text-sm text-muted">
              Generate a route share link from active trip so your contacts can follow live status.
            </Text>
          </View>

          <View className="rounded-xl p-4 gap-3" style={{ backgroundColor: colors.surface }}>
            <Text className="text-base font-semibold text-foreground">24/7 Support</Text>
            <TouchableOpacity
              onPress={handleContactSupport}
              className="py-3 rounded-lg items-center justify-center"
              style={{ backgroundColor: colors.primary }}
            >
              <Text className="text-white font-semibold">Contact Support</Text>
            </TouchableOpacity>
          </View>

          <View className="rounded-xl p-4 gap-3" style={{ backgroundColor: colors.surface }}>
            <Text className="text-base font-semibold text-foreground">Emergency Call</Text>
            <TouchableOpacity
              onPress={() => {
                void Linking.openURL("tel:+911");
              }}
              className="py-3 rounded-lg items-center justify-center"
              style={{ backgroundColor: colors.error }}
            >
              <Text className="text-white font-semibold">Call Emergency</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

