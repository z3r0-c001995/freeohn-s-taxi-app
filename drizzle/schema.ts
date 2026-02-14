import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, float, decimal, boolean } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["rider", "driver", "admin"]).default("rider").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const driverProfiles = mysqlTable("driver_profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").references(() => users.id).notNull(),
  vehicleMake: varchar("vehicle_make", { length: 100 }),
  vehicleModel: varchar("vehicle_model", { length: 100 }),
  plateNumber: varchar("plate_number", { length: 20 }),
  licenseNumber: varchar("license_number", { length: 50 }),
  isOnline: boolean("is_online").default(false).notNull(),
  currentLat: decimal("current_lat", { precision: 10, scale: 8 }),
  currentLng: decimal("current_lng", { precision: 11, scale: 8 }),
  totalEarnings: decimal("total_earnings", { precision: 10, scale: 2 }).default("0.00"),
  totalTrips: int("total_trips").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const rides = mysqlTable("rides", {
  id: int("id").autoincrement().primaryKey(),
  riderId: int("rider_id").references(() => users.id).notNull(),
  driverId: int("driver_id").references(() => users.id),
  pickupLat: decimal("pickup_lat", { precision: 10, scale: 8 }).notNull(),
  pickupLng: decimal("pickup_lng", { precision: 11, scale: 8 }).notNull(),
  dropoffLat: decimal("dropoff_lat", { precision: 10, scale: 8 }),
  dropoffLng: decimal("dropoff_lng", { precision: 11, scale: 8 }),
  pickupAddress: text("pickup_address"),
  dropoffAddress: text("dropoff_address"),
  rideType: mysqlEnum("ride_type", ["standard", "premium"]).default("standard").notNull(),
  status: mysqlEnum("status", ["requested", "accepted", "in_progress", "completed", "cancelled"]).default("requested").notNull(),
  fareAmount: decimal("fare_amount", { precision: 10, scale: 2 }),
  distanceMeters: int("distance_meters"),
  durationSeconds: int("duration_seconds"),
  encodedPolyline: text("encoded_polyline"),
  requestedAt: timestamp("requested_at").defaultNow().notNull(),
  acceptedAt: timestamp("accepted_at"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  cancelledAt: timestamp("cancelled_at"),
  queuedSync: boolean("queued_sync").default(false).notNull(),
});

export const messages = mysqlTable("messages", {
  id: int("id").autoincrement().primaryKey(),
  rideId: int("ride_id").references(() => rides.id).notNull(),
  senderId: int("sender_id").references(() => users.id).notNull(),
  receiverId: int("receiver_id").references(() => users.id).notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").default(false).notNull(),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
});

export const locationHistory = mysqlTable("location_history", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").references(() => users.id).notNull(),
  lat: decimal("lat", { precision: 10, scale: 8 }).notNull(),
  lng: decimal("lng", { precision: 11, scale: 8 }).notNull(),
  heading: float("heading"),
  speed: float("speed"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const drivers = mysqlTable("drivers", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("user_id").references(() => users.id).notNull().unique(),
  verified: boolean("verified").default(false).notNull(),
  rating: decimal("rating", { precision: 4, scale: 2 }).default("5.00").notNull(),
  totalTrips: int("total_trips").default(0).notNull(),
  vehicleMake: varchar("vehicle_make", { length: 100 }).notNull(),
  vehicleModel: varchar("vehicle_model", { length: 100 }).notNull(),
  vehicleColor: varchar("vehicle_color", { length: 100 }).notNull(),
  plateNumber: varchar("plate_number", { length: 32 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const driverStatus = mysqlTable("driver_status", {
  driverId: varchar("driver_id", { length: 64 }).references(() => drivers.id).primaryKey(),
  isOnline: boolean("is_online").default(false).notNull(),
  lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
  lat: decimal("lat", { precision: 10, scale: 8 }),
  lng: decimal("lng", { precision: 11, scale: 8 }),
  activeTripId: varchar("active_trip_id", { length: 64 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const trips = mysqlTable("trips", {
  id: varchar("id", { length: 64 }).primaryKey(),
  riderId: int("rider_id").references(() => users.id).notNull(),
  assignedDriverId: varchar("assigned_driver_id", { length: 64 }).references(() => drivers.id),
  state: mysqlEnum("state", [
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
  ]).notNull(),
  pickupLat: decimal("pickup_lat", { precision: 10, scale: 8 }).notNull(),
  pickupLng: decimal("pickup_lng", { precision: 11, scale: 8 }).notNull(),
  pickupAddress: text("pickup_address").notNull(),
  dropoffLat: decimal("dropoff_lat", { precision: 10, scale: 8 }).notNull(),
  dropoffLng: decimal("dropoff_lng", { precision: 11, scale: 8 }).notNull(),
  dropoffAddress: text("dropoff_address").notNull(),
  paymentMethod: mysqlEnum("payment_method", ["CASH"]).default("CASH").notNull(),
  rideType: mysqlEnum("ride_type", ["standard", "premium"]).default("standard").notNull(),
  fareCurrency: varchar("fare_currency", { length: 8 }).default("USD").notNull(),
  fareBase: decimal("fare_base", { precision: 10, scale: 2 }).notNull(),
  fareDistance: decimal("fare_distance", { precision: 10, scale: 2 }).notNull(),
  fareTime: decimal("fare_time", { precision: 10, scale: 2 }).notNull(),
  fareSurgeMultiplier: decimal("fare_surge_multiplier", { precision: 5, scale: 2 }).default("1.00").notNull(),
  fareTotal: decimal("fare_total", { precision: 10, scale: 2 }).notNull(),
  estimatedDistanceMeters: int("estimated_distance_meters").notNull(),
  estimatedDurationSeconds: int("estimated_duration_seconds").notNull(),
  cancelFee: decimal("cancel_fee", { precision: 10, scale: 2 }).default("0.00").notNull(),
  pinRequired: boolean("pin_required").default(false).notNull(),
  pinHash: varchar("pin_hash", { length: 128 }),
  pinExpiresAt: timestamp("pin_expires_at"),
  pinAttempts: int("pin_attempts").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  matchedAt: timestamp("matched_at"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  cancelledAt: timestamp("cancelled_at"),
});

export const tripEvents = mysqlTable("trip_events", {
  id: varchar("id", { length: 64 }).primaryKey(),
  tripId: varchar("trip_id", { length: 64 }).references(() => trips.id).notNull(),
  fromState: varchar("from_state", { length: 64 }),
  toState: varchar("to_state", { length: 64 }).notNull(),
  actorId: varchar("actor_id", { length: 64 }).notNull(),
  actorRole: mysqlEnum("actor_role", ["rider", "driver", "admin"]).notNull(),
  reason: text("reason"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tripLocations = mysqlTable("trip_locations", {
  id: varchar("id", { length: 64 }).primaryKey(),
  tripId: varchar("trip_id", { length: 64 }).references(() => trips.id).notNull(),
  userId: varchar("user_id", { length: 64 }).notNull(),
  role: mysqlEnum("role", ["rider", "driver", "admin"]).notNull(),
  lat: decimal("lat", { precision: 10, scale: 8 }).notNull(),
  lng: decimal("lng", { precision: 11, scale: 8 }).notNull(),
  heading: float("heading"),
  speed: float("speed"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const safetyIncidents = mysqlTable("safety_incidents", {
  id: varchar("id", { length: 64 }).primaryKey(),
  tripId: varchar("trip_id", { length: 64 }).references(() => trips.id).notNull(),
  reporterUserId: varchar("reporter_user_id", { length: 64 }).notNull(),
  reporterRole: mysqlEnum("reporter_role", ["rider", "driver", "admin"]).notNull(),
  category: mysqlEnum("category", ["SOS", "SUPPORT"]).notNull(),
  status: mysqlEnum("status", ["OPEN", "ACKNOWLEDGED", "RESOLVED"]).default("OPEN").notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tripShareTokens = mysqlTable("trip_share_tokens", {
  id: varchar("id", { length: 64 }).primaryKey(),
  tripId: varchar("trip_id", { length: 64 }).references(() => trips.id).notNull(),
  token: varchar("token", { length: 256 }).notNull().unique(),
  createdByUserId: varchar("created_by_user_id", { length: 64 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  revokedAt: timestamp("revoked_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const rideRatings = mysqlTable("ratings", {
  id: varchar("id", { length: 64 }).primaryKey(),
  tripId: varchar("trip_id", { length: 64 }).references(() => trips.id).notNull().unique(),
  riderId: int("rider_id").references(() => users.id).notNull(),
  driverId: varchar("driver_id", { length: 64 }).references(() => drivers.id).notNull(),
  score: int("score").notNull(),
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

// TODO: Add your tables here
