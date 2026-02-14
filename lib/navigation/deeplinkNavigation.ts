import { Linking, Platform } from "react-native";

export function openExternalNavigation(destination: { lat: number; lng: number }, origin?: { lat: number; lng: number }) {
  const { lat, lng } = destination;
  let url: string;

  if (Platform.OS === "android") {
    // Use Google Maps deep link for Android
    url = `google.navigation:q=${lat},${lng}`;
    if (origin) {
      url += `&origin=${origin.lat},${origin.lng}`;
    }
  } else if (Platform.OS === "ios") {
    // Use Apple Maps URL scheme for iOS
    url = `http://maps.apple.com/?daddr=${lat},${lng}`;
    if (origin) {
      url += `&saddr=${origin.lat},${origin.lng}`;
    }
  } else {
    // Fallback for web or other platforms - open in browser
    url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    if (origin) {
      url += `&origin=${origin.lat},${origin.lng}`;
    }
  }

  Linking.openURL(url).catch((err) => {
    console.error("Failed to open navigation app:", err);
    // Fallback to web maps
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`);
  });
}