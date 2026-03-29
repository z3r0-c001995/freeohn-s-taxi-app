import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Linking, ScrollView, Text, TouchableOpacity, View, Modal } from "react-native";
import MapView from "react-native-maps";
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
import { useVoiceInstructor } from "@/hooks/use-voice-instructor";
import { cancelTrip, rateTrip, sendSos, shareTrip } from "@/lib/ride-hailing-api";
import { trpc } from "@/lib/trpc";
import { getTripRouteColor } from "@/lib/trip-route-style";
import { IS_SEEKER_APP } from "@/constants/app-variant";
import { mapRemoteTripToLocal } from "@/lib/ride-utils";
import { addFavouriteDriver } from "@/lib/db-service";
import { useAppStore } from "@/lib/store";

export default function TripDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const brand = useBrandTheme();
  const { currentUser, setActiveRide } = useAppStore();
  const { trip, driverLocation, isLoading, transport } = useTripRealtime(id ?? null);

  const [rating, setRating] = useState("5");
  const [feedback, setFeedback] = useState("");
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [matchingElapsedSec, setMatchingElapsedSec] = useState(0);
  const mapRef = useRef<MapView>(null);

  // Voice instructor: speaks navigation cues at each trip state change
  useVoiceInstructor({ tripState: trip?.state });

  const canCancel = useMemo(() => {
    if (!trip?.state) return false;
    return ["CREATED", "MATCHING", "DRIVER_ASSIGNED", "DRIVER_ARRIVING", "PIN_VERIFICATION"].includes(trip.state);
  }, [trip?.state]);

  const isMatchingState = trip?.state === "CREATED" || trip?.state === "MATCHING";
  const isCompleted = trip?.state === "COMPLETED";

  useEffect(() => {
    if (isCompleted && IS_SEEKER_APP) {
      setShowRatingModal(true);
    }
  }, [isCompleted]);

  useEffect(() => {
    if (trip) {
      setActiveRide(mapRemoteTripToLocal(trip) as any);
    }
  }, [trip, setActiveRide]);

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

  useEffect(() => {
    if (trip?.state === "IN_PROGRESS" && driverLocation?.lat && driverLocation?.lng) {
      mapRef.current?.animateCamera({
        center: { latitude: driverLocation.lat, longitude: driverLocation.lng },
        zoom: 17.5,
      }, { duration: 1200 });
    }
  }, [trip?.state, driverLocation?.lat, driverLocation?.lng]);

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
      : trip?.driver?.location &&
          Number.isFinite(Number(trip.driver.location.lat)) &&
          Number.isFinite(Number(trip.driver.location.lng))
        ? [
            {
              lat: Number(trip.driver.location.lat),
              lng: Number(trip.driver.location.lng),
            },
          ]
        : [];

  const { data: routeData } = trpc.maps.computeRoute.useQuery(
    {
      origin: pickupLocation!,
      destination: dropoffLocation!,
      travelMode: "DRIVE",
    },
    {
      enabled: !!pickupLocation && !!dropoffLocation,
    },
  );

  const routeColor = useMemo(
    () => getTripRouteColor(trip?.state, brand),
    [brand, trip?.state],
  );

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
      setFeedback("");
      setShowRatingModal(false);
      router.replace("/payment" as never);
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Unable to submit rating");
    } finally {
      setIsSubmittingRating(false);
    }
  };

  const skipRating = () => {
    setShowRatingModal(false);
    router.replace("/payment" as never);
  };

  const stateLabel = trip?.state ?? (isLoading ? "Loading..." : "Unknown");

  return (
    <ScreenContainer className="bg-background" containerClassName="bg-background">
      <View style={{ flex: 1 }}>
        {/* Map Section */}
        <View style={{ flex: 1 }}>
          <RideMap
            mapRef={mapRef}
            userLocation={pickupLocation}
            pickupLocation={pickupLocation}
            dropoffLocation={dropoffLocation}
            routePolyline={routeData?.encodedPolyline}
            routeColor={routeColor}
            nearbyDrivers={liveDriverMarker}
            style={{ flex: 1 }}
          />
          <TouchableOpacity 
            onPress={() => router.back()}
            style={{ position: 'absolute', top: 50, left: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', ...shadows.md }}
          >
            <Ionicons name="arrow-back" size={24} color={brand.text} />
          </TouchableOpacity>

          {/* Floating Status Badge */}
          <View style={{ position: 'absolute', top: 50, alignSelf: 'center', backgroundColor: brand.accent, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, ...shadows.md }}>
             <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13 }}>{stateLabel.replace('_', ' ')}</Text>
          </View>
        </View>

        {/* Bottom Details Card */}
        <View style={{ backgroundColor: brand.background, borderTopLeftRadius: 32, borderTopRightRadius: 32, marginTop: -32, padding: 24, ...shadows.lg }}>
          
          {/* Top Handle Decor */}
          <View style={{ width: 40, height: 4, backgroundColor: brand.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 }} />

          {trip?.driver ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: '#E2E8F0', marginRight: 16, overflow: 'hidden' }}>
                    <Ionicons name="person" size={44} color="#64748B" style={{ alignSelf: 'center', marginTop: 10 }} />
                  </View>
                  <View>
                    <Text style={{ fontSize: 20, fontWeight: '800', color: brand.text }}>{trip.driver.name}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                      <Ionicons name="star" size={16} color="#F59E0B" />
                      <Text style={{ fontSize: 14, fontWeight: '600', color: brand.textMuted, marginLeft: 4 }}>{trip.driver.rating || '4.9'}</Text>
                      <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: brand.border, marginHorizontal: 8 }} />
                      <Text style={{ fontSize: 14, color: brand.textMuted }}>{trip.driver.vehicle?.plateNumber || 'BXC 1234'}</Text>
                    </View>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <TouchableOpacity 
                    onPress={() => Linking.openURL("tel:+260000000000")}
                    style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFF7ED', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Ionicons name="call" size={20} color={brand.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={() => router.push("/(tabs)/chat")}
                    style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFF7ED', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Ionicons name="chatbubble" size={20} color={brand.primary} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
                <View style={{ flex: 1, backgroundColor: brand.surfaceMuted, borderRadius: radii.lg, padding: 12, alignItems: 'center' }}>
                   <Text style={{ fontSize: 11, color: brand.textMuted, marginBottom: 4 }}>Fare (ZMW)</Text>
                   <Text style={{ fontSize: 17, fontWeight: '800', color: brand.primary }}>
                     {trip.fare?.total != null ? Number(trip.fare.total).toFixed(2) : '—'}
                   </Text>
                </View>
                <View style={{ flex: 1, backgroundColor: brand.surfaceMuted, borderRadius: radii.lg, padding: 12, alignItems: 'center' }}>
                   <Text style={{ fontSize: 11, color: brand.textMuted, marginBottom: 4 }}>Distance</Text>
                   <Text style={{ fontSize: 17, fontWeight: '800', color: brand.text }}>
                     {trip.fare?.distanceMeters != null ? `${(trip.fare.distanceMeters / 1000).toFixed(1)} km` : '—'}
                   </Text>
                </View>
                <View style={{ flex: 1, backgroundColor: brand.surfaceMuted, borderRadius: radii.lg, padding: 12, alignItems: 'center' }}>
                   <Text style={{ fontSize: 11, color: brand.textMuted, marginBottom: 4 }}>Vehicle</Text>
                   <Text style={{ fontSize: 13, fontWeight: '700', color: brand.text }} numberOfLines={1}>{trip.driver.vehicle?.model || 'Sedan'}</Text>
                </View>
              </View>
            </>
          ) : (
            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
               <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: brand.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                 <Ionicons name="car-sport" size={40} color={brand.primary} />
               </View>
               <Text style={{ fontSize: 20, fontWeight: '800', color: brand.text }}>Finding your driver...</Text>
               <Text style={{ fontSize: 14, color: brand.textMuted, marginTop: 8 }}>{matchingCounterLabel} elapsed</Text>
            </View>
          )}

          {canCancel && (
            <AppButton 
              label="Cancel Ride" 
              variant="primary" 
              onPress={handleCancel}
              style={{ height: 56, backgroundColor: brand.primary, borderRadius: radii.xl }}
            />
          )}

          {trip?.state === "COMPLETED" && (
            <View style={{ gap: 10 }}>
              {IS_SEEKER_APP ? (
                <AppButton 
                  label="Proceed to Payment" 
                  variant="primary"
                  onPress={() => router.replace("/payment" as never)} 
                  style={{ height: 56, borderRadius: radii.xl }}
                />
              ) : null}
              {IS_SEEKER_APP && trip.driver?.id && currentUser && (
                <AppButton
                  label="Add to Favourites"
                  variant="outline"
                  onPress={async () => {
                    await addFavouriteDriver(currentUser.id.toString(), trip.driver!.id.toString());
                    Alert.alert("Success", "Driver added to your favourites!");
                  }}
                  leftIcon={<Ionicons name="heart-outline" size={18} color={brand.accent} />}
                />
              )}
            </View>
          )}

          <View style={{ height: 20 }} />
        </View>
      </View>

      {/* RATING MODAL OVERLAY */}
      <Modal visible={showRatingModal} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: brand.background, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40, ...shadows.lg }}>
            <Text style={{ fontSize: 24, fontWeight: "800", color: brand.text, marginBottom: 8, textAlign: "center" }}>Rate you trip</Text>
            <Text style={{ fontSize: 16, color: brand.textMuted, textAlign: "center", marginBottom: 24 }}>How was your ride with {trip?.driver?.name || "your driver"}?</Text>

            <View style={{ flexDirection: "row", justifyContent: "center", gap: 12, marginBottom: 24 }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => setRating(String(star))}>
                  <Ionicons name={Number(rating) >= star ? "star" : "star-outline"} size={40} color="#F59E0B" />
                </TouchableOpacity>
              ))}
            </View>

            <AppInput
              label="Leave feedback (optional)"
              placeholder="Was the car clean? Was the driving smooth?"
              value={feedback}
              onChangeText={setFeedback}
              multiline
              numberOfLines={3}
              style={{ minHeight: 80, marginBottom: 24 }}
            />

            <View style={{ flexDirection: "row", gap: 12 }}>
              <AppButton variant="outline" label="Skip" onPress={skipRating} style={{ flex: 1 }} fullWidth={false} />
              <AppButton label="Submit" onPress={handleRate} loading={isSubmittingRating} style={{ flex: 1 }} fullWidth={false} />
            </View>
          </View>
        </View>
      </Modal>

    </ScreenContainer>
  );
}
