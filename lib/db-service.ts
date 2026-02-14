import { getDatabase } from "./db";

// ============ USER OPERATIONS ============

export async function createUser(
  openId: string,
  name: string,
  email?: string,
  loginMethod?: string,
  role: "rider" | "driver" | "admin" = "rider"
) {
  const db = getDatabase();
  const userId = Date.now(); // Use timestamp as number ID

  await db.runAsync(
    `INSERT OR REPLACE INTO users (id, phone, name, email, role, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [userId.toString(), openId, name, email || null, role]
  );

  return {
    id: userId,
    openId,
    name,
    email: email || null,
    loginMethod: loginMethod || null,
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
}

export async function getUserByOpenId(openId: string) {
  const db = getDatabase();
  const result = await db.getFirstAsync(
    `SELECT * FROM users WHERE phone = ?`,
    [openId]
  );
  if (!result) return null;

  return {
    id: parseInt((result as any).id),
    openId: (result as any).phone,
    name: (result as any).name,
    email: (result as any).email,
    loginMethod: null,
    role: (result as any).role,
    createdAt: new Date((result as any).created_at),
    updatedAt: new Date((result as any).updated_at),
    lastSignedIn: new Date((result as any).updated_at),
  };
}

export async function getUserById(id: string) {
  const db = getDatabase();
  const result = await db.getFirstAsync(
    `SELECT * FROM users WHERE id = ?`,
    [id]
  );
  if (!result) return null;

  return {
    id: parseInt((result as any).id),
    openId: (result as any).phone,
    name: (result as any).name,
    email: (result as any).email,
    loginMethod: null,
    role: (result as any).role,
    createdAt: new Date((result as any).created_at),
    updatedAt: new Date((result as any).updated_at),
    lastSignedIn: new Date((result as any).updated_at),
  };
}

// ============ DRIVER PROFILE OPERATIONS ============

export async function createDriverProfile(
  userId: string,
  vehicleMake: string,
  vehicleModel: string,
  plateNumber: string,
  licenseNumber: string
) {
  const db = getDatabase();
  const profileId = Date.now(); // Use timestamp as number ID

  await db.runAsync(
    `INSERT OR REPLACE INTO driver_profiles
     (id, user_id, vehicle_type, vehicle_number, license_number, created_at)
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [profileId.toString(), userId, `${vehicleMake} ${vehicleModel}`, plateNumber, licenseNumber]
  );

  return {
    id: profileId,
    userId: parseInt(userId),
    vehicleMake,
    vehicleModel,
    plateNumber,
    licenseNumber,
    isOnline: false,
    currentLat: null,
    currentLng: null,
    totalEarnings: 0,
    totalTrips: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export async function getDriverProfile(userId: string) {
  const db = getDatabase();
  const result = await db.getFirstAsync(
    `SELECT * FROM driver_profiles WHERE user_id = ?`,
    [userId]
  ) as any;
  if (!result) return null;

  // Map snake_case to camelCase
  return {
    id: parseInt(result.id),
    createdAt: new Date(result.created_at),
    updatedAt: new Date(result.updated_at),
    userId: parseInt(result.user_id),
    vehicleMake: result.vehicle_type?.split(' ')[0] || null,
    vehicleModel: result.vehicle_type?.split(' ').slice(1).join(' ') || null,
    plateNumber: result.vehicle_number,
    licenseNumber: result.license_number,
    isOnline: result.is_online === 1,
    currentLat: result.current_latitude?.toString() || null,
    currentLng: result.current_longitude?.toString() || null,
    totalEarnings: result.total_earnings || 0,
    totalTrips: result.total_trips || 0,
  };
}

export async function updateDriverLocation(
  userId: string,
  latitude: number,
  longitude: number
) {
  const db = getDatabase();
  await db.runAsync(
    `UPDATE driver_profiles SET current_latitude = ?, current_longitude = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
    [latitude, longitude, userId]
  );
}

export async function setDriverOnlineStatus(userId: string, isOnline: boolean) {
  const db = getDatabase();
  await db.runAsync(
    `UPDATE driver_profiles SET is_online = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
    [isOnline ? 1 : 0, userId]
  );
}

export async function getOnlineDrivers() {
  const db = getDatabase();
  const results = await db.getAllAsync(`
    SELECT dp.*, u.id as user_id, u.phone, u.name, u.email, u.role, u.created_at as user_created_at, u.updated_at as user_updated_at
    FROM driver_profiles dp
    JOIN users u ON dp.user_id = u.id
    WHERE dp.is_online = 1
  `) as any[];

  return (results || []).map(row => ({
    id: parseInt(row.id),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    userId: parseInt(row.user_id),
    vehicleMake: row.vehicle_type?.split(' ')[0] || null,
    vehicleModel: row.vehicle_type?.split(' ').slice(1).join(' ') || null,
    plateNumber: row.vehicle_number,
    licenseNumber: row.license_number,
    isOnline: row.is_online === 1,
    currentLat: row.current_latitude?.toString() || null,
    currentLng: row.current_longitude?.toString() || null,
    totalEarnings: row.total_earnings || 0,
    totalTrips: row.total_trips || 0,
    user: {
      id: parseInt(row.user_id),
      openId: row.phone,
      name: row.name,
      email: row.email,
      loginMethod: null,
      role: row.role,
      createdAt: new Date(row.user_created_at),
      updatedAt: new Date(row.user_updated_at),
      lastSignedIn: new Date(row.user_updated_at),
    },
    distance: 0, // Will be calculated later
  }));
}

// ============ RIDE OPERATIONS ============

export async function createRide(
  riderId: string,
  pickupLat: number,
  pickupLng: number,
  dropoffLat: number | null,
  dropoffLng: number | null,
  pickupAddress: string,
  dropoffAddress: string | null,
  rideType: "standard" | "premium",
  fareAmount: number,
  distanceMeters?: number,
  durationSeconds?: number,
  encodedPolyline?: string
) {
  const db = getDatabase();
  const rideId = Date.now(); // Use timestamp as number ID

  await db.runAsync(
    `INSERT INTO rides
     (id, rider_id, pickup_latitude, pickup_longitude, dropoff_latitude, dropoff_longitude,
      pickup_address, dropoff_address, ride_type, status, estimated_fare, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [rideId.toString(), riderId, pickupLat, pickupLng, dropoffLat, dropoffLng, pickupAddress, dropoffAddress, rideType, "requested", fareAmount]
  );

  return {
    id: rideId,
    riderId: parseInt(riderId),
    driverId: null,
    pickupLat: pickupLat.toString(),
    pickupLng: pickupLng.toString(),
    dropoffLat: dropoffLat?.toString() || null,
    dropoffLng: dropoffLng?.toString() || null,
    pickupAddress,
    dropoffAddress,
    rideType,
    status: "requested" as const,
    fareAmount: parseFloat(fareAmount.toString()),
    distanceMeters: distanceMeters || null,
    durationSeconds: durationSeconds || null,
    encodedPolyline: encodedPolyline || null,
    requestedAt: new Date(),
    acceptedAt: null,
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    queuedSync: false,
  };
}

export async function acceptRide(rideId: string, driverId: string) {
  const db = getDatabase();
  await db.runAsync(
    `UPDATE rides SET driver_id = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [driverId, "accepted", rideId]
  );
}

export async function startRide(rideId: string) {
  const db = getDatabase();
  await db.runAsync(
    `UPDATE rides SET status = ?, started_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    ["in_progress", rideId]
  );
}

export async function completeRide(rideId: string) {
  const db = getDatabase();
  await db.runAsync(
    `UPDATE rides SET status = ?, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    ["completed", rideId]
  );
}

export async function cancelRide(rideId: string) {
  const db = getDatabase();
  await db.runAsync(
    `UPDATE rides SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    ["cancelled", rideId]
  );
}

export async function getRideById(rideId: string) {
  const db = getDatabase();
  const result = await db.getFirstAsync(
    `SELECT * FROM rides WHERE id = ?`,
    [rideId]
  ) as any;
  if (!result) return null;

  return {
    id: parseInt(result.id),
    riderId: parseInt(result.rider_id),
    driverId: result.driver_id ? parseInt(result.driver_id) : null,
    pickupLat: result.pickup_latitude?.toString() || '',
    pickupLng: result.pickup_longitude?.toString() || '',
    dropoffLat: result.dropoff_latitude?.toString() || null,
    dropoffLng: result.dropoff_longitude?.toString() || null,
    pickupAddress: result.pickup_address,
    dropoffAddress: result.dropoff_address,
    rideType: result.ride_type,
    status: result.status as "requested" | "accepted" | "in_progress" | "completed" | "cancelled",
    fareAmount: parseFloat(result.estimated_fare || '0'),
    distanceMeters: result.distance_km ? result.distance_km * 1000 : null,
    durationSeconds: result.duration_minutes ? result.duration_minutes * 60 : null,
    encodedPolyline: null,
    requestedAt: new Date(result.created_at),
    acceptedAt: result.accepted_at ? new Date(result.accepted_at) : null,
    startedAt: result.started_at ? new Date(result.started_at) : null,
    completedAt: result.completed_at ? new Date(result.completed_at) : null,
    cancelledAt: result.cancelled_at ? new Date(result.cancelled_at) : null,
    queuedSync: false,
  };
}

export async function getActiveRidesForUser(userId: string) {
  const db = getDatabase();
  const results = await db.getAllAsync(
    `SELECT * FROM rides
     WHERE (rider_id = ? OR driver_id = ?)
     AND status IN ('requested', 'accepted', 'in_progress')
     ORDER BY created_at DESC`,
    [userId, userId]
  ) as any[];

  return (results || []).map(result => ({
    id: parseInt(result.id),
    riderId: parseInt(result.rider_id),
    driverId: result.driver_id ? parseInt(result.driver_id) : null,
    pickupLat: result.pickup_latitude?.toString() || '',
    pickupLng: result.pickup_longitude?.toString() || '',
    dropoffLat: result.dropoff_latitude?.toString() || null,
    dropoffLng: result.dropoff_longitude?.toString() || null,
    pickupAddress: result.pickup_address,
    dropoffAddress: result.dropoff_address,
    rideType: result.ride_type,
    status: result.status as "requested" | "accepted" | "in_progress" | "completed" | "cancelled",
    fareAmount: parseFloat(result.estimated_fare || '0'),
    distanceMeters: result.distance_km ? result.distance_km * 1000 : null,
    durationSeconds: result.duration_minutes ? result.duration_minutes * 60 : null,
    encodedPolyline: null,
    requestedAt: new Date(result.created_at),
    acceptedAt: result.accepted_at ? new Date(result.accepted_at) : null,
    startedAt: result.started_at ? new Date(result.started_at) : null,
    completedAt: result.completed_at ? new Date(result.completed_at) : null,
    cancelledAt: result.cancelled_at ? new Date(result.cancelled_at) : null,
    queuedSync: false,
  }));
}

export async function getAvailableRides() {
  const db = getDatabase();
  const results = await db.getAllAsync(
    `SELECT * FROM rides WHERE status = 'requested' ORDER BY created_at ASC`
  ) as any[];

  return (results || []).map(result => ({
    id: parseInt(result.id),
    riderId: parseInt(result.rider_id),
    driverId: result.driver_id ? parseInt(result.driver_id) : null,
    pickupLat: result.pickup_latitude?.toString() || '',
    pickupLng: result.pickup_longitude?.toString() || '',
    dropoffLat: result.dropoff_latitude?.toString() || null,
    dropoffLng: result.dropoff_longitude?.toString() || null,
    pickupAddress: result.pickup_address,
    dropoffAddress: result.dropoff_address,
    rideType: result.ride_type,
    status: result.status as "requested" | "accepted" | "in_progress" | "completed" | "cancelled",
    fareAmount: parseFloat(result.estimated_fare || '0'),
    distanceMeters: result.distance_km ? result.distance_km * 1000 : null,
    durationSeconds: result.duration_minutes ? result.duration_minutes * 60 : null,
    encodedPolyline: null,
    requestedAt: new Date(result.created_at),
    acceptedAt: result.accepted_at ? new Date(result.accepted_at) : null,
    startedAt: result.started_at ? new Date(result.started_at) : null,
    completedAt: result.completed_at ? new Date(result.completed_at) : null,
    cancelledAt: result.cancelled_at ? new Date(result.cancelled_at) : null,
    queuedSync: false,
  }));
}

// ============ DRIVER MATCHING ============

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function findNearestDrivers(
  pickupLat: number,
  pickupLng: number,
  maxDistanceKm: number = 10,
  limit: number = 5
) {
  const onlineDrivers = await getOnlineDrivers();

  const driversWithDistance = onlineDrivers
    .filter(driver => driver.currentLat && driver.currentLng)
    .map(driver => ({
      ...driver,
      distance: haversineDistance(
        pickupLat,
        pickupLng,
        parseFloat(driver.currentLat!),
        parseFloat(driver.currentLng!)
      ),
    }))
    .filter(driver => driver.distance <= maxDistanceKm)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);

  return driversWithDistance;
}

export async function assignDriverToRide(rideId: string, driverId: string) {
  await acceptRide(rideId, driverId);
}

// ============ MESSAGE OPERATIONS ============

export async function createMessage(
  rideId: string,
  senderId: string,
  receiverId: string,
  message: string
) {
  const db = getDatabase();
  const messageId = Date.now(); // Use timestamp as number ID

  await db.runAsync(
    `INSERT INTO messages (id, ride_id, sender_id, receiver_id, message)
     VALUES (?, ?, ?, ?, ?)`,
    [messageId.toString(), rideId, senderId, receiverId, message]
  );

  return {
    id: messageId,
    rideId: parseInt(rideId),
    senderId: parseInt(senderId),
    receiverId: parseInt(receiverId),
    message,
    isRead: false,
    sentAt: new Date(),
  };
}

export async function sendMessage(
  rideId: string,
  senderId: string,
  receiverId: string,
  message: string
) {
  const db = getDatabase();
  const messageId = Date.now(); // Use timestamp as number ID

  await db.runAsync(
    `INSERT INTO messages (id, ride_id, sender_id, receiver_id, message)
     VALUES (?, ?, ?, ?, ?)`,
    [messageId.toString(), rideId, senderId, receiverId, message]
  );

  return {
    id: messageId,
    rideId: parseInt(rideId),
    senderId: parseInt(senderId),
    receiverId: parseInt(receiverId),
    message,
    isRead: false,
    sentAt: new Date(),
  };
}

export async function getMessagesForRide(rideId: string) {
  const db = getDatabase();
  const results = await db.getAllAsync(
    `SELECT * FROM messages WHERE ride_id = ? ORDER BY created_at ASC`,
    [rideId]
  ) as any[];

  return (results || []).map(result => ({
    id: parseInt(result.id),
    rideId: parseInt(result.ride_id),
    senderId: parseInt(result.sender_id),
    receiverId: parseInt(result.receiver_id),
    message: result.message,
    isRead: result.is_read === 1,
    sentAt: new Date(result.created_at),
  }));
}

// ============ LOCATION HISTORY ============

export async function insertLocationHistory(
  userId: string,
  lat: number,
  lng: number,
  heading: number,
  speed: number
) {
  const db = getDatabase();
  const historyId = `loc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  await db.runAsync(
    `INSERT INTO location_history (id, user_id, latitude, longitude, heading, speed)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [historyId, userId, lat, lng, heading, speed]
  );

  return {
    id: historyId,
    userId,
    lat: lat.toString(),
    lng: lng.toString(),
    heading,
    speed,
    timestamp: new Date(),
  };
}

export async function getLocationHistory(
  userId: string,
  limit: number = 100
) {
  const db = getDatabase();
  const results = await db.getAllAsync(
    `SELECT * FROM location_history WHERE user_id = ? ORDER BY timestamp DESC LIMIT ?`,
    [userId, limit]
  );
  return results || [];
}