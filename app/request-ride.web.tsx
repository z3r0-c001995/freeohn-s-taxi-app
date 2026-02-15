import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, Alert, ScrollView, TextInput } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { RideMap } from "@/components/maps/RideMap";
import { useAppStore } from "@/lib/store";
import { useRouter } from "expo-router";
import { useColors } from "@/hooks/use-colors";
import { createRide } from "@/lib/db-service";
import { createTrip, getNearbyDrivers } from "@/lib/ride-hailing-api";
import { calculateFare } from "@/shared/constants/fare";
import type { NearbyDriverMarker } from "@/lib/maps/map-types";

type RideType = "standard" | "premium";

export default function RequestRideScreen() {
  const router = useRouter();
  const colors = useColors();
  const { currentUser, currentLocation, setActiveRide } = useAppStore();

  const [pickupLat, setPickupLat] = useState("");
  const [pickupLng, setPickupLng] = useState("");
  const [dropoffLat, setDropoffLat] = useState("");
  const [dropoffLng, setDropoffLng] = useState("");
  const [pickupAddress, setPickupAddress] = useState("");
  const [dropoffAddress, setDropoffAddress] = useState("");
  const [rideType, setRideType] = useState<RideType>("standard");
  const [isRequesting, setIsRequesting] = useState(false);
  const [distance, setDistance] = useState(0);
  const [fare, setFare] = useState(0);
  const [nearbyCount, setNearbyCount] = useState<number>(0);
  const [nearbyDrivers, setNearbyDrivers] = useState<NearbyDriverMarker[]>([]);

  useEffect(() => {
    if (currentLocation) {
      setPickupLat(currentLocation.latitude.toString());
      setPickupLng(currentLocation.longitude.toString());
    }
  }, [currentLocation]);

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  useEffect(() => {
    const pLat = parseFloat(pickupLat);
    const pLng = parseFloat(pickupLng);
    const dLat = parseFloat(dropoffLat);
    const dLng = parseFloat(dropoffLng);

    if (!isNaN(pLat) && !isNaN(pLng) && !isNaN(dLat) && !isNaN(dLng)) {
      const dist = calculateDistance(pLat, pLng, dLat, dLng);
      setDistance(dist);
      setFare(calculateFare(dist, 0, rideType)); // Estimate duration as 0 for simplicity
    }
  }, [pickupLat, pickupLng, dropoffLat, dropoffLng, rideType]);

  useEffect(() => {
    const pLat = parseFloat(pickupLat);
    const pLng = parseFloat(pickupLng);
    if (!Number.isFinite(pLat) || !Number.isFinite(pLng)) {
      setNearbyCount(0);
      return;
    }

    let isCancelled = false;
    const fetchNearby = async () => {
      try {
        const response = await getNearbyDrivers({
          pickup: { lat: pLat, lng: pLng },
          radiusKm: 6,
          limit: 20,
        });
        if (!isCancelled) {
          setNearbyCount(response.drivers.length);
          setNearbyDrivers(
            response.drivers.map((driver) => ({
              driverId: driver.driverId,
              lat: driver.location.lat,
              lng: driver.location.lng,
              distanceMeters: driver.distanceMeters,
              etaSeconds: driver.etaSeconds,
            })),
          );
        }
      } catch {
        if (!isCancelled) {
          setNearbyCount(0);
          setNearbyDrivers([]);
        }
      }
    };

    void fetchNearby();
    const timer = setInterval(() => {
      void fetchNearby();
    }, 5000);

    return () => {
      isCancelled = true;
      clearInterval(timer);
    };
  }, [pickupLat, pickupLng]);

  const handleRequestRide = async () => {
    const pLat = parseFloat(pickupLat);
    const pLng = parseFloat(pickupLng);
    const dLat = parseFloat(dropoffLat);
    const dLng = parseFloat(dropoffLng);

    if (!currentUser || isNaN(pLat) || isNaN(pLng) || isNaN(dLat) || isNaN(dLng)) {
      Alert.alert("Error", "Please enter valid coordinates for pickup and dropoff");
      return;
    }

    try {
      setIsRequesting(true);
      const distanceMeters = Number.isFinite(distance) ? Math.max(0, Math.round(distance * 1000)) : 0;
      const durationSeconds =
        distanceMeters > 0 ? Math.max(0, Math.round((distanceMeters / 1000 / 35) * 3600)) : 0;
      const idempotencyKey = `trip_${Date.now()}_${currentUser.id}`;

      try {
        const trip = await createTrip({
          pickup: { lat: pLat, lng: pLng },
          dropoff: { lat: dLat, lng: dLng },
          pickupAddress: pickupAddress || `${pLat}, ${pLng}`,
          dropoffAddress: dropoffAddress || `${dLat}, ${dLng}`,
          rideType,
          distanceMeters,
          durationSeconds,
          paymentMethod: "CASH",
          idempotencyKey,
        });

        router.replace(`/trip/${trip.id}` as never);
        return;
      } catch (apiError) {
        console.warn("[request-ride.web] Remote trip creation failed, falling back to local mode.", apiError);
      }

      const ride = await createRide(
        currentUser.id.toString(),
        pLat,
        pLng,
        dLat,
        dLng,
        pickupAddress || `${pLat}, ${pLng}`,
        dropoffAddress || `${dLat}, ${dLng}`,
        rideType,
        fare,
        distanceMeters,
        durationSeconds
      );

      setActiveRide(ride);
      Alert.alert("Ride requested in offline mode", "Opening trip tracker.");
      router.replace(`/trip/${ride.id}` as never);
    } catch (error) {
      console.error("[request-ride.web] Failed to request ride:", error);
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to request ride. Please try again.");
    } finally {
      setIsRequesting(false);
    }
  };

  const parsedPickupLat = parseFloat(pickupLat);
  const parsedPickupLng = parseFloat(pickupLng);
  const parsedDropoffLat = parseFloat(dropoffLat);
  const parsedDropoffLng = parseFloat(dropoffLng);
  const pickupLocation =
    Number.isFinite(parsedPickupLat) && Number.isFinite(parsedPickupLng)
      ? { lat: parsedPickupLat, lng: parsedPickupLng }
      : undefined;
  const dropoffLocation =
    Number.isFinite(parsedDropoffLat) && Number.isFinite(parsedDropoffLng)
      ? { lat: parsedDropoffLat, lng: parsedDropoffLng }
      : undefined;

  return (
    <ScreenContainer>
      <ScrollView className="flex-1">
        <View className="p-4">
          <Text className="text-2xl font-bold mb-6" style={{ color: colors.text }}>
            Request a Ride (Web)
          </Text>

          <View className="mb-4">
            <Text className="text-lg font-semibold mb-2" style={{ color: colors.text }}>
              Live Map
            </Text>
            <RideMap
              userLocation={currentLocation ? { lat: currentLocation.latitude, lng: currentLocation.longitude } : undefined}
              pickupLocation={pickupLocation}
              dropoffLocation={dropoffLocation}
              nearbyDrivers={nearbyDrivers}
              style={{ height: 280 }}
            />
            <Text className="text-xs mt-2" style={{ color: colors.text }}>
              Map shows pickup, dropoff, and nearby drivers in real time.
            </Text>
          </View>

          {/* Pickup Location */}
          <View className="mb-4">
            <Text className="text-lg font-semibold mb-2" style={{ color: colors.text }}>
              Pickup Location
            </Text>
            <TextInput
              placeholder="Pickup Address (optional)"
              value={pickupAddress}
              onChangeText={setPickupAddress}
              className="border border-gray-300 rounded p-2 mb-2"
              style={{ color: colors.text }}
            />
            <View className="flex-row gap-2">
              <TextInput
                placeholder="Latitude"
                value={pickupLat}
                onChangeText={setPickupLat}
                keyboardType="numeric"
                className="border border-gray-300 rounded p-2 flex-1"
                style={{ color: colors.text }}
              />
              <TextInput
                placeholder="Longitude"
                value={pickupLng}
                onChangeText={setPickupLng}
                keyboardType="numeric"
                className="border border-gray-300 rounded p-2 flex-1"
                style={{ color: colors.text }}
              />
            </View>
          </View>

          {/* Dropoff Location */}
          <View className="mb-4">
            <Text className="text-lg font-semibold mb-2" style={{ color: colors.text }}>
              Dropoff Location
            </Text>
            <TextInput
              placeholder="Dropoff Address (optional)"
              value={dropoffAddress}
              onChangeText={setDropoffAddress}
              className="border border-gray-300 rounded p-2 mb-2"
              style={{ color: colors.text }}
            />
            <View className="flex-row gap-2">
              <TextInput
                placeholder="Latitude"
                value={dropoffLat}
                onChangeText={setDropoffLat}
                keyboardType="numeric"
                className="border border-gray-300 rounded p-2 flex-1"
                style={{ color: colors.text }}
              />
              <TextInput
                placeholder="Longitude"
                value={dropoffLng}
                onChangeText={setDropoffLng}
                keyboardType="numeric"
                className="border border-gray-300 rounded p-2 flex-1"
                style={{ color: colors.text }}
              />
            </View>
          </View>

          {/* Ride Type */}
          <View className="mb-4">
            <Text className="text-lg font-semibold mb-2" style={{ color: colors.text }}>
              Ride Type
            </Text>
            <View className="flex-row gap-2">
              <TouchableOpacity
                onPress={() => setRideType("standard")}
                className={`flex-1 p-3 rounded border ${
                  rideType === "standard" ? "border-blue-500 bg-blue-100" : "border-gray-300"
                }`}
              >
                <Text className="text-center" style={{ color: colors.text }}>
                  Standard
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setRideType("premium")}
                className={`flex-1 p-3 rounded border ${
                  rideType === "premium" ? "border-blue-500 bg-blue-100" : "border-gray-300"
                }`}
              >
                <Text className="text-center" style={{ color: colors.text }}>
                  Premium
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Fare Estimate */}
          {fare > 0 && (
            <View className="mb-4">
              <Text className="text-lg font-semibold mb-2" style={{ color: colors.text }}>
                Estimated Fare
              </Text>
              <Text className="text-xl font-bold" style={{ color: colors.text }}>
                ${fare.toFixed(2)}
              </Text>
              <Text className="text-sm" style={{ color: colors.text }}>
                Distance: {distance.toFixed(2)} km
              </Text>
              <Text className="text-sm" style={{ color: colors.text }}>
                Nearby drivers: {nearbyCount}
              </Text>
            </View>
          )}

          {/* Request Button */}
          <TouchableOpacity
            onPress={handleRequestRide}
            disabled={isRequesting}
            className={`p-4 rounded ${isRequesting ? "bg-gray-400" : "bg-blue-500"}`}
          >
            <Text className="text-white text-center font-semibold">
              {isRequesting ? "Requesting..." : "Request Ride"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
