import React, { useEffect, useRef, useState, useCallback } from "react";
import { View, TouchableOpacity, Text, StyleSheet, Platform } from "react-native";
import maplibregl, { Map, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Ionicons } from "@expo/vector-icons";
import { RideMapProps, MapStyleTheme } from "./RideMap.types";
import { IS_DRIVER_APP } from "@/constants/app-variant";
import { driverTheme, riderTheme } from "@/constants/design-system";
import { trpc } from "@/lib/trpc";
import type { LatLng } from "@/lib/maps/map-types";

const DEFAULT_CENTER = { lat: -15.4167, lng: 28.2833 }; // Lusaka center default (or Mansa -11.197, 28.891)

// --- Map Styles ---
const MAP_STYLES: Record<MapStyleTheme, string> = {
  streets: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  light: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
};

// --- Source/Layer IDs ---
const ROUTE_CASING_LAYER = "route-casing";
const ROUTE_LINE_LAYER = "route-line";
const ROUTE_SOURCE = "route-source";

// --- Custom Marker Builders ---
function makePulsingDot(color: string): HTMLElement {
  const wrap = document.createElement("div");
  wrap.style.cssText = `position:relative;width:22px;height:22px;cursor:pointer;`;

  const ring = document.createElement("div");
  ring.style.cssText = `
    position:absolute;inset:-8px;border-radius:50%;
    border:2.5px solid ${color};
    animation:pulse-ring 2s ease-out infinite;
    opacity:0.7;
  `;

  const dot = document.createElement("div");
  dot.style.cssText = `
    position:absolute;inset:0;border-radius:50%;
    background:${color};border:3px solid #ffffff;
    box-shadow:0 3px 12px ${color}99;
  `;

  if (!document.getElementById("map-pulse-keyframes")) {
    const style = document.createElement("style");
    style.id = "map-pulse-keyframes";
    style.textContent = `
      @keyframes pulse-ring {
        0%   { transform:scale(0.7); opacity:0.8; }
        70%  { transform:scale(2.4); opacity:0; }
        100% { transform:scale(2.4); opacity:0; }
      }
      @keyframes pin-bounce {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-6px); }
      }
    `;
    document.head.appendChild(style);
  }

  wrap.appendChild(ring);
  wrap.appendChild(dot);
  return wrap;
}

function makePickupMarker(): HTMLElement {
  const wrap = document.createElement("div");
  wrap.style.cssText = `
    display:flex;flex-direction:column;align-items:center;cursor:pointer;
    filter:drop-shadow(0 6px 12px rgba(0,0,0,0.35));
    animation: pin-bounce 2s ease-in-out infinite;
  `;
  wrap.innerHTML = `
    <div style="background:#16A34A;color:#FFF;font-size:11px;font-weight:800;padding:2px 8px;border-radius:12px;border:1.5px solid #FFF;white-space:nowrap;margin-bottom:2px;box-shadow:0 2px 6px rgba(0,0,0,0.2);">
      PICKUP
    </div>
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2Z" fill="#16A34A" stroke="#FFFFFF" stroke-width="2"/>
      <circle cx="12" cy="9" r="3.5" fill="#FFFFFF"/>
    </svg>
  `;
  return wrap;
}

function makeDropoffMarker(): HTMLElement {
  const wrap = document.createElement("div");
  wrap.style.cssText = `
    display:flex;flex-direction:column;align-items:center;cursor:pointer;
    filter:drop-shadow(0 6px 12px rgba(0,0,0,0.35));
    animation: pin-bounce 2s ease-in-out infinite;
  `;
  wrap.innerHTML = `
    <div style="background:#EA580C;color:#FFF;font-size:11px;font-weight:800;padding:2px 8px;border-radius:12px;border:1.5px solid #FFF;white-space:nowrap;margin-bottom:2px;box-shadow:0 2px 6px rgba(0,0,0,0.2);">
      DESTINATION
    </div>
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2Z" fill="#EA580C" stroke="#FFFFFF" stroke-width="2"/>
      <circle cx="12" cy="9" r="3.5" fill="#FFFFFF"/>
    </svg>
  `;
  return wrap;
}

function makeSelectedPinMarker(): HTMLElement {
  const wrap = document.createElement("div");
  wrap.style.cssText = `
    display:flex;flex-direction:column;align-items:center;cursor:pointer;
    filter:drop-shadow(0 6px 14px rgba(79,70,229,0.45));
    animation: pin-bounce 1.5s ease-in-out infinite;
  `;
  wrap.innerHTML = `
    <div style="background:#4F46E5;color:#FFF;font-size:11px;font-weight:800;padding:2px 8px;border-radius:12px;border:1.5px solid #FFF;white-space:nowrap;margin-bottom:2px;">
      SELECTED
    </div>
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2Z" fill="#4F46E5" stroke="#FFFFFF" stroke-width="2"/>
      <circle cx="12" cy="9" r="3.5" fill="#FFFFFF"/>
    </svg>
  `;
  return wrap;
}

function makeVehicleMarker(color: string, heading?: number | null): HTMLElement {
  const wrap = document.createElement("div");
  wrap.style.cssText = `
    width:38px;height:38px;border-radius:50%;
    background:#0F172A;border:2.5px solid ${color};
    display:flex;align-items:center;justify-content:center;
    box-shadow:0 0 0 4px ${color}35, 0 6px 16px rgba(0,0,0,0.5);
    transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
    cursor:pointer;
  `;
  wrap.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="${color}" xmlns="http://www.w3.org/2000/svg">
    <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5H6.5C5.84 5 5.28 5.42 5.08 6.01L3 12V20C3 20.55 3.45 21 4 21H5C5.55 21 6 20.55 6 20V19H18V20C18 20.55 18.45 21 19 21H20C20.55 21 21 20.55 21 20V12L18.92 6.01ZM6.85 7H17.14L18.22 10H5.78L6.85 7ZM19 17H5V12H19V17Z" />
    <circle cx="7.5" cy="14.5" r="1.5" fill="#0F172A"/>
    <circle cx="16.5" cy="14.5" r="1.5" fill="#0F172A"/>
  </svg>`;
  if (typeof heading === "number" && Number.isFinite(heading)) {
    wrap.style.transform = `rotate(${heading}deg)`;
  }
  return wrap;
}

export function RideMap({
  userLocation,
  pickupLocation,
  dropoffLocation,
  selectedPin: externalSelectedPin,
  routePolyline,
  routeColor,
  nearbyDrivers = [],
  hotspots = [],
  onPickupSelect,
  onDropoffSelect,
  onMapClick,
  interactivePlaceSelection = true,
  showControls = true,
  initialStyle = "streets",
  style,
}: RideMapProps) {
  const mapTheme = IS_DRIVER_APP ? driverTheme : riderTheme;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const trpcUtils = trpc.useUtils();

  const [currentStyleTheme, setCurrentStyleTheme] = useState<MapStyleTheme>(initialStyle);
  const [selectedLocation, setSelectedLocation] = useState<LatLng | null>(externalSelectedPin ?? null);
  const [selectedAddress, setSelectedAddress] = useState<string>("");
  const [isResolvingAddress, setIsResolvingAddress] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  // Sync external selected pin
  useEffect(() => {
    if (externalSelectedPin !== undefined) {
      setSelectedLocation(externalSelectedPin);
    }
  }, [externalSelectedPin]);

  // Reverse geocode when selectedLocation changes
  useEffect(() => {
    if (!selectedLocation) {
      setSelectedAddress("");
      return;
    }

    let isMounted = true;
    setIsResolvingAddress(true);

    const fetchAddress = async () => {
      try {
        const response = await trpcUtils.maps.reverseGeocode.fetch({
          lat: selectedLocation.lat,
          lng: selectedLocation.lng,
        });
        if (isMounted) {
          setSelectedAddress(response.address || `${selectedLocation.lat.toFixed(4)}, ${selectedLocation.lng.toFixed(4)}`);
        }
      } catch {
        if (isMounted) {
          setSelectedAddress(`${selectedLocation.lat.toFixed(4)}, ${selectedLocation.lng.toFixed(4)}`);
        }
      } finally {
        if (isMounted) {
          setIsResolvingAddress(false);
        }
      }
    };

    void fetchAddress();
    return () => {
      isMounted = false;
    };
  }, [selectedLocation, trpcUtils]);

  // --- Initialize Map ---
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const initialCenter = userLocation ?? pickupLocation ?? selectedLocation ?? DEFAULT_CENTER;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLES[currentStyleTheme],
      center: [initialCenter.lng, initialCenter.lat],
      zoom: 14.5,
      attributionControl: { compact: true },
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true, showZoom: true }), "top-right");

    map.on("click", (event) => {
      const clickedPos: LatLng = { lat: event.lngLat.lat, lng: event.lngLat.lng };
      onMapClick?.(clickedPos);

      if (interactivePlaceSelection) {
        setSelectedLocation(clickedPos);
      }
    });

    mapRef.current = map;

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Switch Map Style ---
  const handleToggleStyle = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    const nextStyle: MapStyleTheme =
      currentStyleTheme === "streets" ? "dark" : currentStyleTheme === "dark" ? "light" : "streets";

    setCurrentStyleTheme(nextStyle);
    map.setStyle(MAP_STYLES[nextStyle]);
  }, [currentStyleTheme]);

  // --- Center on User Location ---
  const handleLocateUser = useCallback(() => {
    const map = mapRef.current;
    if (!map || !userLocation) return;
    map.flyTo({
      center: [userLocation.lng, userLocation.lat],
      zoom: 15.5,
      essential: true,
      duration: 1000,
    });
  }, [userLocation]);

  // --- Update Markers & Route ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const render = () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      const boundsPoints: [number, number][] = [];

      // User location pulsing marker
      if (userLocation) {
        markersRef.current.push(
          new maplibregl.Marker({ element: makePulsingDot("#3B82F6"), anchor: "center" })
            .setLngLat([userLocation.lng, userLocation.lat])
            .addTo(map),
        );
        boundsPoints.push([userLocation.lng, userLocation.lat]);
      }

      // Pickup marker
      if (pickupLocation) {
        markersRef.current.push(
          new maplibregl.Marker({ element: makePickupMarker(), anchor: "bottom" })
            .setLngLat([pickupLocation.lng, pickupLocation.lat])
            .addTo(map),
        );
        boundsPoints.push([pickupLocation.lng, pickupLocation.lat]);
      }

      // Dropoff marker
      if (dropoffLocation) {
        markersRef.current.push(
          new maplibregl.Marker({ element: makeDropoffMarker(), anchor: "bottom" })
            .setLngLat([dropoffLocation.lng, dropoffLocation.lat])
            .addTo(map),
        );
        boundsPoints.push([dropoffLocation.lng, dropoffLocation.lat]);
      }

      // Selected Pin (if different from pickup/dropoff)
      if (
        selectedLocation &&
        (!pickupLocation || selectedLocation.lat !== pickupLocation.lat || selectedLocation.lng !== pickupLocation.lng) &&
        (!dropoffLocation || selectedLocation.lat !== dropoffLocation.lat || selectedLocation.lng !== dropoffLocation.lng)
      ) {
        markersRef.current.push(
          new maplibregl.Marker({ element: makeSelectedPinMarker(), anchor: "bottom" })
            .setLngLat([selectedLocation.lng, selectedLocation.lat])
            .addTo(map),
        );
        boundsPoints.push([selectedLocation.lng, selectedLocation.lat]);
      }

      // Nearby drivers
      nearbyDrivers.forEach((driver) => {
        markersRef.current.push(
          new maplibregl.Marker({ element: makeVehicleMarker(mapTheme.mapDriver, driver.heading), anchor: "center" })
            .setLngLat([driver.lng, driver.lat])
            .addTo(map),
        );
        boundsPoints.push([driver.lng, driver.lat]);
      });

      // Route line
      [ROUTE_CASING_LAYER, ROUTE_LINE_LAYER].forEach((id) => {
        if (map.getLayer(id)) map.removeLayer(id);
      });
      if (map.getSource(ROUTE_SOURCE)) map.removeSource(ROUTE_SOURCE);

      const routeCoords: [number, number][] = routePolyline
        ? decodePolyline(routePolyline).map((p) => [p.lng, p.lat])
        : pickupLocation && dropoffLocation
        ? [
            [pickupLocation.lng, pickupLocation.lat],
            [dropoffLocation.lng, dropoffLocation.lat],
          ]
        : [];

      if (routeCoords.length > 1) {
        map.addSource(ROUTE_SOURCE, {
          type: "geojson",
          data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: routeCoords } },
        });

        map.addLayer({
          id: ROUTE_CASING_LAYER,
          type: "line",
          source: ROUTE_SOURCE,
          paint: {
            "line-color": currentStyleTheme === "dark" ? "#0F172A" : "#FFFFFF",
            "line-width": 8,
            "line-opacity": 0.9,
          },
          layout: { "line-join": "round", "line-cap": "round" },
        });

        map.addLayer({
          id: ROUTE_LINE_LAYER,
          type: "line",
          source: ROUTE_SOURCE,
          paint: {
            "line-color": routeColor ?? (currentStyleTheme === "dark" ? "#38BDF8" : "#2563EB"),
            "line-width": 5,
            "line-opacity": 1,
          },
          layout: { "line-join": "round", "line-cap": "round" },
        });

        routeCoords.forEach((c) => boundsPoints.push([c[0], c[1]]));
      }

      // Hotspots
      const HOTSPOTS_SOURCE = "hotspots-source";
      const HOTSPOTS_FILL = "hotspots-fill";
      const HOTSPOTS_OUTLINE = "hotspots-outline";
      [HOTSPOTS_FILL, HOTSPOTS_OUTLINE].forEach((id) => {
        if (map.getLayer(id)) map.removeLayer(id);
      });
      if (map.getSource(HOTSPOTS_SOURCE)) map.removeSource(HOTSPOTS_SOURCE);

      if (hotspots && hotspots.length > 0) {
        const features = hotspots.map((h) => ({
          type: "Feature",
          properties: { color: h.color || "#EF4444" },
          geometry: { type: "Point", coordinates: [h.lng, h.lat] },
        }));
        map.addSource(HOTSPOTS_SOURCE, {
          type: "geojson",
          data: { type: "FeatureCollection", features } as any,
        });
        map.addLayer({
          id: HOTSPOTS_FILL,
          type: "circle",
          source: HOTSPOTS_SOURCE,
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 20, 15, 80],
            "circle-color": ["get", "color"],
            "circle-opacity": 0.25,
            "circle-blur": 0.4,
          },
        });
        map.addLayer({
          id: HOTSPOTS_OUTLINE,
          type: "circle",
          source: HOTSPOTS_SOURCE,
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 20, 15, 80],
            "circle-color": ["get", "color"],
            "circle-opacity": 0.8,
            "circle-stroke-width": 1.5,
            "circle-stroke-color": ["get", "color"],
          },
        });
      }

      // Auto fit bounds
      if (boundsPoints.length > 1) {
        const bounds = boundsPoints.reduce(
          (acc, pt) => acc.extend(pt),
          new maplibregl.LngLatBounds(boundsPoints[0], boundsPoints[0]),
        );
        map.fitBounds(bounds, { padding: { top: 70, bottom: 80, left: 50, right: 50 }, duration: 600, maxZoom: 15.5 });
      } else if (boundsPoints.length === 1) {
        map.easeTo({ center: boundsPoints[0], zoom: 15, duration: 400 });
      }
    };

    if (map.isStyleLoaded()) render();
    else map.once("load", render);
  }, [
    userLocation,
    pickupLocation,
    dropoffLocation,
    selectedLocation,
    routePolyline,
    routeColor,
    nearbyDrivers,
    hotspots,
    currentStyleTheme,
    mapTheme.mapDriver,
  ]);

  const mapHeight = isExpanded ? 520 : (style?.height ?? 340);

  return (
    <View style={[{ height: mapHeight, position: "relative", borderRadius: 16, overflow: "hidden" }, style]}>
      {/* Map Container */}
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

      {/* Floating Map Controls */}
      {showControls && (
        <View style={styles.controlsContainer}>
          {/* Style Switcher */}
          <TouchableOpacity
            onPress={handleToggleStyle}
            style={styles.controlButton}
            activeOpacity={0.8}
          >
            <Ionicons
              name={currentStyleTheme === "streets" ? "map" : currentStyleTheme === "dark" ? "moon" : "sunny"}
              size={18}
              color="#0F172A"
            />
            <Text style={styles.controlText}>
              {currentStyleTheme === "streets" ? "Streets" : currentStyleTheme === "dark" ? "Night" : "Light"}
            </Text>
          </TouchableOpacity>

          {/* Locate Me */}
          {userLocation && (
            <TouchableOpacity
              onPress={handleLocateUser}
              style={[styles.controlButton, { paddingHorizontal: 10 }]}
              activeOpacity={0.8}
            >
              <Ionicons name="navigate-circle" size={20} color="#2563EB" />
            </TouchableOpacity>
          )}

          {/* Expand / Minimize Map */}
          <TouchableOpacity
            onPress={() => setIsExpanded((prev) => !prev)}
            style={[styles.controlButton, { paddingHorizontal: 10 }]}
            activeOpacity={0.8}
          >
            <Ionicons name={isExpanded ? "contract" : "expand"} size={18} color="#0F172A" />
          </TouchableOpacity>
        </View>
      )}

      {/* Interactive Place Selection Floating Popup */}
      {selectedLocation && interactivePlaceSelection && (
        <View style={styles.placePopup}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Ionicons name="location" size={16} color="#4F46E5" />
              <Text style={styles.placeTitle}>Selected Location</Text>
            </View>
            <Text style={styles.placeAddress} numberOfLines={2}>
              {isResolvingAddress ? "Resolving address..." : selectedAddress || `${selectedLocation.lat.toFixed(4)}, ${selectedLocation.lng.toFixed(4)}`}
            </Text>
          </View>

          <View style={styles.popupActions}>
            {onPickupSelect && (
              <TouchableOpacity
                onPress={() => {
                  onPickupSelect(selectedLocation);
                  setSelectedLocation(null);
                }}
                style={[styles.actionButton, { backgroundColor: "#16A34A" }]}
                activeOpacity={0.8}
              >
                <Text style={styles.actionButtonText}>Set Pickup</Text>
              </TouchableOpacity>
            )}

            {onDropoffSelect && (
              <TouchableOpacity
                onPress={() => {
                  onDropoffSelect(selectedLocation);
                  setSelectedLocation(null);
                }}
                style={[styles.actionButton, { backgroundColor: "#EA580C" }]}
                activeOpacity={0.8}
              >
                <Text style={styles.actionButtonText}>Set Dest</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={() => setSelectedLocation(null)}
              style={styles.closeButton}
              activeOpacity={0.8}
            >
              <Ionicons name="close" size={16} color="#64748B" />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  controlsContainer: {
    position: "absolute",
    top: 12,
    left: 12,
    flexDirection: "row",
    gap: 8,
    zIndex: 20,
  },
  controlButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255, 255, 255, 0.94)",
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.8)",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  controlText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0F172A",
  },
  placePopup: {
    position: "absolute",
    bottom: 12,
    left: 12,
    right: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    zIndex: 30,
  },
  placeTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#4F46E5",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  placeAddress: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1E293B",
    marginTop: 2,
  },
  popupActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  actionButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  closeButton: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    marginLeft: 2,
  },
});

// Polyline decoder helper
function decodePolyline(encoded: string): { lat: number; lng: number }[] {
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
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}
