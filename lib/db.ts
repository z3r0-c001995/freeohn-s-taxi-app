import * as SQLite from "expo-sqlite";
import { APP_VARIANT } from "@/constants/app-variant";

const DATABASE_NAME = "ridehaul.db";

let db: SQLite.SQLiteDatabase | null = null;

export async function initializeDatabase() {
  try {
    db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
    `);
    await createTables();
    await runMigrations();
    await seedDriverAppDemoData();
    console.log("Database initialized successfully");
  } catch (error) {
    console.error("Failed to initialize database:", error);
    throw error;
  }
}

async function createTables() {
  if (!db) throw new Error("Database not initialized");

  await db.execAsync(`
    -- Users table
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      phone TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      email TEXT,
      role TEXT NOT NULL CHECK(role IN ('rider', 'driver')),
      avatar TEXT,
      rating REAL DEFAULT 5.0,
      total_rides INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Driver profiles
    CREATE TABLE IF NOT EXISTS driver_profiles (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE NOT NULL,
      vehicle_type TEXT NOT NULL,
      vehicle_number TEXT NOT NULL,
      vehicle_color TEXT,
      license_number TEXT,
      is_online INTEGER DEFAULT 0,
      current_latitude REAL,
      current_longitude REAL,
      total_earnings REAL DEFAULT 0.0,
      total_trips INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Rides table
    CREATE TABLE IF NOT EXISTS rides (
      id TEXT PRIMARY KEY,
      rider_id TEXT NOT NULL,
      driver_id TEXT,
      pickup_latitude REAL NOT NULL,
      pickup_longitude REAL NOT NULL,
      dropoff_latitude REAL NOT NULL,
      dropoff_longitude REAL NOT NULL,
      pickup_address TEXT,
      dropoff_address TEXT,
      ride_type TEXT NOT NULL CHECK(ride_type IN ('standard', 'premium')),
      status TEXT NOT NULL CHECK(status IN ('requested', 'accepted', 'in_progress', 'completed', 'cancelled')),
      estimated_fare REAL,
      actual_fare REAL,
      distance_km REAL,
      duration_minutes INTEGER,
      started_at DATETIME,
      completed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(rider_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(driver_id) REFERENCES users(id) ON DELETE SET NULL
    );

    -- Messages table
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      ride_id TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      receiver_id TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(ride_id) REFERENCES rides(id) ON DELETE CASCADE,
      FOREIGN KEY(sender_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(receiver_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Ratings table
    CREATE TABLE IF NOT EXISTS ratings (
      id TEXT PRIMARY KEY,
      ride_id TEXT NOT NULL,
      rater_id TEXT NOT NULL,
      ratee_id TEXT NOT NULL,
      rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
      review TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(ride_id) REFERENCES rides(id) ON DELETE CASCADE,
      FOREIGN KEY(rater_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(ratee_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Transactions table
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      ride_id TEXT NOT NULL,
      amount REAL NOT NULL,
      tip REAL DEFAULT 0.0,
      payment_method TEXT,
      status TEXT NOT NULL CHECK(status IN ('pending', 'completed', 'failed')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(ride_id) REFERENCES rides(id) ON DELETE CASCADE
    );

    -- Location history
    CREATE TABLE IF NOT EXISTS location_history (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      accuracy REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Create indexes for better query performance
    CREATE INDEX IF NOT EXISTS idx_rides_rider_id ON rides(rider_id);
    CREATE INDEX IF NOT EXISTS idx_rides_driver_id ON rides(driver_id);
    CREATE INDEX IF NOT EXISTS idx_rides_status ON rides(status);
    CREATE INDEX IF NOT EXISTS idx_messages_ride_id ON messages(ride_id);
    CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
    CREATE INDEX IF NOT EXISTS idx_ratings_ride_id ON ratings(ride_id);
    CREATE INDEX IF NOT EXISTS idx_location_history_user_id ON location_history(user_id);
    CREATE INDEX IF NOT EXISTS idx_driver_profiles_user_id ON driver_profiles(user_id);
  `);
}

async function runMigrations() {
  if (!db) throw new Error("Database not initialized");

  await ensureColumn(
    "driver_profiles",
    "updated_at",
    "DATETIME DEFAULT CURRENT_TIMESTAMP",
  );

  await db.runAsync(
    `UPDATE driver_profiles
     SET updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP)
     WHERE updated_at IS NULL`,
  );
}

async function ensureColumn(
  tableName: "driver_profiles",
  columnName: "updated_at",
  columnDefinition: string,
) {
  if (!db) throw new Error("Database not initialized");

  const tableInfo = (await db.getAllAsync(`PRAGMA table_info(${tableName})`)) as Array<{
    name?: string;
  }>;

  const hasColumn = tableInfo.some((column) => column.name === columnName);
  if (!hasColumn) {
    await db.execAsync(
      `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`,
    );
  }
}

async function seedDriverAppDemoData() {
  if (!db) throw new Error("Database not initialized");

  if (APP_VARIANT !== "driver") {
    return;
  }

  const existing = (await db.getFirstAsync(`SELECT COUNT(*) as count FROM users WHERE role = 'driver'`)) as
    | { count?: number | string }
    | null;
  const existingDrivers = Number(existing?.count ?? 0);
  if (existingDrivers > 0) {
    return;
  }

  const demoDriverUserId = "2001001";
  const demoDriverProfileId = "3001001";

  await db.runAsync(
    `INSERT INTO users
     (id, phone, name, email, role, rating, total_rides, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'driver', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [demoDriverUserId, "5551234567", "Demo Driver", "driver.demo@freeohn.app", 4.8, 156],
  );

  await db.runAsync(
    `INSERT INTO driver_profiles
     (id, user_id, vehicle_type, vehicle_number, vehicle_color, license_number, is_online,
      current_latitude, current_longitude, total_earnings, total_trips, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [demoDriverProfileId, demoDriverUserId, "Toyota Prius", "KAA111A", "Silver", "DRV-1001", -1.286389, 36.817223, 0, 156],
  );

  console.log("Seeded demo company-registered driver account for driver app");
}

export function getDatabase() {
  if (!db) {
    throw new Error("Database not initialized. Call initializeDatabase first.");
  }
  return db;
}

export async function closeDatabase() {
  if (db) {
    await db.closeAsync();
    db = null;
  }
}
