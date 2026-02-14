import { Alert, Text, View, TouchableOpacity, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { Ionicons } from "@expo/vector-icons";
import { APP_LABEL, IS_DRIVER_APP } from "@/constants/app-variant";

export default function OnboardingScreen() {
  const router = useRouter();
  const colors = useColors();

  const handlePrimaryPress = () => {
    router.push({
      pathname: "/phone-entry",
      params: { role: IS_DRIVER_APP ? "driver" : "rider" },
    });
  };

  const handleDriverInfo = () =>
    Alert.alert("Driver onboarding", "Driver accounts are registered by company owner/admin.");

  return (
    <ScreenContainer className="bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <View className="flex-1 justify-center items-center px-6 gap-8">
          {/* Header */}
          <View className="items-center gap-2">
            <Text className="text-5xl font-bold text-foreground">Freeohn's</Text>
            <Text className="text-lg text-muted text-center">{APP_LABEL}</Text>
          </View>

          {/* Primary app flow */}
          <View className="w-full gap-4 mt-8">
            <TouchableOpacity
              onPress={handlePrimaryPress}
              activeOpacity={0.8}
              className="bg-surface border border-border rounded-2xl p-6 gap-4"
            >
              <View className="flex-row items-center gap-4">
                <View
                  className="w-16 h-16 rounded-full items-center justify-center"
                  style={{ backgroundColor: colors.primary }}
                >
                  <Ionicons name={IS_DRIVER_APP ? "speedometer" : "car"} size={32} color={colors.background} />
                </View>
                <View className="flex-1">
                  <Text className="text-xl font-bold text-foreground">
                    {IS_DRIVER_APP ? "Driver Portal" : "Service Seeker"}
                  </Text>
                  <Text className="text-sm text-muted">
                    {IS_DRIVER_APP ? "Manage incoming rides" : "Book rides easily"}
                  </Text>
                </View>
              </View>
              <Text className="text-sm text-muted leading-relaxed">
                {IS_DRIVER_APP
                  ? "Driver app for dispatch requests, trip controls, and live trip updates."
                  : "Request a ride, track your driver in real-time, and reach your destination safely."}
              </Text>
            </TouchableOpacity>

            {!IS_DRIVER_APP && (
              <TouchableOpacity
                onPress={handleDriverInfo}
                activeOpacity={0.8}
                className="bg-surface border border-border rounded-2xl p-6 gap-4"
              >
                <View className="flex-row items-center gap-4">
                  <View
                    className="w-16 h-16 rounded-full items-center justify-center"
                    style={{ backgroundColor: colors.success }}
                  >
                    <Ionicons name="person" size={32} color={colors.background} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-xl font-bold text-foreground">Driver Access</Text>
                    <Text className="text-sm text-muted">Owner-managed onboarding</Text>
                  </View>
                </View>
                <Text className="text-sm text-muted leading-relaxed">
                  Drivers are verified and registered by company owner/admin before they can go online.
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Features */}
          <View className="w-full gap-3 mt-8">
            <Text className="text-sm font-semibold text-foreground">Why Choose RideHaul?</Text>
            <View className="gap-2">
              <View className="flex-row items-center gap-3">
                <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                <Text className="text-sm text-foreground flex-1">100% Local & Offline</Text>
              </View>
              <View className="flex-row items-center gap-3">
                <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                <Text className="text-sm text-foreground flex-1">Real-Time Tracking</Text>
              </View>
              <View className="flex-row items-center gap-3">
                <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                <Text className="text-sm text-foreground flex-1">Instant Messaging</Text>
              </View>
              <View className="flex-row items-center gap-3">
                <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                <Text className="text-sm text-foreground flex-1">Fair Pricing</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
