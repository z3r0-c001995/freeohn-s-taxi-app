#!/bin/bash

set -euo pipefail

DB_FILE="${1:-data.db}"

echo "Setting up test data in ${DB_FILE}..."

python3 - <<'PY' "$DB_FILE"
import sqlite3
import sys
from pathlib import Path

db_path = Path(sys.argv[1]).resolve()

schema = """
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  phone TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  role TEXT NOT NULL CHECK(role IN ('rider', 'driver', 'admin')),
  avatar TEXT,
  rating REAL DEFAULT 5.0,
  total_rides INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

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

CREATE TABLE IF NOT EXISTS location_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  accuracy REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_rides_rider_id ON rides(rider_id);
CREATE INDEX IF NOT EXISTS idx_rides_driver_id ON rides(driver_id);
CREATE INDEX IF NOT EXISTS idx_rides_status ON rides(status);
CREATE INDEX IF NOT EXISTS idx_messages_ride_id ON messages(ride_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_ratings_ride_id ON ratings(ride_id);
CREATE INDEX IF NOT EXISTS idx_location_history_user_id ON location_history(user_id);
CREATE INDEX IF NOT EXISTS idx_driver_profiles_user_id ON driver_profiles(user_id);
"""

seed_users = [
    ("1001", "rider_john_001", "John Rider", "john.rider@example.com", "rider"),
    ("1002", "driver_alice_001", "Alice Driver", "alice.driver@example.com", "driver"),
    ("1003", "driver_bob_001", "Bob Driver", "bob.driver@example.com", "driver"),
    ("1004", "admin_user_001", "Admin User", "admin@example.com", "admin"),
]

seed_driver_profiles = [
    ("2001", "1002", "Toyota Axio", "KCA 123A", "White", "DL-ALICE-001", 1, -1.2864, 36.8172, 15420.50, 156),
    ("2002", "1003", "Nissan Note", "KDD 456B", "Blue", "DL-BOB-002", 0, -1.2965, 36.8245, 11210.00, 127),
]

conn = sqlite3.connect(db_path)
try:
    conn.executescript(schema)
    conn.executemany(
        """
        INSERT OR REPLACE INTO users (id, phone, name, email, role, updated_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        """,
        seed_users,
    )
    conn.executemany(
        """
        INSERT OR REPLACE INTO driver_profiles (
          id, user_id, vehicle_type, vehicle_number, vehicle_color, license_number,
          is_online, current_latitude, current_longitude, total_earnings, total_trips, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        """,
        seed_driver_profiles,
    )
    conn.commit()

    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM users")
    users_count = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM driver_profiles")
    drivers_count = cur.fetchone()[0]
finally:
    conn.close()

print(f"Database ready: {db_path}")
print(f"Users: {users_count}")
print(f"Driver profiles: {drivers_count}")
PY

echo "Done."
