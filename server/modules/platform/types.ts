import type {
  DriverProfileRecord,
  DriverStatusRecord,
  TripEventRecord,
  TripRecord,
  UserRole,
} from "../../../shared/ride-hailing";

export type DriverOfferStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "EXPIRED";

export type DriverDispatchOffer = {
  id: string;
  tripId: string;
  driverId: string;
  status: DriverOfferStatus;
  distanceKm: number;
  createdAt: string;
  expiresAt: string;
  respondedAt: string | null;
};

export type TripLocationRecord = {
  id: string;
  tripId: string;
  userId: string;
  role: UserRole;
  lat: number;
  lng: number;
  heading: number | null;
  speed: number | null;
  createdAt: string;
};

export type SafetyIncidentRecord = {
  id: string;
  tripId: string;
  reporterUserId: string;
  reporterRole: UserRole;
  category: "SOS" | "SUPPORT";
  status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED";
  description: string;
  createdAt: string;
};

export type TripShareTokenRecord = {
  id: string;
  tripId: string;
  createdByUserId: string;
  token: string;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
};

export type DriverRatingRecord = {
  id: string;
  tripId: string;
  riderId: number;
  driverId: string;
  score: number;
  feedback: string | null;
  createdAt: string;
};

export type TripStartPinRecord = {
  tripId: string;
  hash: string;
  plaintextPin: string;
  expiresAt: string;
  attempts: number;
};

export type IdempotencyEntry = {
  key: string;
  action: string;
  createdAt: string;
  response: unknown;
};

export type PlatformSnapshot = {
  drivers: DriverProfileRecord[];
  driverStatus: DriverStatusRecord[];
  trips: TripRecord[];
  tripEvents: TripEventRecord[];
  dispatchOffers: DriverDispatchOffer[];
  tripLocations: TripLocationRecord[];
  tripShareTokens: TripShareTokenRecord[];
  safetyIncidents: SafetyIncidentRecord[];
  ratings: DriverRatingRecord[];
};

