import { useMemo, useState } from "react";
import { Alert, Linking, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/screen-container";
import { RideMap } from "@/components/maps/RideMap";
import { useColors } from "@/hooks/use-colors";
import { useTripRealtime } from "@/hooks/use-trip-realtime";
import { cancelTrip, rateTrip, sendSos, shareTrip } from "@/lib/ride-hailing-api";

export default function TripDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colors = useColors();
  const { trip, driverLocation, isLoading, transport } = useTripRealtime(id ?? null);
  const [rating, setRating] = useState("5");
  const [feedback, setFeedback] = useState("");
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);

  const canCancel = useMemo(() => {
    if (!trip?.state) return false;
    return [
      "CREATED",
      "MATCHING",
      "DRIVER_ASSIGNED",
      "DRIVER_ARRIVING",
      "PIN_VERIFICATION",
    ].includes(trip.state);
  }, [trip?.state]);

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
      Alert.alert("Share Link", url);
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
            <Text className="text-lg font-bold text-foreground">Trip Status</Text>
            <TouchableOpacity
              onPress={() => router.push("/safety-center" as never)}
              className="w-10 h-10 rounded-full items-center justify-center"
              style={{ backgroundColor: colors.surface }}
            >
              <Ionicons name="shield-checkmark" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>

          <View className="rounded-xl p-4" style={{ backgroundColor: colors.surface }}>
            <Text className="text-sm text-muted">Trip ID</Text>
            <Text className="text-base font-semibold text-foreground">{id ?? "-"}</Text>
            <Text className="text-sm text-muted mt-3">Lifecycle state</Text>
            <Text className="text-lg font-bold" style={{ color: colors.primary }}>
              {trip?.state ?? (isLoading ? "Loading..." : "Unknown")}
            </Text>
            <Text className="text-xs text-muted mt-2">
              Realtime: {transport === "websocket" ? "WebSocket" : transport === "sse" ? "SSE fallback" : "Polling"}
            </Text>
          </View>

          {(pickupLocation || dropoffLocation) && (
            <View className="rounded-xl overflow-hidden" style={{ backgroundColor: colors.surface }}>
              <RideMap
                userLocation={pickupLocation}
                pickupLocation={pickupLocation}
                dropoffLocation={dropoffLocation}
                nearbyDrivers={liveDriverMarker}
                style={{ height: 240 }}
              />
              <View className="px-4 py-3">
                <Text className="text-xs text-muted">
                  Driver GPS:{" "}
                  {driverLocation
                    ? `${driverLocation.lat.toFixed(5)}, ${driverLocation.lng.toFixed(5)}`
                    : "Waiting for live updates"}
                </Text>
              </View>
            </View>
          )}

          <View className="rounded-xl p-4 gap-2" style={{ backgroundColor: colors.surface }}>
            <Text className="text-sm text-muted">Pickup</Text>
            <Text className="text-foreground">{trip?.pickup?.address ?? "-"}</Text>
            <Text className="text-sm text-muted mt-2">Dropoff</Text>
            <Text className="text-foreground">{trip?.dropoff?.address ?? "-"}</Text>
            <Text className="text-sm text-muted mt-2">Fare</Text>
            <Text className="text-xl font-bold text-foreground">
              {trip?.fare?.currency ?? "USD"} {trip?.fare?.total?.toFixed ? trip.fare.total.toFixed(2) : "--"}
            </Text>
          </View>

          {trip?.driver && (
            <View className="rounded-xl p-4 gap-2" style={{ backgroundColor: colors.surface }}>
              <Text className="text-lg font-semibold text-foreground">Assigned Driver</Text>
              <Text className="text-sm text-muted">Rating: {trip.driver.rating ?? "N/A"}</Text>
              <Text className="text-sm text-muted">
                Vehicle: {trip.driver.vehicle?.make} {trip.driver.vehicle?.model}
              </Text>
              <Text className="text-sm text-muted">Color: {trip.driver.vehicle?.color}</Text>
              <Text className="text-sm text-muted">Plate: {trip.driver.vehicle?.plateNumber}</Text>
            </View>
          )}

          {trip?.startPin && (
            <View className="rounded-xl p-4 items-center" style={{ backgroundColor: colors.surface }}>
              <Text className="text-sm text-muted">Trip start PIN</Text>
              <Text className="text-4xl font-bold tracking-widest" style={{ color: colors.primary }}>
                {trip.startPin}
              </Text>
            </View>
          )}

          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={handleShareRoute}
              className="flex-1 py-3 rounded-lg items-center justify-center"
              style={{ backgroundColor: colors.primary }}
            >
              <Text className="text-white font-semibold">Share Route</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSOS}
              className="flex-1 py-3 rounded-lg items-center justify-center"
              style={{ backgroundColor: colors.error }}
            >
              <Text className="text-white font-semibold">SOS</Text>
            </TouchableOpacity>
          </View>

          {canCancel && (
            <TouchableOpacity
              onPress={handleCancel}
              className="py-3 rounded-lg items-center justify-center"
              style={{ backgroundColor: colors.warning }}
            >
              <Text className="text-white font-semibold">Cancel Trip</Text>
            </TouchableOpacity>
          )}

          {trip?.state === "COMPLETED" && (
            <View className="rounded-xl p-4 gap-3" style={{ backgroundColor: colors.surface }}>
              <Text className="text-lg font-semibold text-foreground">Rate your driver</Text>
              <TextInput
                value={rating}
                onChangeText={setRating}
                keyboardType="numeric"
                maxLength={1}
                className="border border-border rounded-lg px-3 py-2 text-foreground"
                placeholder="1-5"
                placeholderTextColor={colors.muted}
              />
              <TextInput
                value={feedback}
                onChangeText={setFeedback}
                className="border border-border rounded-lg px-3 py-2 text-foreground"
                placeholder="Optional feedback"
                placeholderTextColor={colors.muted}
              />
              <TouchableOpacity
                disabled={isSubmittingRating}
                onPress={handleRate}
                className="py-3 rounded-lg items-center justify-center"
                style={{ backgroundColor: colors.success, opacity: isSubmittingRating ? 0.6 : 1 }}
              >
                <Text className="text-white font-semibold">
                  {isSubmittingRating ? "Submitting..." : "Submit Rating"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
