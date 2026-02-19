import React, { useMemo } from "react";
import { View, StyleSheet, Platform } from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { LatLng } from "../../lib/maps/map-types";
import { RideMapProps } from "./RideMap.types";
import { IS_DRIVER_APP } from "@/constants/app-variant";
import { driverTheme, riderTheme } from "@/constants/design-system";

const decodePolyline = (encoded: string): LatLng[] => {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({
      lat: lat / 1e5,
      lng: lng / 1e5,
    });
  }

  return points;
};

export function RideMap({
  userLocation,
  pickupLocation,
  dropoffLocation,
  routePolyline,
  nearbyDrivers = [],
  onPickupSelect,
  onDropoffSelect,
  style,
}: RideMapProps) {
  const mapTheme = IS_DRIVER_APP ? driverTheme : riderTheme;
  const polylinePoints = useMemo(() => (routePolyline ? decodePolyline(routePolyline) : []), [routePolyline]);
  const hasAndroidGoogleMapsKey = Boolean(process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY);
  const mapProvider =
    Platform.OS === "android" && hasAndroidGoogleMapsKey ? PROVIDER_GOOGLE : undefined;

  const defaultRegion = {
    latitude: userLocation?.lat ?? -1.2864,
    longitude: userLocation?.lng ?? 36.8172,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };

  return (
    <View style={[styles.wrapper, style]}>
      <MapView
        style={styles.map}
        provider={mapProvider}
        initialRegion={defaultRegion}
        showsUserLocation={!!userLocation}
        showsMyLocationButton
        onLongPress={(e: any) => {
          const { coordinate } = e.nativeEvent;
          if (onPickupSelect && !pickupLocation) {
            onPickupSelect({ lat: coordinate.latitude, lng: coordinate.longitude });
          } else if (onDropoffSelect) {
            onDropoffSelect({ lat: coordinate.latitude, lng: coordinate.longitude });
          }
        }}
      >
        {pickupLocation && (
          <Marker
            coordinate={{ latitude: pickupLocation.lat, longitude: pickupLocation.lng }}
            title="Pickup"
            pinColor={mapTheme.mapPickup}
          />
        )}
        {dropoffLocation && (
          <Marker
            coordinate={{ latitude: dropoffLocation.lat, longitude: dropoffLocation.lng }}
            title="Dropoff"
            pinColor={mapTheme.mapDropoff}
          />
        )}
        {nearbyDrivers.map((driver, index) => (
          <Marker
            key={`driver-${index}`}
            coordinate={{ latitude: driver.lat, longitude: driver.lng }}
            title="Driver"
            pinColor={mapTheme.mapDriver}
            rotation={typeof driver.heading === "number" ? driver.heading : 0}
          />
        ))}
        {polylinePoints.length > 0 && (
          <Polyline
            coordinates={polylinePoints.map((point) => ({
              latitude: point.lat,
              longitude: point.lng,
            }))}
            strokeColor={mapTheme.accent}
            strokeWidth={4}
          />
        )}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    height: 300,
  },
  map: {
    flex: 1,
  },
});
