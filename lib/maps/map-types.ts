export interface LatLng {
  lat: number;
  lng: number;
  heading?: number | null;
}

export interface NearbyDriverMarker extends LatLng {
  driverId?: string;
  distanceMeters?: number;
  etaSeconds?: number;
}

export interface PlaceAutocompletePrediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
  geometry: {
    location: LatLng;
  };
  formatted_address: string;
}

export interface PlaceDetails {
  place_id: string;
  geometry: {
    location: LatLng;
  };
  formatted_address: string;
}

export interface RouteStep {
  instructions: string;
  maneuver: string;
  distanceMeters: number;
  durationSeconds: number;
}

export interface RouteSummary {
  distanceMeters: number;
  durationSeconds: number;
  encodedPolyline: string;
  steps: RouteStep[];
}

export interface RouteRequest {
  origin: LatLng;
  destination: LatLng;
  travelMode: "DRIVE";
}

export interface RouteResponse {
  distanceMeters: number;
  durationSeconds: number;
  encodedPolyline: string;
  steps: RouteStep[];
}
