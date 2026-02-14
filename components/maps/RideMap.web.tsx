import React, { useEffect, useRef } from "react";
import { View } from "react-native";
import { RideMapProps } from "./RideMap.types";

// Declare Google Maps types for web
declare global {
  interface Window {
    google: any;
  }
}

const loadGoogleMapsScript = (onLoad: () => void) => {
  if (window.google) {
    onLoad();
    return;
  }

  const script = document.createElement("script");
  script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=geometry`;
  script.async = true;
  script.defer = true;
  script.onload = onLoad;
  document.head.appendChild(script);
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
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    const initializeMap = () => {
      if (!mapRef.current || !window.google) return;

      const map = new window.google.maps.Map(mapRef.current, {
        center: userLocation ? { lat: userLocation.lat, lng: userLocation.lng } : { lat: -1.2864, lng: 36.8172 },
        zoom: 15,
        mapTypeId: window.google.maps.MapTypeId.ROADMAP,
      });

      const addMarker = (position: { lat: number; lng: number }, options: any = {}) => {
        new window.google.maps.Marker({
          position,
          map,
          ...options,
        });
      };

      if (userLocation) {
        addMarker(
          { lat: userLocation.lat, lng: userLocation.lng },
          {
            title: "Your Location",
            icon: {
              url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="8" fill="#3B82F6"/>
                  <circle cx="12" cy="12" r="3" fill="white"/>
                </svg>
              `),
              scaledSize: new window.google.maps.Size(24, 24),
            },
          }
        );
      }

      if (pickupLocation) {
        addMarker(
          { lat: pickupLocation.lat, lng: pickupLocation.lng },
          {
            title: "Pickup Location",
            icon: {
              url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#10B981"/>
                </svg>
              `),
              scaledSize: new window.google.maps.Size(24, 24),
            },
          }
        );
      }

      if (dropoffLocation) {
        addMarker(
          { lat: dropoffLocation.lat, lng: dropoffLocation.lng },
          {
            title: "Dropoff Location",
            icon: {
              url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#EF4444"/>
                </svg>
              `),
              scaledSize: new window.google.maps.Size(24, 24),
            },
          }
        );
      }

      nearbyDrivers.forEach((driver) => {
        addMarker(
          { lat: driver.lat, lng: driver.lng },
          {
            title: "Driver",
            icon: {
              url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="8" fill="#2563EB"/>
                </svg>
              `),
              scaledSize: new window.google.maps.Size(24, 24),
            },
          }
        );
      });

      if (routePolyline) {
        const decodedPath = window.google.maps.geometry.encoding.decodePath(routePolyline);
        new window.google.maps.Polyline({
          path: decodedPath,
          geodesic: true,
          strokeColor: "#3B82F6",
          strokeOpacity: 1.0,
          strokeWeight: 3,
          map,
        });
      }

      map.addListener("click", (event: any) => {
        const latLng = {
          lat: event.latLng.lat(),
          lng: event.latLng.lng(),
        };
        if (onPickupSelect && !pickupLocation) {
          onPickupSelect(latLng);
        } else if (onDropoffSelect) {
          onDropoffSelect(latLng);
        }
      });
    };

    loadGoogleMapsScript(initializeMap);
  }, [userLocation, pickupLocation, dropoffLocation, routePolyline, nearbyDrivers, onPickupSelect, onDropoffSelect]);

  return (
    <View style={[{ height: 300 }, style]}>
      <div
        ref={mapRef}
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: "#f0f0f0",
          borderRadius: 8,
        }}
      />
    </View>
  );
}
