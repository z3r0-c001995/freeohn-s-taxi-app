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

function SelectedPin() {
  return (
    <View style={styles.pinWrap}>
      <View style={[styles.pinBubble, { backgroundColor: "#4F46E5" }]}>
        <Ionicons name="pin" size={12} color="#FFFFFF" />
        <Text style={styles.pinLabel}>Selected</Text>
      </View>
      <View style={[styles.pinTip, { borderTopColor: "#4F46E5" }]} />
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

export function RideMap({
  userLocation,
  pickupLocation,
  dropoffLocation,
  selectedPin,
  routePolyline,
  routeColor,
  nearbyDrivers = [],
  hotspots = [],
  onPickupSelect,
  onDropoffSelect,
  onMapClick,
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
    latitude: userLocation?.lat ?? -15.4167,
    longitude: userLocation?.lng ?? 28.2833,
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
        onPress={(e: any) => {
          const { coordinate } = e.nativeEvent;
          const pos = { lat: coordinate.latitude, lng: coordinate.longitude };
          onMapClick?.(pos);
        }}
        onLongPress={(e: any) => {
          const { coordinate } = e.nativeEvent;
          const pos = { lat: coordinate.latitude, lng: coordinate.longitude };
          if (onPickupSelect && !pickupLocation) {
            onPickupSelect(pos);
          } else if (onDropoffSelect) {
            onDropoffSelect(pos);
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

        {/* Selected Pin */}
        {selectedPin && (
          <Marker
            coordinate={{ latitude: selectedPin.lat, longitude: selectedPin.lng }}
            anchor={{ x: 0.5, y: 1 }}
          >
            <SelectedPin />
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

        {/* Route casing */}
        {routeCoordinates.length > 1 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor="#0F172A"
            strokeWidth={9}
          />
        )}

        {/* Route line */}
        {routeCoordinates.length > 1 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor={routeColor ?? mapTheme.accent}
            strokeWidth={5}
          />
        )}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { height: 300, borderRadius: 16, overflow: "hidden" },
  map: { flex: 1 },
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
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 7,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    marginTop: -1,
  },
  driverMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#1E293B",
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.6,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 8,
  },
});
