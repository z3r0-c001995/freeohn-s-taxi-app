import { Platform } from "react-native";
import { apiCall } from "./_core/api";
import { getApiBaseUrl } from "@/constants/oauth";
import type {
  CreateTripRequest,
  DriverLocationRequest,
  DriverStatusRequest,
  FareEstimateRequest,
  NearbyDriversRequest,
  TripRatingRequest,
  TripStartRequest,
} from "@/shared/ride-hailing";

const withCacheBuster = (endpoint: string): string => {
  if (Platform.OS !== "web") return endpoint;
  const separator = endpoint.includes("?") ? "&" : "?";
  return `${endpoint}${separator}t=${Date.now()}`;
};

export async function requestOtp(phone: string) {
  return apiCall<any>("/api/auth/send-otp", {
    method: "POST",
    body: JSON.stringify({ phone }),
  });
}

export async function verifyOtp(phone: string, code: string) {
  return apiCall<any>("/api/auth/verify-otp", {
    method: "POST",
    body: JSON.stringify({ phone, code }),
  });
}

export async function estimateTrip(payload: FareEstimateRequest) {
  return apiCall<{
    fare: {
      total: number;
      distanceMeters: number;
      durationSeconds: number;
      surgeMultiplier: number;
      currency: string;
    };
    etaSeconds: number;
    distanceMeters: number;
  }>("/api/trips/estimate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createTrip(payload: CreateTripRequest) {
  return apiCall<any>("/api/trips", {
    method: "POST",
    headers: payload.idempotencyKey ? { "Idempotency-Key": payload.idempotencyKey } : undefined,
    body: JSON.stringify(payload),
  });
}

export async function getTrip(tripId: string) {
  return apiCall<any>(`/api/trips/${tripId}`);
}

export async function getTrips() {
  return apiCall<any[]>("/api/trips");
}

export async function getActiveTrip() {
  return apiCall<{ trip: any | null }>("/api/trips/active");
}

export async function getTripMessages(tripId: string) {
  return apiCall<any[]>(`/api/trips/${tripId}/messages`);
}

export async function sendTripMessage(tripId: string, payload: { senderId: string; receiverId: string; message: string }) {
  return apiCall<any>(`/api/trips/${tripId}/messages`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function cancelTrip(tripId: string, reason: string) {
  return apiCall<any>(`/api/trips/${tripId}/cancel`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export async function shareTrip(tripId: string) {
  return apiCall<{ token: string; expiresAt: string; url: string }>(`/api/trips/${tripId}/share`, {
    method: "POST",
  });
}

export async function sendSos(tripId: string, description: string) {
  return apiCall<{ incidentId: string; status: string; support: Record<string, string> }>(`/api/trips/${tripId}/sos`, {
    method: "POST",
    body: JSON.stringify({ description }),
  });
}

export async function rateTrip(tripId: string, payload: TripRatingRequest) {
  return apiCall<{ driverRating: number; totalRatings: number }>(`/api/trips/${tripId}/rate`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function registerDriverByOwner(payload: {
  userId: number;
  vehicleMake: string;
  vehicleModel: string;
  vehicleColor: string;
  plateNumber: string;
  personalInfo?: {
    fullName: string;
    phoneNumber: string;
    nrcNumber: string;
    homeAddress: string;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
  };
  compliance?: {
    driversLicenseNumber: string;
    vehicleRegistrationNumber: string;
    hasDriversLicense: boolean;
    hasVehicleRegistrationDocument: boolean;
    insured: boolean;
    roadTaxCleared: boolean;
    fitnessTestPassed: boolean;
  };
  commercial?: {
    ridesPurchased: number;
    notes?: string;
  };
  documents?: {
    driversLicenseDocumentRef: string;
    vehicleRegistrationDocumentRef: string;
    insuranceDocumentRef: string;
    roadTaxDocumentRef: string;
    fitnessCertificateDocumentRef: string;
  };
  verified?: boolean;
}) {
  return apiCall<any>("/api/admin/drivers/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateDriverStatus(payload: DriverStatusRequest) {
  return apiCall<any>("/api/driver/status", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateDriverPayoutSettings(payload: { payoutMethod?: string | null; payoutAccountNumber?: string | null }) {
  return apiCall<any>("/api/driver/profile/payout", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getDriverRequests() {
  return apiCall<{ requests: any[] }>(withCacheBuster("/api/driver/requests"));
}

export async function acceptDriverRequest(offerId: string) {
  return apiCall<any>(`/api/driver/requests/${offerId}/accept`, {
    method: "POST",
  });
}

export async function declineDriverRequest(offerId: string) {
  return apiCall<any>(`/api/driver/requests/${offerId}/decline`, {
    method: "POST",
  });
}

export async function driverArrived(tripId: string) {
  return apiCall<any>(`/api/trips/${tripId}/arrived`, { method: "POST" });
}

export async function startTrip(tripId: string, payload: TripStartRequest) {
  return apiCall<any>(`/api/trips/${tripId}/start`, {
    method: "POST",
    headers: payload.idempotencyKey ? { "Idempotency-Key": payload.idempotencyKey } : undefined,
    body: JSON.stringify(payload),
  });
}

export async function completeTrip(tripId: string) {
  return apiCall<any>(`/api/trips/${tripId}/complete`, { method: "POST" });
}

export async function updateDriverLocation(payload: DriverLocationRequest) {
  return apiCall<any>("/api/driver/location", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getDriverDashboard() {
  return apiCall<any>(withCacheBuster("/api/driver/dashboard"));
}

export async function getNearbyDrivers(payload: NearbyDriversRequest) {
  return apiCall<{
    pickup: { lat: number; lng: number };
    radiusKm: number;
    drivers: {
      driverId: string;
      location: { lat: number; lng: number };
      rating: number;
      vehicle: { make: string; model: string; color: string };
      distanceMeters: number;
      etaSeconds: number;
      lastSeenAt: string;
    }[];
    fetchedAt: string;
  }>("/api/drivers/nearby", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function createTripStream(tripId: string, onMessage: (event: any) => void): (() => void) | null {
  if (Platform.OS !== "web" || typeof EventSource === "undefined") {
    return null;
  }
  const baseUrl = getApiBaseUrl();
  const streamUrl = `${baseUrl ? baseUrl.replace(/\/$/, "") : ""}/api/stream/trips/${tripId}`;
  const eventSource = new EventSource(streamUrl, { withCredentials: true });
  eventSource.onmessage = (event) => {
    try {
      onMessage(JSON.parse(event.data));
    } catch {
      // ignore malformed payloads
    }
  };
  eventSource.onerror = () => {
    eventSource.close();
  };
  return () => eventSource.close();
}
