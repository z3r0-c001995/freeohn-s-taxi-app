import React, { useEffect, useRef } from "react";
import { View } from "react-native";
import maplibregl, { Map, Marker, type StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { RideMapProps } from "./RideMap.types";
import { IS_DRIVER_APP } from "@/constants/app-variant";
import { driverTheme, riderTheme } from "@/constants/design-system";

const DEFAULT_CENTER = { lat: -11.197, lng: 28.891 }; // Mansa

// --- Map Styles ---
const MAP_STYLE_URL = process.env.EXPO_PUBLIC_MAP_STYLE_URL?.trim();

// Premium dark vector style
const DARK_VECTOR_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

// Driver app uses dark mode always; seeker app uses dark mode too for premium feel
const PREFERRED_STYLE = DARK_VECTOR_STYLE;

// Fallback is also the exact same vector style URL to ensure we stay on premium tiles
const RASTER_FALLBACK = DARK_VECTOR_STYLE;

// --- Source/Layer IDs ---
const ROUTE_CASING_LAYER = "route-casing";
const ROUTE_LINE_LAYER = "route-line";
const ROUTE_SOURCE = "route-source";

// --- Marker Factories ---
function makePulsingDot(color: string): HTMLElement {
  const wrap = document.createElement("div");
  wrap.style.cssText = `position:relative;width:18px;height:18px;`;

  const ring = document.createElement("div");
  ring.style.cssText = `
    position:absolute;inset:-6px;border-radius:50%;
    border:2px solid ${color};
    animation:pulse-ring 1.8s ease-out infinite;
    opacity:0.6;
  `;

  const dot = document.createElement("div");
  dot.style.cssText = `
    position:absolute;inset:0;border-radius:50%;
    background:${color};border:2px solid #ffffff;
    box-shadow:0 2px 8px ${color}80;
  `;

  // Inject keyframes once
  if (!document.getElementById("map-pulse-keyframes")) {
    const style = document.createElement("style");
    style.id = "map-pulse-keyframes";
    style.textContent = `
      @keyframes pulse-ring {
        0%   { transform:scale(0.8); opacity:0.7; }
        70%  { transform:scale(2.2); opacity:0; }
        100% { transform:scale(2.2); opacity:0; }
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
  wrap.style.cssText = `width:32px;height:32px;filter:drop-shadow(0 4px 6px rgba(0,0,0,0.3));display:flex;align-items:center;justify-content:center;cursor:default;`;
  wrap.innerHTML = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2Z" fill="#22C55E" stroke="#FFFFFF" stroke-width="2"/>
    <circle cx="12" cy="9" r="3" fill="#FFFFFF"/>
  </svg>`;
  return wrap;
}

function makeDropoffMarker(): HTMLElement {
  const wrap = document.createElement("div");
  wrap.style.cssText = `width:32px;height:32px;filter:drop-shadow(0 4px 6px rgba(0,0,0,0.3));display:flex;align-items:center;justify-content:center;cursor:default;`;
  wrap.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2L22 12L12 22L2 12L12 2Z" fill="#F97316" stroke="#FFFFFF" stroke-width="2"/>
    <circle cx="12" cy="12" r="3" fill="#FFFFFF"/>
  </svg>`;
  return wrap;
}

function makeVehicleMarker(color: string, heading?: number | null): HTMLElement {
  const wrap = document.createElement("div");
  wrap.style.cssText = `
    width:36px;height:36px;border-radius:50%;
    background:#1E293B;border:2px solid ${color};
    display:flex;align-items:center;justify-content:center;
    box-shadow:0 0 0 4px ${color}30, 0 6px 16px rgba(0,0,0,0.6);
    transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
  `;
  wrap.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="${color}" xmlns="http://www.w3.org/2000/svg">
    <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5H6.5C5.84 5 5.28 5.42 5.08 6.01L3 12V20C3 20.55 3.45 21 4 21H5C5.55 21 6 20.55 6 20V19H18V20C18 20.55 18.45 21 19 21H20C20.55 21 21 20.55 21 20V12L18.92 6.01ZM6.85 7H17.14L18.22 10H5.78L6.85 7ZM19 17H5V12H19V17Z" />
    <circle cx="7.5" cy="14.5" r="1.5" fill="#1E293B"/>
    <circle cx="16.5" cy="14.5" r="1.5" fill="#1E293B"/>
  </svg>`;
  if (typeof heading === "number" && Number.isFinite(heading)) {
    wrap.style.transform = `rotate(${heading}deg)`;
  }
  return wrap;
}

// --- Component ---
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
}: RideMapProps) {
  const mapTheme = IS_DRIVER_APP ? driverTheme : riderTheme;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const fallbackAppliedRef = useRef(false);
  const onPickupSelectRef = useRef(onPickupSelect);
  const onDropoffSelectRef = useRef(onDropoffSelect);
  const pickupLocationRef = useRef(pickupLocation);

  useEffect(() => {
    onPickupSelectRef.current = onPickupSelect;
    onDropoffSelectRef.current = onDropoffSelect;
    pickupLocationRef.current = pickupLocation;
  }, [onDropoffSelect, onPickupSelect, pickupLocation]);

  // --- Init map once ---
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const center = userLocation ?? pickupLocation ?? DEFAULT_CENTER;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE_URL || PREFERRED_STYLE,
      center: [center.lng, center.lat],
      zoom: 14,
      attributionControl: { compact: true },
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true, showZoom: true }), "top-right");

    map.on("error", () => {
      if (!fallbackAppliedRef.current) {
        fallbackAppliedRef.current = true;
        map.setStyle(RASTER_FALLBACK);
      }
    });

    map.on("click", (event) => {
      const location = { lat: event.lngLat.lat, lng: event.lngLat.lng };
      if (onPickupSelectRef.current && !pickupLocationRef.current) {
        onPickupSelectRef.current(location);
      } else if (onDropoffSelectRef.current) {
        onDropoffSelectRef.current(location);
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

  // --- Update markers + route ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const render = () => {
      // Clear existing markers
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      const boundsPoints: [number, number][] = [];

      // User location — pulsing dot
      if (userLocation) {
        markersRef.current.push(
          new maplibregl.Marker({ element: makePulsingDot("#3B82F6"), anchor: "center" })
            .setLngLat([userLocation.lng, userLocation.lat])
            .addTo(map),
        );
        boundsPoints.push([userLocation.lng, userLocation.lat]);
      }

      // Pickup — Green Pin SVG
      if (pickupLocation) {
        markersRef.current.push(
          new maplibregl.Marker({ element: makePickupMarker(), anchor: "bottom" })
            .setLngLat([pickupLocation.lng, pickupLocation.lat])
            .addTo(map),
        );
        boundsPoints.push([pickupLocation.lng, pickupLocation.lat]);
      }

      // Dropoff — Orange Diamond SVG
      if (dropoffLocation) {
        markersRef.current.push(
          new maplibregl.Marker({ element: makeDropoffMarker(), anchor: "center" })
            .setLngLat([dropoffLocation.lng, dropoffLocation.lat])
            .addTo(map),
        );
        boundsPoints.push([dropoffLocation.lng, dropoffLocation.lat]);
      }

      // Driver markers
      nearbyDrivers.forEach((driver) => {
        markersRef.current.push(
          new maplibregl.Marker({ element: makeVehicleMarker(mapTheme.mapDriver, driver.heading), anchor: "center" })
            .setLngLat([driver.lng, driver.lat])
            .addTo(map),
        );
        boundsPoints.push([driver.lng, driver.lat]);
      });

      // --- Route line with casing ---
      [ROUTE_CASING_LAYER, ROUTE_LINE_LAYER].forEach((id) => { if (map.getLayer(id)) map.removeLayer(id); });
      if (map.getSource(ROUTE_SOURCE)) map.removeSource(ROUTE_SOURCE);

      const routeCoords: [number, number][] = routePolyline
        ? decodePolyline(routePolyline).map((p) => [p.lng, p.lat])
        : pickupLocation && dropoffLocation
        ? [[pickupLocation.lng, pickupLocation.lat], [dropoffLocation.lng, dropoffLocation.lat]]
        : [];

      if (routeCoords.length > 1) {
        map.addSource(ROUTE_SOURCE, {
          type: "geojson",
          data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: routeCoords } },
        });
        // Dark premium casing for dark map
        map.addLayer({
          id: ROUTE_CASING_LAYER, type: "line", source: ROUTE_SOURCE,
          paint: { "line-color": "#0F172A", "line-width": 9, "line-opacity": 0.8 },
          layout: { "line-join": "round", "line-cap": "round" },
        });
        // Colored line (on top)
        map.addLayer({
          id: ROUTE_LINE_LAYER, type: "line", source: ROUTE_SOURCE,
          paint: { "line-color": routeColor ?? mapTheme.accent, "line-width": 5, "line-opacity": 1 },
          layout: { "line-join": "round", "line-cap": "round" },
        });
        routeCoords.forEach((c) => boundsPoints.push([c[0], c[1]]));
      }

      // --- Hotspots GeoJSON ---
      const HOTSPOTS_SOURCE = "hotspots-source";
      const HOTSPOTS_FILL = "hotspots-fill";
      const HOTSPOTS_OUTLINE = "hotspots-outline";
      [HOTSPOTS_FILL, HOTSPOTS_OUTLINE].forEach(id => { if (map.getLayer(id)) map.removeLayer(id); });
      if (map.getSource(HOTSPOTS_SOURCE)) map.removeSource(HOTSPOTS_SOURCE);

      if (hotspots && hotspots.length > 0) {
        const features = hotspots.map(h => ({
          type: "Feature",
          properties: { color: h.color || "#EF4444" },
          geometry: { type: "Point", coordinates: [h.lng, h.lat] }
        }));
        map.addSource(HOTSPOTS_SOURCE, {
          type: "geojson",
          data: { type: "FeatureCollection", features } as any
        });
        map.addLayer({
          id: HOTSPOTS_FILL,
          type: "circle",
          source: HOTSPOTS_SOURCE,
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 20, 15, 80],
            "circle-color": ["get", "color"],
            "circle-opacity": 0.2,
            "circle-blur": 0.5
          }
        });
        map.addLayer({
          id: HOTSPOTS_OUTLINE,
          type: "circle",
          source: HOTSPOTS_SOURCE,
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 20, 15, 80],
            "circle-color": ["get", "color"],
            "circle-opacity": 0.8,
            "circle-stroke-width": 1,
            "circle-stroke-color": ["get", "color"]
          }
        });
      }

      // Fit bounds
      if (boundsPoints.length > 1) {
        const bounds = boundsPoints.reduce(
          (acc, pt) => acc.extend(pt),
          new maplibregl.LngLatBounds(boundsPoints[0], boundsPoints[0]),
        );
        map.fitBounds(bounds, { padding: { top: 80, bottom: 60, left: 50, right: 50 }, duration: 600, maxZoom: 15 });
      } else if (boundsPoints.length === 1) {
        map.easeTo({ center: boundsPoints[0], zoom: 15, duration: 400 });
      }
    };

    if (map.isStyleLoaded()) render();
    else map.once("load", render);
  }, [
    dropoffLocation, mapTheme.accent, mapTheme.mapDriver, mapTheme.mapDropoff,
    mapTheme.mapPickup, mapTheme.mapUser, nearbyDrivers, hotspots, pickupLocation,
    routeColor, routePolyline, userLocation,
  ]);

  return (
    <View style={[{ height: 300 }, style]}>
      <div ref={containerRef} style={{ width: "100%", height: "100%", borderRadius: 0, overflow: "hidden" }} />
    </View>
  );
}

// --- Polyline decoder ---
function decodePolyline(encoded: string): { lat: number; lng: number }[] {
  const points: { lat: number; lng: number }[] = [];
  let index = 0; let lat = 0; let lng = 0;
  while (index < encoded.length) {
    let shift = 0; let result = 0; let byte: number;
    do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0; result = 0;
    do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}
