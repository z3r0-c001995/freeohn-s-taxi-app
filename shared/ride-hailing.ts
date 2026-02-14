import { z } from "zod";

export const tripStateValues = [
  "CREATED",
  "MATCHING",
  "DRIVER_ASSIGNED",
  "DRIVER_ARRIVING",
  "PIN_VERIFICATION",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED_BY_PASSENGER",
  "CANCELLED_BY_DRIVER",
  "NO_DRIVER_FOUND",
] as const;

export type TripState = (typeof tripStateValues)[number];

export const cancelReasonValues = [
  "RIDER_CHANGED_MIND",
  "DRIVER_DELAYED",
  "WRONG_LOCATION",
  "EMERGENCY",
  "OTHER",
] as const;

export type CancelReason = (typeof cancelReasonValues)[number];

export const userRoleValues = ["rider", "driver", "admin"] as const;
export type UserRole = (typeof userRoleValues)[number];

export const paymentMethodValues = ["CASH"] as const;
export type PaymentMethod = (typeof paymentMethodValues)[number];

export const locationPointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const routeSummarySchema = z.object({
  distanceMeters: z.number().nonnegative(),
  durationSeconds: z.number().nonnegative(),
});

export const fareEstimateRequestSchema = z.object({
  pickup: locationPointSchema,
  dropoff: locationPointSchema,
  distanceMeters: z.number().nonnegative(),
  durationSeconds: z.number().nonnegative(),
  rideType: z.enum(["standard", "premium"]).default("standard"),
});

export type FareEstimateRequest = z.infer<typeof fareEstimateRequestSchema>;

export const createTripRequestSchema = fareEstimateRequestSchema.extend({
  pickupAddress: z.string().min(1).max(255),
  dropoffAddress: z.string().min(1).max(255),
  paymentMethod: z.enum(paymentMethodValues).default("CASH"),
  idempotencyKey: z.string().min(6).max(128).optional(),
});

export type CreateTripRequest = z.infer<typeof createTripRequestSchema>;

export const driverStatusRequestSchema = z.object({
  isOnline: z.boolean(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

export type DriverStatusRequest = z.infer<typeof driverStatusRequestSchema>;

export const driverLocationRequestSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  heading: z.number().min(0).max(360).optional(),
  speed: z.number().min(0).optional(),
  tripId: z.string().min(1).optional(),
});

export type DriverLocationRequest = z.infer<typeof driverLocationRequestSchema>;

export const tripRatingRequestSchema = z.object({
  score: z.number().int().min(1).max(5),
  feedback: z.string().trim().max(1000).optional(),
});

export type TripRatingRequest = z.infer<typeof tripRatingRequestSchema>;

export const tripCancelRequestSchema = z.object({
  reason: z.enum(cancelReasonValues).default("OTHER"),
});

export type TripCancelRequest = z.infer<typeof tripCancelRequestSchema>;

export const tripStartRequestSchema = z.object({
  pin: z.string().regex(/^\d{4}$/).optional(),
  idempotencyKey: z.string().min(6).max(128).optional(),
});

export type TripStartRequest = z.infer<typeof tripStartRequestSchema>;

export const rideHailingConfigSchema = z.object({
  dispatchRadiusKm: z.number().positive(),
  offerTimeoutMs: z.number().int().positive(),
  maxDriverCandidates: z.number().int().positive(),
  enableTripStartPin: z.boolean(),
  tripStartPinTtlMs: z.number().int().positive(),
  tripStartPinMaxAttempts: z.number().int().positive(),
  tripShareTokenTtlMs: z.number().int().positive(),
  cancelFeeBeforeAssign: z.number().min(0),
  cancelFeeAfterAssign: z.number().min(0),
  ratingRollingWindow: z.number().int().positive(),
});

export type RideHailingConfig = z.infer<typeof rideHailingConfigSchema>;

export type FareSnapshot = {
  currency: "USD";
  baseFare: number;
  distanceFare: number;
  timeFare: number;
  surgeMultiplier: number;
  total: number;
  distanceMeters: number;
  durationSeconds: number;
  rideType: "standard" | "premium";
};

export type DriverVehicle = {
  make: string;
  model: string;
  color: string;
  plateNumber: string;
};

export type DriverProfileRecord = {
  driverId: string;
  userId: number;
  verified: boolean;
  rating: number;
  totalTrips: number;
  vehicle: DriverVehicle;
};

export type DriverStatusRecord = {
  driverId: string;
  isOnline: boolean;
  lastSeenAt: string;
  lat: number | null;
  lng: number | null;
  activeTripId: string | null;
};

export type TripRecord = {
  id: string;
  riderId: number;
  driverId: string | null;
  pickup: { lat: number; lng: number; address: string };
  dropoff: { lat: number; lng: number; address: string };
  state: TripState;
  paymentMethod: PaymentMethod;
  fare: FareSnapshot;
  createdAt: string;
  updatedAt: string;
  matchedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelFee: number;
  pinRequired: boolean;
  pinExpiresAt: string | null;
  pinAttempts: number;
};

export type TripEventRecord = {
  id: string;
  tripId: string;
  fromState: TripState | null;
  toState: TripState;
  actorId: string;
  actorRole: UserRole;
  reason?: string;
  meta?: Record<string, unknown>;
  createdAt: string;
};

