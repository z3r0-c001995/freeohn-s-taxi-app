import { useState } from "react";
import { Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { APP_LABEL, IS_DRIVER_APP, IS_SEEKER_APP } from "@/constants/app-variant";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "@/components/screen-container";
import { AppBadge } from "@/components/ui/app-badge";
import { AppButton } from "@/components/ui/app-button";
import { AppCard } from "@/components/ui/app-card";
import { radii, shadows } from "@/constants/design-system";
import { useBrandTheme } from "@/hooks/use-brand-theme";
import { useAppStore } from "@/lib/store";

export default function PaymentScreen() {
  const router = useRouter();
  const brand = useBrandTheme();
  const { activeRide, rideHistory } = useAppStore();
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "mobile_money">("cash");

  const ride = activeRide ?? rideHistory[0] ?? null;
  const distanceKm = ride?.distanceMeters ? ride.distanceMeters / 1000 : 0;
  const durationMinutes = ride?.durationSeconds ? ride.durationSeconds / 60 : 0;

  const baseFare = ride ? Math.max(1.5, ride.fareAmount * 0.35) : 0;
  const distanceFare = ride ? Math.max(0, ride.fareAmount * 0.45) : 0;
  const timeFare = ride ? Math.max(0, ride.fareAmount * 0.2) : 0;

  return (
    <ScreenContainer className="bg-background" containerClassName="bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <View style={{ gap: 16, paddingBottom: 20 }}>
          <View
            style={{
              borderRadius: radii.xl,
              padding: 18,
              backgroundColor: "#0A1E49",
              ...shadows.md,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <TouchableOpacity
                onPress={() => router.back()}
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 999,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "rgba(255,255,255,0.14)",
                }}
              >
                <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
              </TouchableOpacity>
              <AppBadge label="Payment" tone="primary" />
            </View>
            <Text style={{ marginTop: 14, fontSize: 28, fontWeight: "800", color: "#FFFFFF" }}>Trip Payment</Text>
            <Text style={{ marginTop: 6, fontSize: 13, color: "#CBD5E1" }}>
              Review fare breakdown and confirm payment method.
            </Text>
          </View>

          <AppCard>
            <Text style={{ fontSize: 16, fontWeight: "800", color: brand.text }}>Fare Breakdown</Text>
            <View style={{ marginTop: 12, gap: 9 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: brand.textMuted, fontSize: 13 }}>Base fare</Text>
                <Text style={{ color: brand.text, fontWeight: "700" }}>ZMW {baseFare.toFixed(2)}</Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: brand.textMuted, fontSize: 13 }}>Distance ({distanceKm.toFixed(1)} km)</Text>
                <Text style={{ color: brand.text, fontWeight: "700" }}>ZMW {distanceFare.toFixed(2)}</Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: brand.textMuted, fontSize: 13 }}>Time ({durationMinutes.toFixed(0)} min)</Text>
                <Text style={{ color: brand.text, fontWeight: "700" }}>ZMW {timeFare.toFixed(2)}</Text>
              </View>
              <View style={{ marginTop: 3, height: 1, backgroundColor: brand.border }} />
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: brand.text, fontSize: 16, fontWeight: "800" }}>Total</Text>
                <Text style={{ color: brand.text, fontSize: 24, fontWeight: "800" }}>
                  ZMW {ride?.fareAmount?.toFixed(2) ?? "0.00"}
                </Text>
              </View>
            </View>
          </AppCard>

          <AppCard tone="muted">
            <Text style={{ fontSize: 16, fontWeight: "800", color: brand.text }}>
              {IS_DRIVER_APP ? "Trip Earnings" : "Payment Method"}
            </Text>
            <View style={{ marginTop: 10, gap: 8 }}>
              {IS_DRIVER_APP ? (
                <View
                  style={{
                    borderRadius: radii.md,
                    borderWidth: 1,
                    borderColor: brand.success,
                    backgroundColor: brand.surface,
                    padding: 16,
                    alignItems: "center",
                  }}
                >
                  <Ionicons name="checkmark-circle" size={48} color={brand.success} />
                  <Text style={{ marginTop: 8, fontSize: 18, fontWeight: "800", color: brand.text }}>
                    ZMW {ride?.fareAmount?.toFixed(2) ?? "0.00"} Added
                  </Text>
                  <Text style={{ marginTop: 4, fontSize: 13, color: brand.textMuted }}>
                    Earnings have been added to your wallet.
                  </Text>
                </View>
              ) : (
                <>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => setPaymentMethod("cash")}
                    style={{
                      borderRadius: radii.md,
                      borderWidth: 1,
                      borderColor: paymentMethod === "cash" ? brand.primary : brand.border,
                      backgroundColor: paymentMethod === "cash" ? brand.primarySoft : brand.surface,
                      padding: 12,
                      flexDirection: "row",
                      justifyContent: "space-between",
                    }}
                  >
                    <View>
                      <Text style={{ fontWeight: "700", color: brand.text }}>Cash</Text>
                      <Text style={{ marginTop: 3, fontSize: 12, color: brand.textMuted }}>Pay driver at destination</Text>
                    </View>
                    <Ionicons name="cash-outline" size={22} color={paymentMethod === "cash" ? brand.primary : brand.textMuted} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => setPaymentMethod("mobile_money")}
                    style={{
                      borderRadius: radii.md,
                      borderWidth: 1,
                      borderColor: paymentMethod === "mobile_money" ? brand.primary : brand.border,
                      backgroundColor: paymentMethod === "mobile_money" ? brand.primarySoft : brand.surface,
                      padding: 12,
                      flexDirection: "row",
                      justifyContent: "space-between",
                    }}
                  >
                    <View>
                      <Text style={{ fontWeight: "700", color: brand.text }}>Mobile Money</Text>
                      <Text style={{ marginTop: 3, fontSize: 12, color: brand.textMuted }}>MTN / Airtel Money</Text>
                    </View>
                    <Ionicons name="phone-portrait-outline" size={22} color={paymentMethod === "mobile_money" ? brand.primary : brand.textMuted} />
                  </TouchableOpacity>
                </>
              )}
            </View>
          </AppCard>

          <AppButton
            label={IS_DRIVER_APP ? "Back to Dashboard" : "Confirm Payment"}
            onPress={() => {
              if (IS_DRIVER_APP) {
                router.replace("/driver-dashboard" as never);
              } else {
                Alert.alert("Payment confirmed", "Payment status has been captured for this trip.");
                router.replace("/(tabs)/" as never);
              }
            }}
          />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
