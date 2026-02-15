import React, { useEffect, useRef } from "react";
import { View } from "react-native";
import maplibregl, { Map, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { RideMapProps } from "./RideMap.types";

const DEFAULT_CENTER = { lat: -15.4162, lng: 28.3115 }; // Lusaka default
const MAP_STYLE_URL = process.env.EXPO_PUBLIC_MAP_STYLE_URL || "https://demotiles.maplibre.org/style.json";

const ROUTE_SOURCE_ID = "trip-route-source";
const ROUTE_LAYER_ID = "trip-route-layer";

const decodePolyline = (encoded: string): { lat: number; lng: number }[] => {
  const points: { lat: number; lng: number }[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += deltaLat;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += deltaLng;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }

  return points;
};

function createMarker(color: string, heading?: number | null): HTMLElement {
  const marker = document.createElement("div");
  marker.style.width = "14px";
  marker.style.height = "14px";
  marker.style.borderRadius = "9999px";
  marker.style.background = color;
  marker.style.border = "2px solid #ffffff";
  marker.style.boxShadow = "0 0 0 1px rgba(0,0,0,0.15)";
  if (typeof heading === "number" && Number.isFinite(heading)) {
    marker.style.transform = `rotate(${heading}deg)`;
  }
  return marker;
}

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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const markersRef = useRef<Marker[]>([]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const center = userLocation ?? pickupLocation ?? DEFAULT_CENTER;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE_URL,
      center: [center.lng, center.lat],
      zoom: 13,
      attributionControl: {},
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: true, showZoom: true }), "top-right");

    map.on("click", (event) => {
      const location = { lat: event.lngLat.lat, lng: event.lngLat.lng };
      if (onPickupSelect && !pickupLocation) {
        onPickupSelect(location);
      } else if (onDropoffSelect) {
        onDropoffSelect(location);
      }
    });

    mapRef.current = map;

    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, [onDropoffSelect, onPickupSelect, pickupLocation, userLocation]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const render = () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];

      const boundsPoints: [number, number][] = [];

      if (userLocation) {
        markersRef.current.push(
          new maplibregl.Marker({ element: createMarker("#1d4ed8") })
            .setLngLat([userLocation.lng, userLocation.lat])
            .addTo(map),
        );
        boundsPoints.push([userLocation.lng, userLocation.lat]);
      }

      if (pickupLocation) {
        markersRef.current.push(
          new maplibregl.Marker({ element: createMarker("#16a34a") })
            .setLngLat([pickupLocation.lng, pickupLocation.lat])
            .addTo(map),
        );
        boundsPoints.push([pickupLocation.lng, pickupLocation.lat]);
      }

      if (dropoffLocation) {
        markersRef.current.push(
          new maplibregl.Marker({ element: createMarker("#dc2626") })
            .setLngLat([dropoffLocation.lng, dropoffLocation.lat])
            .addTo(map),
        );
        boundsPoints.push([dropoffLocation.lng, dropoffLocation.lat]);
      }

      nearbyDrivers.forEach((driver) => {
        markersRef.current.push(
          new maplibregl.Marker({ element: createMarker("#2563eb", driver.heading) })
            .setLngLat([driver.lng, driver.lat])
            .addTo(map),
        );
        boundsPoints.push([driver.lng, driver.lat]);
      });

      if (map.getLayer(ROUTE_LAYER_ID)) {
        map.removeLayer(ROUTE_LAYER_ID);
      }
      if (map.getSource(ROUTE_SOURCE_ID)) {
        map.removeSource(ROUTE_SOURCE_ID);
      }

      if (routePolyline) {
        const points = decodePolyline(routePolyline);
        if (points.length > 1) {
          const routeCoordinates = points.map((point) => [point.lng, point.lat]);
          map.addSource(ROUTE_SOURCE_ID, {
            type: "geojson",
            data: {
              type: "Feature",
              properties: {},
              geometry: {
                type: "LineString",
                coordinates: routeCoordinates,
              },
            },
          });
          map.addLayer({
            id: ROUTE_LAYER_ID,
            type: "line",
            source: ROUTE_SOURCE_ID,
            paint: {
              "line-color": "#2563eb",
              "line-width": 4,
            },
          });
          routeCoordinates.forEach((coord) => boundsPoints.push([coord[0], coord[1]]));
        }
      }

      if (boundsPoints.length > 1) {
        const bounds = boundsPoints.reduce(
          (acc, point) => acc.extend(point),
          new maplibregl.LngLatBounds(boundsPoints[0], boundsPoints[0]),
        );
        map.fitBounds(bounds, { padding: 40, duration: 500 });
      } else if (boundsPoints.length === 1) {
        map.easeTo({ center: boundsPoints[0], zoom: 14, duration: 300 });
      }
    };

    if (map.isStyleLoaded()) {
      render();
    } else {
      map.once("load", render);
    }
  }, [dropoffLocation, nearbyDrivers, pickupLocation, routePolyline, userLocation]);

  return (
    <View style={[{ height: 300 }, style]}>
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: "100%",
          borderRadius: 8,
          overflow: "hidden",
        }}
      />
    </View>
  );
}
