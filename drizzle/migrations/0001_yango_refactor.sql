-- Yango-like ride-hailing schema extension for Freeohn's
-- MySQL 8+

CREATE TABLE IF NOT EXISTS `drivers` (
  `id` varchar(64) NOT NULL,
  `user_id` int NOT NULL,
  `verified` boolean NOT NULL DEFAULT false,
  `rating` decimal(4,2) NOT NULL DEFAULT 5.00,
  `total_trips` int NOT NULL DEFAULT 0,
  `vehicle_make` varchar(100) NOT NULL,
  `vehicle_model` varchar(100) NOT NULL,
  `vehicle_color` varchar(100) NOT NULL,
  `plate_number` varchar(32) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `drivers_user_id_unique` (`user_id`),
  CONSTRAINT `drivers_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
);

CREATE TABLE IF NOT EXISTS `driver_status` (
  `driver_id` varchar(64) NOT NULL,
  `is_online` boolean NOT NULL DEFAULT false,
  `last_seen_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `lat` decimal(10,8) NULL,
  `lng` decimal(11,8) NULL,
  `active_trip_id` varchar(64) NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`driver_id`),
  KEY `idx_driver_status_online` (`is_online`),
  CONSTRAINT `driver_status_driver_fk` FOREIGN KEY (`driver_id`) REFERENCES `drivers` (`id`)
);

CREATE TABLE IF NOT EXISTS `trips` (
  `id` varchar(64) NOT NULL,
  `rider_id` int NOT NULL,
  `assigned_driver_id` varchar(64) NULL,
  `state` enum(
    'CREATED',
    'MATCHING',
    'DRIVER_ASSIGNED',
    'DRIVER_ARRIVING',
    'PIN_VERIFICATION',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED_BY_PASSENGER',
    'CANCELLED_BY_DRIVER',
    'NO_DRIVER_FOUND'
  ) NOT NULL,
  `pickup_lat` decimal(10,8) NOT NULL,
  `pickup_lng` decimal(11,8) NOT NULL,
  `pickup_address` text NOT NULL,
  `dropoff_lat` decimal(10,8) NOT NULL,
  `dropoff_lng` decimal(11,8) NOT NULL,
  `dropoff_address` text NOT NULL,
  `payment_method` enum('CASH') NOT NULL DEFAULT 'CASH',
  `ride_type` enum('standard', 'premium') NOT NULL DEFAULT 'standard',
  `fare_currency` varchar(8) NOT NULL DEFAULT 'USD',
  `fare_base` decimal(10,2) NOT NULL,
  `fare_distance` decimal(10,2) NOT NULL,
  `fare_time` decimal(10,2) NOT NULL,
  `fare_surge_multiplier` decimal(5,2) NOT NULL DEFAULT 1.00,
  `fare_total` decimal(10,2) NOT NULL,
  `estimated_distance_meters` int NOT NULL,
  `estimated_duration_seconds` int NOT NULL,
  `cancel_fee` decimal(10,2) NOT NULL DEFAULT 0.00,
  `pin_required` boolean NOT NULL DEFAULT false,
  `pin_hash` varchar(128) NULL,
  `pin_expires_at` timestamp NULL,
  `pin_attempts` int NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `matched_at` timestamp NULL,
  `started_at` timestamp NULL,
  `completed_at` timestamp NULL,
  `cancelled_at` timestamp NULL,
  PRIMARY KEY (`id`),
  KEY `idx_trips_state` (`state`),
  KEY `idx_trips_rider` (`rider_id`),
  KEY `idx_trips_driver` (`assigned_driver_id`),
  CONSTRAINT `trips_rider_fk` FOREIGN KEY (`rider_id`) REFERENCES `users` (`id`),
  CONSTRAINT `trips_driver_fk` FOREIGN KEY (`assigned_driver_id`) REFERENCES `drivers` (`id`)
);

CREATE TABLE IF NOT EXISTS `trip_events` (
  `id` varchar(64) NOT NULL,
  `trip_id` varchar(64) NOT NULL,
  `from_state` varchar(64) NULL,
  `to_state` varchar(64) NOT NULL,
  `actor_id` varchar(64) NOT NULL,
  `actor_role` enum('rider', 'driver', 'admin') NOT NULL,
  `reason` text NULL,
  `metadata` text NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_trip_events_trip_time` (`trip_id`, `created_at`),
  CONSTRAINT `trip_events_trip_fk` FOREIGN KEY (`trip_id`) REFERENCES `trips` (`id`)
);

CREATE TABLE IF NOT EXISTS `trip_locations` (
  `id` varchar(64) NOT NULL,
  `trip_id` varchar(64) NOT NULL,
  `user_id` varchar(64) NOT NULL,
  `role` enum('rider', 'driver', 'admin') NOT NULL,
  `lat` decimal(10,8) NOT NULL,
  `lng` decimal(11,8) NOT NULL,
  `heading` float NULL,
  `speed` float NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_trip_locations_trip_time` (`trip_id`, `created_at`),
  CONSTRAINT `trip_locations_trip_fk` FOREIGN KEY (`trip_id`) REFERENCES `trips` (`id`)
);

CREATE TABLE IF NOT EXISTS `safety_incidents` (
  `id` varchar(64) NOT NULL,
  `trip_id` varchar(64) NOT NULL,
  `reporter_user_id` varchar(64) NOT NULL,
  `reporter_role` enum('rider', 'driver', 'admin') NOT NULL,
  `category` enum('SOS', 'SUPPORT') NOT NULL,
  `status` enum('OPEN', 'ACKNOWLEDGED', 'RESOLVED') NOT NULL DEFAULT 'OPEN',
  `description` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_safety_trip` (`trip_id`),
  CONSTRAINT `safety_incidents_trip_fk` FOREIGN KEY (`trip_id`) REFERENCES `trips` (`id`)
);

CREATE TABLE IF NOT EXISTS `trip_share_tokens` (
  `id` varchar(64) NOT NULL,
  `trip_id` varchar(64) NOT NULL,
  `token` varchar(256) NOT NULL,
  `created_by_user_id` varchar(64) NOT NULL,
  `expires_at` timestamp NOT NULL,
  `revoked_at` timestamp NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `trip_share_tokens_token_unique` (`token`),
  KEY `idx_trip_share_trip` (`trip_id`),
  KEY `idx_trip_share_expires` (`expires_at`),
  CONSTRAINT `trip_share_tokens_trip_fk` FOREIGN KEY (`trip_id`) REFERENCES `trips` (`id`)
);

CREATE TABLE IF NOT EXISTS `ratings` (
  `id` varchar(64) NOT NULL,
  `trip_id` varchar(64) NOT NULL,
  `rider_id` int NOT NULL,
  `driver_id` varchar(64) NOT NULL,
  `score` int NOT NULL,
  `feedback` text NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ratings_trip_unique` (`trip_id`),
  KEY `idx_ratings_driver` (`driver_id`, `created_at`),
  CONSTRAINT `ratings_trip_fk` FOREIGN KEY (`trip_id`) REFERENCES `trips` (`id`),
  CONSTRAINT `ratings_rider_fk` FOREIGN KEY (`rider_id`) REFERENCES `users` (`id`),
  CONSTRAINT `ratings_driver_fk` FOREIGN KEY (`driver_id`) REFERENCES `drivers` (`id`)
);

-- Backfill drivers from legacy driver_profiles + users
INSERT INTO `drivers` (`id`, `user_id`, `verified`, `rating`, `total_trips`, `vehicle_make`, `vehicle_model`, `vehicle_color`, `plate_number`)
SELECT
  CONCAT('driver_', dp.id),
  dp.user_id,
  true,
  5.00,
  COALESCE(dp.total_trips, 0),
  COALESCE(dp.vehicle_make, 'Unknown'),
  COALESCE(dp.vehicle_model, 'Unknown'),
  'Unknown',
  COALESCE(dp.plate_number, 'UNKNOWN')
FROM `driver_profiles` dp
WHERE NOT EXISTS (
  SELECT 1
  FROM `drivers` d
  WHERE d.user_id = dp.user_id
);

-- Backfill driver status from legacy driver_profiles current position fields
INSERT INTO `driver_status` (`driver_id`, `is_online`, `last_seen_at`, `lat`, `lng`, `active_trip_id`)
SELECT
  d.id,
  COALESCE(dp.is_online, false),
  NOW(),
  dp.current_lat,
  dp.current_lng,
  NULL
FROM `drivers` d
JOIN `driver_profiles` dp ON dp.user_id = d.user_id
WHERE NOT EXISTS (
  SELECT 1
  FROM `driver_status` ds
  WHERE ds.driver_id = d.id
);

-- Optional backfill of legacy rides into trips
INSERT INTO `trips` (
  `id`,
  `rider_id`,
  `assigned_driver_id`,
  `state`,
  `pickup_lat`,
  `pickup_lng`,
  `pickup_address`,
  `dropoff_lat`,
  `dropoff_lng`,
  `dropoff_address`,
  `payment_method`,
  `ride_type`,
  `fare_currency`,
  `fare_base`,
  `fare_distance`,
  `fare_time`,
  `fare_surge_multiplier`,
  `fare_total`,
  `estimated_distance_meters`,
  `estimated_duration_seconds`,
  `cancel_fee`,
  `pin_required`,
  `pin_attempts`,
  `created_at`,
  `updated_at`,
  `matched_at`,
  `started_at`,
  `completed_at`,
  `cancelled_at`
)
SELECT
  CONCAT('trip_', r.id),
  r.rider_id,
  CASE WHEN r.driver_id IS NULL THEN NULL ELSE CONCAT('driver_', r.driver_id) END,
  CASE r.status
    WHEN 'requested' THEN 'MATCHING'
    WHEN 'accepted' THEN 'DRIVER_ASSIGNED'
    WHEN 'in_progress' THEN 'IN_PROGRESS'
    WHEN 'completed' THEN 'COMPLETED'
    WHEN 'cancelled' THEN 'CANCELLED_BY_PASSENGER'
    ELSE 'CREATED'
  END,
  r.pickup_lat,
  r.pickup_lng,
  COALESCE(r.pickup_address, ''),
  COALESCE(r.dropoff_lat, r.pickup_lat),
  COALESCE(r.dropoff_lng, r.pickup_lng),
  COALESCE(r.dropoff_address, ''),
  'CASH',
  COALESCE(r.ride_type, 'standard'),
  'USD',
  2.50,
  GREATEST(COALESCE(r.distance_meters, 0) / 1000 * 1.20, 0),
  GREATEST(COALESCE(r.duration_seconds, 0) / 60 * 0.25, 0),
  1.00,
  COALESCE(r.fare_amount, 5.00),
  COALESCE(r.distance_meters, 0),
  COALESCE(r.duration_seconds, 0),
  0.00,
  false,
  0,
  r.requested_at,
  COALESCE(r.completed_at, r.cancelled_at, r.requested_at),
  r.accepted_at,
  r.started_at,
  r.completed_at,
  r.cancelled_at
FROM `rides` r
WHERE NOT EXISTS (
  SELECT 1
  FROM `trips` t
  WHERE t.id = CONCAT('trip_', r.id)
);

