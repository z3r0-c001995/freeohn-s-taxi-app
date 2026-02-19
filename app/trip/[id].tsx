import { useEffect, useMemo, useState } from "react";
import { Alert, Linking, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "@/components/screen-container";
import { RideMap } from "@/components/maps/RideMap";
import { AppBadge } from "@/components/ui/app-badge";
import { AppButton } from "@/components/ui/app-button";
import { AppCard } from "@/components/ui/app-card";
import { AppInput } from "@/components/ui/app-input";
import { radii, shadows } from "@/constants/design-system";
import { useBrandTheme } from "@/hooks/use-brand-theme";
import { useTripRealtime } from "@/hooks/use-trip-realtime";
import { cancelTrip, rateTrip, sendSos, shareTrip } from "@/lib/ride-hailing-api";

export default function TripDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const brand = useBrandTheme();
  const { trip, driverLocation, isLoading, transport } = useTripRealtime(id ?? null);

  const [rating, setRating] = useState("5");
  const [feedback, setFeedback] = useState("");
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [matchingElapsedSec, setMatchingElapsedSec] = useState(0);

  const canCancel = useMemo(() => {
    if (!trip?.state) return false;
    return ["CREATED", "MATCHING", "DRIVER_ASSIGNED", "DRIVER_ARRIVING", "PIN_VERIFICATION"].includes(trip.state);
  }, [trip?.state]);

  const isMatchingState = trip?.state === "CREATED" || trip?.state === "MATCHING";

  useEffect(() => {
    if (!trip?.createdAt || !isMatchingState) {
      setMatchingElapsedSec(0);
      return;
    }

    const start = new Date(trip.createdAt).getTime();
    const update = () => {
      const elapsed = Math.max(0, Math.floor((Date.now() - start) / 1000));
      setMatchingElapsedSec(elapsed);
    };

    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [trip?.createdAt, isMatchingState]);

  const matchingCounterLabel = useMemo(() => {
    const minutes = Math.floor(matchingElapsedSec / 60);
    const seconds = matchingElapsedSec % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }, [matchingElapsedSec]);

  const pickupLocation = trip?.pickup
    ? { lat: Number(trip.pickup.lat), lng: Number(trip.pickup.lng) }
    : undefined;
  const dropoffLocation = trip?.dropoff
    ? { lat: Number(trip.dropoff.lat), lng: Number(trip.dropoff.lng) }
    : undefined;

  const liveDriverMarker =
    driverLocation && Number.isFinite(driverLocation.lat) && Number.isFinite(driverLocation.lng)
      ? [{ lat: driverLocation.lat, lng: driverLocation.lng, heading: driverLocation.heading }]
      : [];

  const handleCancel = async () => {
    if (!id) return;
    try {
      await cancelTrip(id, "RIDER_CHANGED_MIND");
      Alert.alert("Trip cancelled", "Your trip has been cancelled.");
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Unable to cancel trip");
    }
  };

  const handleShareRoute = async () => {
    if (!id) return;
    try {
      const shared = await shareTrip(id);
      const url = typeof window === "undefined" ? shared.url : `${window.location.origin}${shared.url}`;
      Alert.alert("Share link", url);
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Unable to share route");
    }
  };

  const handleSOS = async () => {
    if (!id) return;
    try {
      const response = await sendSos(id, "Passenger emergency alert");
      Alert.alert("SOS sent", `Support has been notified.\nEmergency: ${response.support.emergencyPhone}`, [
        {
          text: "Call emergency",
          onPress: () => {
            void Linking.openURL(`tel:${response.support.emergencyPhone}`);
          },
        },
        { text: "OK" },
      ]);
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Unable to send SOS");
    }
  };

  const handleRate = async () => {
    if (!id) return;
    const parsed = Number(rating);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5) {
      Alert.alert("Invalid rating", "Rating must be between 1 and 5.");
      return;
    }
    try {
      setIsSubmittingRating(true);
      await rateTrip(id, { score: parsed, feedback: feedback.trim() || undefined });
      Alert.alert("Thanks", "Your rating was submitted.");
      setFeedback("");
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Unable to submit rating");
    } finally {
      setIsSubmittingRating(false);
    }
  };

  const stateLabel = trip?.state ?? (isLoading ? "Loading..." : "Unknown");

  return (
    <ScreenContainer className="bg-background" containerClassName="bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <View style={{ gap: 16, paddingBottom: 20 }}>
          <View
            style={{
              borderRadius: radii.xl,
              backgroundColor: "#0A1E49",
              padding: 18,
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
              <AppBadge
                label={transport === "websocket" ? "Realtime: WebSocket" : transport === "sse" ? "Realtime: SSE" : "Realtime: Polling"}
                tone="primary"
              />
            </View>
            <Text style={{ marginTop: 14, fontSize: 27, fontWeight: "800", color: "#FFFFFF" }}>Trip Status</Text>
            <Text style={{ marginTop: 5, color: "#CBD5E1", fontSize: 13 }}>Trip ID: {id ?? "-"}</Text>
            <Text style={{ marginTop: 3, color: "#CBD5E1", fontSize: 13 }}>State: {stateLabel}</Text>
          </View>

          {isMatchingState ? (
            <AppCard tone="primary">
              <Text style={{ fontSize: 18, fontWeight: "800", color: brand.text }}>Looking for nearby drivers...</Text>
              <Text style={{ marginTop: 5, fontSize: 13, color: brand.textMuted }}>
                Stay on this screen while we dispatch your request.
              </Text>
              <View style={{ marginTop: 18, alignItems: "center", justifyContent: "center" }}>
                <View
                  style={{
                    width: 106,
                    height: 106,
                    borderRadius: 999,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "rgba(249,115,22,0.15)",
                    borderWidth: 1,
                    borderColor: "rgba(249,115,22,0.5)",
                  }}
                >
                  <View
                    style={{
                      width: 54,
                      height: 54,
                      borderRadius: 999,
                      backgroundColor: brand.primary,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons name="car-sport" size={24} color="#FFFFFF" />
                  </View>
                </View>
                <Text style={{ marginTop: 14, fontSize: 32, fontWeight: "800", color: brand.text }}>{matchingCounterLabel}</Text>
                <Text style={{ marginTop: 2, fontSize: 12, color: brand.textMuted }}>matching timer</Text>
              </View>
              <View style={{ marginTop: 14 }}>
                <AppButton label="Cancel Request" variant="outline" onPress={handleCancel} />
              </View>
            </AppCard>
          ) : null}

          {(pickupLocation || dropoffLocation) ? (
            <View style={{ borderRadius: radii.xl, overflow: "hidden", borderWidth: 1, borderColor: brand.border }}>
              <RideMap
                userLocation={pickupLocation}
                pickupLocation={pickupLocation}
                dropoffLocation={dropoffLocation}
                nearbyDrivers={liveDriverMarker}
                style={{ height: 320 }}
              />
              <View style={{ padding: 12, backgroundColor: brand.surface }}>
                <Text style={{ fontSize: 12, color: brand.textMuted }}>
                  Driver GPS: {driverLocation ? `${driverLocation.lat.toFixed(5)}, ${driverLocation.lng.toFixed(5)}` : "Waiting for live updates"}
                </Text>
              </View>
            </View>
          ) : null}

          <AppCard>
            <Text style={{ fontSize: 14, color: brand.textMuted }}>Pickup</Text>
            <Text style={{ marginTop: 3, fontSize: 15, color: brand.text }}>{trip?.pickup?.address ?? "-"}</Text>
            <Text style={{ marginTop: 10, fontSize: 14, color: brand.textMuted }}>Dropoff</Text>
            <Text style={{ marginTop: 3, fontSize: 15, color: brand.text }}>{trip?.dropoff?.address ?? "-"}</Text>

            <View style={{ marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View>
                <Text style={{ fontSize: 12, color: brand.textMuted }}>Total fare</Text>
                <Text style={{ marginTop: 3, fontSize: 30, fontWeight: "800", color: brand.text }}>
                  {trip?.fare?.currency ?? "USD"} {trip?.fare?.total?.toFixed ? trip.fare.total.toFixed(2) : "--"}
                </Text>
              </View>
              <AppBadge label={stateLabel} tone="neutral" />
            </View>
          </AppCard>

          {trip?.driver ? (
            <AppCard tone="accent">
              <Text style={{ fontSize: 17, fontWeight: "800", color: brand.text }}>Driver Assigned</Text>
              <Text style={{ marginTop: 6, fontSize: 14, color: brand.text }}>Name: {trip.driver.name ?? "Driver"}</Text>
              <Text style={{ marginTop: 2, fontSize: 13, color: brand.textMuted }}>Rating: {trip.driver.rating ?? "N/A"}</Text>
              <Text style={{ marginTop: 2, fontSize: 13, color: brand.textMuted }}>
                Vehicle: {trip.driver.vehicle?.make} {trip.driver.vehicle?.model}
              </Text>
              <Text style={{ marginTop: 2, fontSize: 13, color: brand.textMuted }}>
                Plate: {trip.driver.vehicle?.plateNumber} • {trip.driver.vehicle?.color}
              </Text>

              <View style={{ marginTop: 12, flexDirection: "row", gap: 10 }}>
                <AppButton
                  label="Call"
                  variant="secondary"
                  fullWidth={false}
                  style={{ flex: 1 }}
                  onPress={() => {
                    void Linking.openURL("tel:+260000000000");
                  }}
                  leftIcon={<Ionicons name="call" size={16} color="#FFFFFF" />}
                />
                <AppButton
                  label="Message"
                  variant="outline"
                  fullWidth={false}
                  style={{ flex: 1 }}
                  onPress={() => router.push("/(tabs)/chat")}
                  leftIcon={<Ionicons name="chatbubble" size={16} color={brand.accent} />}
                />
              </View>
            </AppCard>
          ) : null}

          {trip?.startPin ? (
            <AppCard tone="muted">
              <Text style={{ fontSize: 13, color: brand.textMuted }}>Share this PIN with driver at pickup</Text>
              <Text style={{ marginTop: 6, fontSize: 40, fontWeight: "800", color: brand.primary, letterSpacing: 8 }}>
                {trip.startPin}
              </Text>
            </AppCard>
          ) : null}

          <AppCard tone="muted">
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: brand.text }}>Safety Center</Text>
              <TouchableOpacity
                onPress={handleSOS}
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 999,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#FEE2E2",
                }}
              >
                <Ionicons name="warning" size={18} color={brand.danger} />
              </TouchableOpacity>
            </View>
            <Text style={{ marginTop: 6, fontSize: 12, color: brand.textMuted }}>
              Share route with trusted contacts or trigger emergency support.
            </Text>
            <View style={{ marginTop: 10 }}>
              <AppButton label="Share Live Route" variant="outline" onPress={handleShareRoute} />
            </View>
          </AppCard>

          {canCancel ? <AppButton label="Cancel Trip" variant="danger" onPress={handleCancel} /> : null}

          {trip?.state === "COMPLETED" ? (
            <AppCard>
              <Text style={{ fontSize: 18, fontWeight: "800", color: brand.text }}>Rate your driver</Text>
              <View style={{ marginTop: 12 }}>
                <AppInput
                  label="Rating (1-5)"
                  value={rating}
                  onChangeText={setRating}
                  keyboardType="numeric"
                  maxLength={1}
                />
              </View>
              <View style={{ marginTop: 10 }}>
                <AppInput
                  label="Feedback (optional)"
                  value={feedback}
                  onChangeText={setFeedback}
                  placeholder="Share trip feedback"
                />
              </View>

              <View style={{ marginTop: 14 }}>
                <AppButton
                  label={isSubmittingRating ? "Submitting..." : "Submit Rating"}
                  loading={isSubmittingRating}
                  onPress={handleRate}
                />
              </View>

              <View style={{ marginTop: 10 }}>
                <AppButton label="View Payment Summary" variant="outline" onPress={() => router.push("/payment" as never)} />
              </View>
            </AppCard>
          ) : null}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
