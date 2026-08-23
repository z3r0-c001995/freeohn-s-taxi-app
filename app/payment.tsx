import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { IS_DRIVER_APP, IS_SEEKER_APP } from "@/constants/app-variant";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "@/components/screen-container";
import { DriverNavBar } from "@/components/navigation/DriverNavBar";
import { PassengerNavBar } from "@/components/navigation/PassengerNavBar";
import { AppBadge } from "@/components/ui/app-badge";
import { AppButton } from "@/components/ui/app-button";
import { AppCard } from "@/components/ui/app-card";
import { radii, shadows } from "@/constants/design-system";
import { useBrandTheme } from "@/hooks/use-brand-theme";
import { useAppStore } from "@/lib/store";
import { getTrip, getTrips } from "@/lib/ride-hailing-api";
import { mapRemoteTripToLocal } from "@/lib/ride-utils";

export default function PaymentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tripId?: string }>();
  const brand = useBrandTheme();
  const { activeRide, rideHistory } = useAppStore();
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "mobile_money">("cash");
  const [loadedTrip, setLoadedTrip] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function loadTripData() {
      // 1. If activeRide exists, use it
      if (activeRide) {
        setLoadedTrip(activeRide);
        return;
      }

      // 2. If tripId was passed, fetch it directly
      if (params.tripId) {
        setIsLoading(true);
        try {
          const remote = await getTrip(params.tripId);
          if (remote) {
            setLoadedTrip(mapRemoteTripToLocal(remote));
            setIsLoading(false);
            return;
          }
        } catch (e) {
          console.warn("[PaymentScreen] Failed to fetch trip by id:", e);
        }
      }

      // 3. Otherwise, fetch the most recent completed trip from server
      setIsLoading(true);
      try {
        const history = await getTrips();
        if (history && history.length > 0) {
          setLoadedTrip(mapRemoteTripToLocal(history[0]));
        } else if (rideHistory.length > 0) {
          setLoadedTrip(rideHistory[0]);
        }
      } catch (e) {
        if (rideHistory.length > 0) {
          setLoadedTrip(rideHistory[0]);
        }
      } finally {
        setIsLoading(false);
      }
    }

    loadTripData();
  }, [params.tripId, activeRide]);

  const ride = loadedTrip ?? activeRide ?? rideHistory[0] ?? null;
  const distanceKm = ride?.distanceMeters ? ride.distanceMeters / 1000 : 0;
  const durationMinutes = ride?.durationSeconds ? ride.durationSeconds / 60 : 0;
  const fareAmount = Number(ride?.fareAmount ?? 0);

  const baseFare = fareAmount > 0 ? Math.max(15, fareAmount * 0.35) : 0;
  const distanceFare = fareAmount > 0 ? Math.max(0, fareAmount * 0.45) : 0;
  const timeFare = fareAmount > 0 ? Math.max(0, fareAmount * 0.2) : 0;

  return (
    <ScreenContainer className="bg-background" containerClassName="bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <View style={{ gap: 16, paddingBottom: 24, paddingHorizontal: 16, paddingTop: 16 }}>
          {/* Header Card */}
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
              <AppBadge label="Payment Details" tone="primary" />
            </View>
            <Text style={{ marginTop: 14, fontSize: 26, fontWeight: "900", color: "#FFFFFF" }}>
              {IS_DRIVER_APP ? "Trip Payout Summary" : "Trip Payment"}
            </Text>
            <Text style={{ marginTop: 4, fontSize: 13, color: "#CBD5E1" }}>
              {IS_DRIVER_APP
                ? "Review earnings credited to your driver wallet for this completed trip."
                : "Review trip receipt and confirm payment to your driver."}
            </Text>
          </View>

          {isLoading ? (
            <View style={{ paddingVertical: 40, alignItems: "center" }}>
              <ActivityIndicator size="large" color={brand.primary} />
              <Text style={{ marginTop: 12, color: brand.textMuted, fontSize: 14 }}>Loading trip details...</Text>
            </View>
          ) : !ride ? (
            <AppCard tone="muted">
              <View style={{ paddingVertical: 20, alignItems: "center" }}>
                <Ionicons name="receipt-outline" size={40} color={brand.textMuted} />
                <Text style={{ marginTop: 10, fontSize: 16, fontWeight: "700", color: brand.text }}>
                  No recent trip found
                </Text>
                <Text style={{ marginTop: 4, fontSize: 13, color: brand.textMuted, textAlign: "center" }}>
                  Complete a ride to view receipt and payment options.
                </Text>
              </View>
            </AppCard>
          ) : (
            <>
              {/* Trip Route Card */}
              <AppCard>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <Text style={{ fontSize: 15, fontWeight: "800", color: brand.text }}>Trip Summary</Text>
                  <AppBadge label="COMPLETED" tone="success" />
                </View>

                <View style={{ gap: 10 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#16A34A" }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, color: brand.textMuted }}>Pickup</Text>
                      <Text style={{ fontSize: 13, fontWeight: "700", color: brand.text }} numberOfLines={1}>
                        {ride.pickupAddress || "Pickup location"}
                      </Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: brand.primary }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, color: brand.textMuted }}>Destination</Text>
                      <Text style={{ fontSize: 13, fontWeight: "700", color: brand.text }} numberOfLines={1}>
                        {ride.dropoffAddress || "Destination"}
                      </Text>
                    </View>
                  </View>
                </View>
              </AppCard>

              {/* Fare Breakdown */}
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
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={{ color: brand.text, fontSize: 16, fontWeight: "800" }}>Total Fare</Text>
                    <Text style={{ color: brand.primary, fontSize: 24, fontWeight: "900" }}>
                      ZMW {fareAmount.toFixed(2)}
                    </Text>
                  </View>
                </View>
              </AppCard>

              {/* Payment Method Selection or Driver Credit HUD */}
              <AppCard tone="muted">
                <Text style={{ fontSize: 16, fontWeight: "800", color: brand.text }}>
                  {IS_DRIVER_APP ? "Driver Payout" : "Select Payment Method"}
                </Text>
                <View style={{ marginTop: 10, gap: 8 }}>
                  {IS_DRIVER_APP ? (
                    <View
                      style={{
                        borderRadius: radii.md,
                        borderWidth: 1,
                        borderColor: "#BBF7D0",
                        backgroundColor: "#F0FDF4",
                        padding: 16,
                        alignItems: "center",
                      }}
                    >
                      <Ionicons name="checkmark-circle" size={44} color="#16A34A" />
                      <Text style={{ marginTop: 8, fontSize: 20, fontWeight: "900", color: "#166534" }}>
                        +ZMW {fareAmount.toFixed(2)}
                      </Text>
                      <Text style={{ marginTop: 4, fontSize: 13, color: "#15803D" }}>
                        Trip fare credited to your driver wallet.
                      </Text>
                    </View>
                  ) : (
                    <>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => setPaymentMethod("cash")}
                        style={{
                          borderRadius: radii.md,
                          borderWidth: 1.5,
                          borderColor: paymentMethod === "cash" ? brand.primary : brand.border,
                          backgroundColor: paymentMethod === "cash" ? brand.primarySoft : brand.surface,
                          padding: 14,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <View>
                          <Text style={{ fontWeight: "800", fontSize: 15, color: brand.text }}>Cash</Text>
                          <Text style={{ marginTop: 2, fontSize: 12, color: brand.textMuted }}>Pay driver directly at trip completion</Text>
                        </View>
                        <Ionicons name="cash-outline" size={24} color={paymentMethod === "cash" ? brand.primary : brand.textMuted} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => setPaymentMethod("mobile_money")}
                        style={{
                          borderRadius: radii.md,
                          borderWidth: 1.5,
                          borderColor: paymentMethod === "mobile_money" ? brand.primary : brand.border,
                          backgroundColor: paymentMethod === "mobile_money" ? brand.primarySoft : brand.surface,
                          padding: 14,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <View>
                          <Text style={{ fontWeight: "800", fontSize: 15, color: brand.text }}>Mobile Money (MoMo)</Text>
                          <Text style={{ marginTop: 2, fontSize: 12, color: brand.textMuted }}>MTN / Airtel Money Instant Transfer</Text>
                        </View>
                        <Ionicons name="phone-portrait-outline" size={24} color={paymentMethod === "mobile_money" ? brand.primary : brand.textMuted} />
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </AppCard>

              {/* Action Button */}
              <AppButton
                label={IS_DRIVER_APP ? "Back to Dashboard" : "Complete & Return Home"}
                onPress={() => {
                  if (IS_DRIVER_APP) {
                    router.replace("/driver-dashboard" as never);
                  } else {
                    Alert.alert("Payment confirmed", "Thank you for riding with Freeohn Taxi!");
                    router.replace("/(tabs)/" as never);
                  }
                }}
                style={{ height: 56, borderRadius: radii.xl }}
              />
            </>
          )}
        </View>
      </ScrollView>
      {IS_DRIVER_APP ? <DriverNavBar /> : <PassengerNavBar />}
    </ScreenContainer>
  );
}
