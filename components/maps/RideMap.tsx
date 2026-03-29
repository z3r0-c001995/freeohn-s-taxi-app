import React, { useMemo } from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import MapView, { Marker, Polyline, Circle, PROVIDER_GOOGLE } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import { LatLng } from "../../lib/maps/map-types";
import { RideMapProps } from "./RideMap.types";
import { IS_DRIVER_APP } from "@/constants/app-variant";
import { driverTheme, riderTheme } from "@/constants/design-system";

const decodePolyline = (encoded: string): LatLng[] => {
  const points: LatLng[] = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let shift = 0, result = 0, byte: number;
    do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0; result = 0;
    do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
};

/** Branded pickup pin — green bubble with label */
function PickupPin({ color }: { color: string }) {
  return (
    <View style={styles.pinWrap}>
      <View style={[styles.pinBubble, { backgroundColor: color }]}>
        <Ionicons name="radio-button-on" size={12} color="#FFFFFF" />
        <Text style={styles.pinLabel}>Pickup</Text>
      </View>
      <View style={[styles.pinTip, { borderTopColor: color }]} />
    </View>
  );
}

/** Branded dropoff pin — orange bubble with label */
function DropoffPin({ color }: { color: string }) {
  return (
    <View style={styles.pinWrap}>
      <View style={[styles.pinBubble, { backgroundColor: color }]}>
        <Ionicons name="location" size={12} color="#FFFFFF" />
        <Text style={styles.pinLabel}>Drop-off</Text>
      </View>
      <View style={[styles.pinTip, { borderTopColor: color }]} />
    </View>
  );
}

function DriverPin({ color }: { color: string }) {
  return (
    <View style={[styles.driverMarker, { backgroundColor: "#1E293B", borderColor: color, shadowColor: color }]}>
      <Ionicons name="car-sport" size={20} color={color} />
    </View>
  );
}

// Minimal, elegant dark style for Google Maps Native
const customMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#263c3f" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#6b9a76" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9ca5b3" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#746855" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1f2835" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#f3d19c" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#2f3948" }] },
  { featureType: "transit.station", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#515c6d" }] },
  { featureType: "water", elementType: "labels.text.stroke", stylers: [{ color: "#17263c" }] }
];

export function RideMap({
  userLocation,
  pickupLocation,
  dropoffLocation,
  routePolyline,
  routeColor,
  nearbyDrivers = [],
  hotspots = [],
  onPickupSelect,
  onDropoffSelect,
  style,
  mapRef,
}: RideMapProps) {
  const mapTheme = IS_DRIVER_APP ? driverTheme : riderTheme;
  const polylinePoints = useMemo(() => (routePolyline ? decodePolyline(routePolyline) : []), [routePolyline]);
  const fallbackPoints = useMemo(() => {
    if (!pickupLocation || !dropoffLocation) return [];
    return [pickupLocation, dropoffLocation];
  }, [pickupLocation, dropoffLocation]);

  const routeCoordinates = (polylinePoints.length > 1 ? polylinePoints : fallbackPoints).map((p) => ({
    latitude: p.lat,
    longitude: p.lng,
  }));

  const hasAndroidGoogleMapsKey = Boolean(process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY);
  const mapProvider = Platform.OS === "android" && hasAndroidGoogleMapsKey ? PROVIDER_GOOGLE : undefined;

  const defaultRegion = {
    latitude: userLocation?.lat ?? -11.197,
    longitude: userLocation?.lng ?? 28.891,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  return (
    <View style={[styles.wrapper, style]}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={mapProvider}
        initialRegion={defaultRegion}
        showsUserLocation={!!userLocation}
        showsMyLocationButton
        userInterfaceStyle="dark"
        customMapStyle={mapProvider === PROVIDER_GOOGLE ? customMapStyle : undefined}
        onLongPress={(e: any) => {
          const { coordinate } = e.nativeEvent;
          if (onPickupSelect && !pickupLocation) {
            onPickupSelect({ lat: coordinate.latitude, lng: coordinate.longitude });
          } else if (onDropoffSelect) {
            onDropoffSelect({ lat: coordinate.latitude, lng: coordinate.longitude });
          }
        }}
      >
        {/* Pickup marker */}
        {pickupLocation && (
          <Marker
            coordinate={{ latitude: pickupLocation.lat, longitude: pickupLocation.lng }}
            anchor={{ x: 0.5, y: 1 }}
          >
            <PickupPin color={mapTheme.mapPickup} />
          </Marker>
        )}

        {/* Dropoff marker */}
        {dropoffLocation && (
          <Marker
            coordinate={{ latitude: dropoffLocation.lat, longitude: dropoffLocation.lng }}
            anchor={{ x: 0.5, y: 1 }}
          >
            <DropoffPin color={mapTheme.mapDropoff} />
          </Marker>
        )}

        {/* Nearby drivers */}
        {nearbyDrivers.map((driver, index) => (
          <Marker
            key={`driver-${index}`}
            coordinate={{ latitude: driver.lat, longitude: driver.lng }}
            anchor={{ x: 0.5, y: 0.5 }}
            rotation={typeof driver.heading === "number" ? driver.heading : 0}
          >
            <DriverPin color={mapTheme.mapDriver} />
          </Marker>
        ))}

        {/* Hotspots */}
        {hotspots.map((hs, index) => (
          <Circle
            key={`hotspot-${index}`}
            center={{ latitude: hs.lat, longitude: hs.lng }}
            radius={hs.radius ?? 500}
            fillColor={hs.color ? `${hs.color}33` : "rgba(239, 68, 68, 0.2)"}
            strokeColor={hs.color || "#EF4444"}
            strokeWidth={1}
          />
        ))}

        {/* Route casing (darker casing for dark map) */}
        {routeCoordinates.length > 1 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor="#0F172A"
            strokeWidth={11}
          />
        )}

        {/* Route line (colored, on top) */}
        {routeCoordinates.length > 1 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor={routeColor ?? mapTheme.accent}
            strokeWidth={5}
            lineDashPattern={routeColor ? [0] : undefined} // Add dash for in-progress if needed
          />
        )}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { height: 300 },
  map: { flex: 1 },
  // Pin marker
  pinWrap: { alignItems: "center" },
  pinBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.4)",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 4,
  },
  pinLabel: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  pinTip: {
    width: 0, height: 0,
    borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 7,
    borderLeftColor: "transparent", borderRightColor: "transparent",
    marginTop: -1,
  },
  // Driver marker
  driverMarker: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "#1E293B",
    borderWidth: 2,
    alignItems: "center", justifyContent: "center",
    shadowOpacity: 0.6,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 8,
  },
});
