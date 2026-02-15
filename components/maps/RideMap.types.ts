import { LatLng, NearbyDriverMarker } from "../../lib/maps/map-types";

export interface RideMapProps {
  userLocation?: LatLng;
  pickupLocation?: LatLng;
  dropoffLocation?: LatLng;
  routePolyline?: string;
  nearbyDrivers?: NearbyDriverMarker[];
  onPickupSelect?: (location: LatLng) => void;
  onDropoffSelect?: (location: LatLng) => void;
  style?: any;
}
