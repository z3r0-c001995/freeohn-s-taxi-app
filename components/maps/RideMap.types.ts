import { LatLng } from "../../lib/google/google-types";

export interface RideMapProps {
  userLocation?: LatLng;
  pickupLocation?: LatLng;
  dropoffLocation?: LatLng;
  routePolyline?: string;
  nearbyDrivers?: LatLng[];
  onPickupSelect?: (location: LatLng) => void;
  onDropoffSelect?: (location: LatLng) => void;
  style?: any;
}
