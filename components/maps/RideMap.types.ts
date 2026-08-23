import { LatLng, NearbyDriverMarker } from "../../lib/maps/map-types";

export type MapStyleTheme = "streets" | "dark" | "light";

export interface RideMapProps {
  userLocation?: LatLng;
  pickupLocation?: LatLng;
  dropoffLocation?: LatLng;
  selectedPin?: LatLng | null;
  routePolyline?: string;
  routeColor?: string;
  nearbyDrivers?: NearbyDriverMarker[];
  hotspots?: { lat: number; lng: number; radius?: number; color?: string }[];
  onPickupSelect?: (location: LatLng) => void;
  onDropoffSelect?: (location: LatLng) => void;
  onMapClick?: (location: LatLng) => void;
  interactivePlaceSelection?: boolean;
  showControls?: boolean;
  initialStyle?: MapStyleTheme;
  style?: any;
  mapRef?: any;
}
