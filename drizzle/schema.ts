import {
  boolean,
  doublePrecision,
  integer,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * PostgreSQL Enums for Freeohn Taxi & Haul
 */
export const userRoleEnum = pgEnum("user_role", ["rider", "driver", "admin"]);
export const driverKycStatusEnum = pgEnum("driver_kyc_status", ["pending", "under_review", "approved", "rejected"]);
export const driverDutyStatusEnum = pgEnum("driver_duty_status", ["offline", "online", "busy", "suspended"]);
export const rideTypeEnum = pgEnum("ride_type", ["standard", "comfort", "premium", "haul_truck", "delivery"]);
export const rideStatusEnum = pgEnum("ride_status", [
  "requested",
  "matching",
  "driver_assigned",
  "driver_arriving",
  "pin_verification",
  "in_progress",
  "completed",
  "cancelled",
  "no_driver_found",
]);
export const paymentMethodEnum = pgEnum("payment_method", ["CASH", "MOMO_MTN", "MOMO_AIRTEL", "CARD", "WALLET"]);
export const tripStateEnum = pgEnum("trip_state", [
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
]);
export const actorRoleEnum = pgEnum("actor_role", ["rider", "driver", "admin"]);
export const safetyCategoryEnum = pgEnum("safety_category", ["SOS", "SUPPORT"]);
export const safetyStatusEnum = pgEnum("safety_status", ["OPEN", "ACKNOWLEDGED", "RESOLVED"]);

/**
 * Core users table backing auth and profiles
 */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: userRoleEnum("role").default("rider").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const driverProfiles = pgTable("driver_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  vehicleMake: varchar("vehicle_make", { length: 100 }),
  vehicleModel: varchar("vehicle_model", { length: 100 }),
  plateNumber: varchar("plate_number", { length: 20 }),
  licenseNumber: varchar("license_number", { length: 50 }),
  isOnline: boolean("is_online").default(false).notNull(),
  currentLat: numeric("current_lat", { precision: 10, scale: 8 }),
  currentLng: numeric("current_lng", { precision: 11, scale: 8 }),
  totalEarnings: numeric("total_earnings", { precision: 10, scale: 2 }).default("0.00"),
  totalTrips: integer("total_trips").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const rides = pgTable("rides", {
  id: serial("id").primaryKey(),
  riderId: integer("rider_id").references(() => users.id).notNull(),
  driverId: integer("driver_id").references(() => users.id),
  pickupLat: numeric("pickup_lat", { precision: 10, scale: 8 }).notNull(),
  pickupLng: numeric("pickup_lng", { precision: 11, scale: 8 }).notNull(),
  dropoffLat: numeric("dropoff_lat", { precision: 10, scale: 8 }),
  dropoffLng: numeric("dropoff_lng", { precision: 11, scale: 8 }),
  pickupAddress: text("pickup_address"),
  dropoffAddress: text("dropoff_address"),
  rideType: rideTypeEnum("ride_type").default("standard").notNull(),
  status: rideStatusEnum("status").default("requested").notNull(),
  fareAmount: numeric("fare_amount", { precision: 10, scale: 2 }),
  distanceMeters: integer("distance_meters"),
  durationSeconds: integer("duration_seconds"),
  encodedPolyline: text("encoded_polyline"),
  requestedAt: timestamp("requested_at").defaultNow().notNull(),
  acceptedAt: timestamp("accepted_at"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  cancelledAt: timestamp("cancelled_at"),
  queuedSync: boolean("queued_sync").default(false).notNull(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  rideId: integer("ride_id").references(() => rides.id).notNull(),
  senderId: integer("sender_id").references(() => users.id).notNull(),
  receiverId: integer("receiver_id").references(() => users.id).notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").default(false).notNull(),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
});

export const locationHistory = pgTable("location_history", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  lat: numeric("lat", { precision: 10, scale: 8 }).notNull(),
  lng: numeric("lng", { precision: 11, scale: 8 }).notNull(),
  heading: doublePrecision("heading"),
  speed: doublePrecision("speed"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const drivers = pgTable("drivers", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull().unique(),
  verified: boolean("verified").default(false).notNull(),
  rating: numeric("rating", { precision: 4, scale: 2 }).default("5.00").notNull(),
  totalTrips: integer("total_trips").default(0).notNull(),
  vehicleMake: varchar("vehicle_make", { length: 100 }).notNull(),
  vehicleModel: varchar("vehicle_model", { length: 100 }).notNull(),
  vehicleColor: varchar("vehicle_color", { length: 100 }).notNull(),
  plateNumber: varchar("plate_number", { length: 32 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const driverStatus = pgTable("driver_status", {
  driverId: varchar("driver_id", { length: 64 }).references(() => drivers.id).primaryKey(),
  isOnline: boolean("is_online").default(false).notNull(),
  lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
  lat: numeric("lat", { precision: 10, scale: 8 }),
  lng: numeric("lng", { precision: 11, scale: 8 }),
  activeTripId: varchar("active_trip_id", { length: 64 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const trips = pgTable("trips", {
  id: varchar("id", { length: 64 }).primaryKey(),
  riderId: integer("rider_id").references(() => users.id).notNull(),
  assignedDriverId: varchar("assigned_driver_id", { length: 64 }).references(() => drivers.id),
  state: tripStateEnum("state").notNull(),
  pickupLat: numeric("pickup_lat", { precision: 10, scale: 8 }).notNull(),
  pickupLng: numeric("pickup_lng", { precision: 11, scale: 8 }).notNull(),
  pickupAddress: text("pickup_address").notNull(),
  dropoffLat: numeric("dropoff_lat", { precision: 10, scale: 8 }).notNull(),
  dropoffLng: numeric("dropoff_lng", { precision: 11, scale: 8 }).notNull(),
  dropoffAddress: text("dropoff_address").notNull(),
  paymentMethod: paymentMethodEnum("payment_method").default("CASH").notNull(),
  rideType: rideTypeEnum("ride_type").default("standard").notNull(),
  fareCurrency: varchar("fare_currency", { length: 8 }).default("ZMW").notNull(),
  fareBase: numeric("fare_base", { precision: 10, scale: 2 }).notNull(),
  fareDistance: numeric("fare_distance", { precision: 10, scale: 2 }).notNull(),
  fareTime: numeric("fare_time", { precision: 10, scale: 2 }).notNull(),
  fareSurgeMultiplier: numeric("fare_surge_multiplier", { precision: 5, scale: 2 }).default("1.00").notNull(),
  fareTotal: numeric("fare_total", { precision: 10, scale: 2 }).notNull(),
  estimatedDistanceMeters: integer("estimated_distance_meters").notNull(),
  estimatedDurationSeconds: integer("estimated_duration_seconds").notNull(),
  cancelFee: numeric("cancel_fee", { precision: 10, scale: 2 }).default("0.00").notNull(),
  pinRequired: boolean("pin_required").default(false).notNull(),
  pinHash: varchar("pin_hash", { length: 128 }),
  pinExpiresAt: timestamp("pin_expires_at"),
  pinAttempts: integer("pin_attempts").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  matchedAt: timestamp("matched_at"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  cancelledAt: timestamp("cancelled_at"),
});

export const tripEvents = pgTable("trip_events", {
  id: varchar("id", { length: 64 }).primaryKey(),
  tripId: varchar("trip_id", { length: 64 }).references(() => trips.id).notNull(),
  fromState: varchar("from_state", { length: 64 }),
  toState: varchar("to_state", { length: 64 }).notNull(),
  actorId: varchar("actor_id", { length: 64 }).notNull(),
  actorRole: actorRoleEnum("actor_role").notNull(),
  reason: text("reason"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tripLocations = pgTable("trip_locations", {
  id: varchar("id", { length: 64 }).primaryKey(),
  tripId: varchar("trip_id", { length: 64 }).references(() => trips.id).notNull(),
  userId: varchar("user_id", { length: 64 }).notNull(),
  role: actorRoleEnum("role").notNull(),
  lat: numeric("lat", { precision: 10, scale: 8 }).notNull(),
  lng: numeric("lng", { precision: 11, scale: 8 }).notNull(),
  heading: doublePrecision("heading"),
  speed: doublePrecision("speed"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const safetyIncidents = pgTable("safety_incidents", {
  id: varchar("id", { length: 64 }).primaryKey(),
  tripId: varchar("trip_id", { length: 64 }).references(() => trips.id).notNull(),
  reporterUserId: varchar("reporter_user_id", { length: 64 }).notNull(),
  reporterRole: actorRoleEnum("reporter_role").notNull(),
  category: safetyCategoryEnum("category").notNull(),
  status: safetyStatusEnum("status").default("OPEN").notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tripShareTokens = pgTable("trip_share_tokens", {
  id: varchar("id", { length: 64 }).primaryKey(),
  tripId: varchar("trip_id", { length: 64 }).references(() => trips.id).notNull(),
  token: varchar("token", { length: 256 }).notNull().unique(),
  createdByUserId: varchar("created_by_user_id", { length: 64 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  revokedAt: timestamp("revoked_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const rideRatings = pgTable("ratings", {
  id: varchar("id", { length: 64 }).primaryKey(),
  tripId: varchar("trip_id", { length: 64 }).references(() => trips.id).notNull().unique(),
  riderId: integer("rider_id").references(() => users.id).notNull(),
  driverId: varchar("driver_id", { length: 64 }).references(() => drivers.id).notNull(),
  score: integer("score").notNull(),
  feedback: text("feedback"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type DriverProfile = typeof driverProfiles.$inferSelect;
export type InsertDriverProfile = typeof driverProfiles.$inferInsert;
export type Ride = typeof rides.$inferSelect;
export type InsertRide = typeof rides.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;
export type LocationHistory = typeof locationHistory.$inferSelect;
export type InsertLocationHistory = typeof locationHistory.$inferInsert;
export type Driver = typeof drivers.$inferSelect;
export type InsertDriver = typeof drivers.$inferInsert;
export type DriverStatus = typeof driverStatus.$inferSelect;
export type InsertDriverStatus = typeof driverStatus.$inferInsert;
export type Trip = typeof trips.$inferSelect;
export type InsertTrip = typeof trips.$inferInsert;
export type TripEvent = typeof tripEvents.$inferSelect;
export type InsertTripEvent = typeof tripEvents.$inferInsert;
export type TripLocation = typeof tripLocations.$inferSelect;
export type InsertTripLocation = typeof tripLocations.$inferInsert;
export type SafetyIncident = typeof safetyIncidents.$inferSelect;
export type InsertSafetyIncident = typeof safetyIncidents.$inferInsert;
export type TripShareToken = typeof tripShareTokens.$inferSelect;
export type InsertTripShareToken = typeof tripShareTokens.$inferInsert;
export type Rating = typeof rideRatings.$inferSelect;
export type InsertRating = typeof rideRatings.$inferInsert;
