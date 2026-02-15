import type { DriverProfileRecord, DriverStatusRecord, TripEventRecord, TripRecord, UserRole } from "../../../shared/ride-hailing";
import { createId } from "../core/crypto";
import {
  boundsForRadius,
  geoCell,
  geoCellsForBounds,
  isWithinBounds,
  type GeoBounds,
} from "../dispatch/geo";
import type {
  DriverDispatchOffer,
  DriverRatingRecord,
  IdempotencyEntry,
  PlatformSnapshot,
  SafetyIncidentRecord,
  TripLocationRecord,
  TripShareTokenRecord,
  TripStartPinRecord,
} from "./types";

type LockResolver = () => void;

class InMemoryRidePlatformStore {
  private readonly drivers = new Map<string, DriverProfileRecord>();
  private readonly driverStatus = new Map<string, DriverStatusRecord>();
  private readonly trips = new Map<string, TripRecord>();
  private readonly tripEvents = new Map<string, TripEventRecord>();
  private readonly dispatchOffers = new Map<string, DriverDispatchOffer>();
  private readonly tripLocations = new Map<string, TripLocationRecord>();
  private readonly safetyIncidents = new Map<string, SafetyIncidentRecord>();
  private readonly tripShareTokens = new Map<string, TripShareTokenRecord>();
  private readonly ratings = new Map<string, DriverRatingRecord>();
  private readonly tripPins = new Map<string, TripStartPinRecord>();
  private readonly idempotency = new Map<string, IdempotencyEntry>();
  private readonly lockQueue = new Map<string, Promise<void>>();
  private readonly driverGeoCellById = new Map<string, string>();
  private readonly driverIdsByGeoCell = new Map<string, Set<string>>();

  private removeDriverFromGeoIndex(driverId: string): void {
    const currentCell = this.driverGeoCellById.get(driverId);
    if (!currentCell) return;
    const bucket = this.driverIdsByGeoCell.get(currentCell);
    if (bucket) {
      bucket.delete(driverId);
      if (bucket.size === 0) {
        this.driverIdsByGeoCell.delete(currentCell);
      }
    }
    this.driverGeoCellById.delete(driverId);
  }

  private upsertDriverGeoIndex(status: DriverStatusRecord): void {
    this.removeDriverFromGeoIndex(status.driverId);

    if (!status.isOnline || status.lat == null || status.lng == null) {
      return;
    }

    const nextCell = geoCell(status.lat, status.lng);
    const bucket = this.driverIdsByGeoCell.get(nextCell) ?? new Set<string>();
    bucket.add(status.driverId);
    this.driverIdsByGeoCell.set(nextCell, bucket);
    this.driverGeoCellById.set(status.driverId, nextCell);
  }

  async withLock<T>(key: string, callback: () => Promise<T> | T): Promise<T> {
    const queue = this.lockQueue.get(key) ?? Promise.resolve();
    let release: LockResolver = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.lockQueue.set(key, queue.then(() => gate));

    await queue;
    try {
      return await callback();
    } finally {
      release();
      if (this.lockQueue.get(key) === gate) {
        this.lockQueue.delete(key);
      }
    }
  }

  upsertDriverProfile(profile: DriverProfileRecord): DriverProfileRecord {
    this.drivers.set(profile.driverId, profile);
    if (!this.driverStatus.has(profile.driverId)) {
      this.driverStatus.set(profile.driverId, {
        driverId: profile.driverId,
        isOnline: false,
        lastSeenAt: new Date().toISOString(),
        lat: null,
        lng: null,
        activeTripId: null,
      });
    }
    return profile;
  }

  getDriverById(driverId: string): DriverProfileRecord | null {
    return this.drivers.get(driverId) ?? null;
  }

  getDriverByUserId(userId: number): DriverProfileRecord | null {
    const found = Array.from(this.drivers.values()).find((driver) => driver.userId === userId);
    return found ?? null;
  }

  listDrivers(): DriverProfileRecord[] {
    return Array.from(this.drivers.values());
  }

  setDriverStatus(driverId: string, patch: Partial<DriverStatusRecord>): DriverStatusRecord {
    const current = this.driverStatus.get(driverId) ?? {
      driverId,
      isOnline: false,
      lastSeenAt: new Date().toISOString(),
      lat: null,
      lng: null,
      activeTripId: null,
    };
    const next: DriverStatusRecord = {
      ...current,
      ...patch,
      lastSeenAt: patch.lastSeenAt ?? new Date().toISOString(),
    };
    this.driverStatus.set(driverId, next);
    this.upsertDriverGeoIndex(next);
    return next;
  }

  getDriverStatus(driverId: string): DriverStatusRecord | null {
    return this.driverStatus.get(driverId) ?? null;
  }

  listDriverStatus(): DriverStatusRecord[] {
    return Array.from(this.driverStatus.values());
  }

  listDriverStatusInBounds(bounds: GeoBounds): DriverStatusRecord[] {
    const cells = geoCellsForBounds(bounds);
    const driverIds = new Set<string>();

    for (const cell of cells) {
      const bucket = this.driverIdsByGeoCell.get(cell);
      if (!bucket) continue;
      for (const driverId of bucket.values()) {
        driverIds.add(driverId);
      }
    }

    return Array.from(driverIds.values())
      .map((driverId) => this.driverStatus.get(driverId) ?? null)
      .filter((status): status is DriverStatusRecord => !!status)
      .filter((status) => status.isOnline && status.lat != null && status.lng != null)
      .filter((status) => isWithinBounds(status.lat as number, status.lng as number, bounds));
  }

  listDriverStatusNear(lat: number, lng: number, radiusKm: number): DriverStatusRecord[] {
    const bounds = boundsForRadius(lat, lng, radiusKm);
    return this.listDriverStatusInBounds(bounds);
  }

  createTrip(trip: TripRecord): TripRecord {
    this.trips.set(trip.id, trip);
    return trip;
  }

  updateTrip(tripId: string, patch: Partial<TripRecord>): TripRecord {
    const current = this.trips.get(tripId);
    if (!current) {
      throw new Error(`Trip not found: ${tripId}`);
    }
    const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
    this.trips.set(tripId, next);
    return next;
  }

  getTripById(tripId: string): TripRecord | null {
    return this.trips.get(tripId) ?? null;
  }

  listTripsForRider(riderId: number): TripRecord[] {
    return Array.from(this.trips.values())
      .filter((trip) => trip.riderId === riderId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  listTripsForDriver(driverId: string): TripRecord[] {
    return Array.from(this.trips.values())
      .filter((trip) => trip.driverId === driverId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  createTripEvent(event: Omit<TripEventRecord, "id" | "createdAt">): TripEventRecord {
    const created: TripEventRecord = {
      id: createId("trip_evt"),
      createdAt: new Date().toISOString(),
      ...event,
    };
    this.tripEvents.set(created.id, created);
    return created;
  }

  listTripEvents(tripId: string): TripEventRecord[] {
    return Array.from(this.tripEvents.values())
      .filter((event) => event.tripId === tripId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  createDispatchOffer(offer: DriverDispatchOffer): DriverDispatchOffer {
    this.dispatchOffers.set(offer.id, offer);
    return offer;
  }

  updateDispatchOffer(offerId: string, patch: Partial<DriverDispatchOffer>): DriverDispatchOffer {
    const current = this.dispatchOffers.get(offerId);
    if (!current) {
      throw new Error(`Dispatch offer not found: ${offerId}`);
    }
    const next = { ...current, ...patch };
    this.dispatchOffers.set(offerId, next);
    return next;
  }

  getDispatchOffer(offerId: string): DriverDispatchOffer | null {
    return this.dispatchOffers.get(offerId) ?? null;
  }

  listDispatchOffersForTrip(tripId: string): DriverDispatchOffer[] {
    return Array.from(this.dispatchOffers.values())
      .filter((offer) => offer.tripId === tripId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  listDispatchOffersForDriver(driverId: string): DriverDispatchOffer[] {
    return Array.from(this.dispatchOffers.values())
      .filter((offer) => offer.driverId === driverId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  createTripLocation(location: Omit<TripLocationRecord, "id" | "createdAt">): TripLocationRecord {
    const created: TripLocationRecord = {
      id: createId("trip_loc"),
      createdAt: new Date().toISOString(),
      ...location,
    };
    this.tripLocations.set(created.id, created);
    return created;
  }

  listTripLocations(tripId: string, limit = 200): TripLocationRecord[] {
    return Array.from(this.tripLocations.values())
      .filter((loc) => loc.tripId === tripId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }

  createSafetyIncident(incident: Omit<SafetyIncidentRecord, "id" | "createdAt">): SafetyIncidentRecord {
    const created: SafetyIncidentRecord = {
      id: createId("incident"),
      createdAt: new Date().toISOString(),
      ...incident,
    };
    this.safetyIncidents.set(created.id, created);
    return created;
  }

  listSafetyIncidentsForTrip(tripId: string): SafetyIncidentRecord[] {
    return Array.from(this.safetyIncidents.values()).filter((incident) => incident.tripId === tripId);
  }

  createTripShareToken(record: Omit<TripShareTokenRecord, "id" | "createdAt">): TripShareTokenRecord {
    const created: TripShareTokenRecord = {
      id: createId("share"),
      createdAt: new Date().toISOString(),
      ...record,
    };
    this.tripShareTokens.set(created.id, created);
    return created;
  }

  getTripShareToken(token: string): TripShareTokenRecord | null {
    const found = Array.from(this.tripShareTokens.values()).find((item) => item.token === token);
    return found ?? null;
  }

  revokeTripShareToken(token: string): TripShareTokenRecord | null {
    const existing = this.getTripShareToken(token);
    if (!existing) return null;
    const next = {
      ...existing,
      revokedAt: new Date().toISOString(),
    };
    this.tripShareTokens.set(next.id, next);
    return next;
  }

  createRating(record: Omit<DriverRatingRecord, "id" | "createdAt">): DriverRatingRecord {
    const created: DriverRatingRecord = {
      id: createId("rating"),
      createdAt: new Date().toISOString(),
      ...record,
    };
    this.ratings.set(created.id, created);
    return created;
  }

  listDriverRatings(driverId: string): DriverRatingRecord[] {
    return Array.from(this.ratings.values())
      .filter((rating) => rating.driverId === driverId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  getRatingForTrip(tripId: string): DriverRatingRecord | null {
    return Array.from(this.ratings.values()).find((rating) => rating.tripId === tripId) ?? null;
  }

  saveTripStartPin(pin: TripStartPinRecord): void {
    this.tripPins.set(pin.tripId, pin);
  }

  getTripStartPin(tripId: string): TripStartPinRecord | null {
    return this.tripPins.get(tripId) ?? null;
  }

  deleteTripStartPin(tripId: string): void {
    this.tripPins.delete(tripId);
  }

  saveIdempotency(entry: IdempotencyEntry): void {
    this.idempotency.set(`${entry.action}:${entry.key}`, entry);
  }

  getIdempotency(action: string, key: string): IdempotencyEntry | null {
    return this.idempotency.get(`${action}:${key}`) ?? null;
  }

  appendTripAudit(
    tripId: string,
    fromState: TripRecord["state"] | null,
    toState: TripRecord["state"],
    actorId: string,
    actorRole: UserRole,
    reason?: string,
    meta?: Record<string, unknown>,
  ): TripEventRecord {
    return this.createTripEvent({
      tripId,
      fromState,
      toState,
      actorId,
      actorRole,
      reason,
      meta,
    });
  }

  getSnapshot(): PlatformSnapshot {
    return {
      drivers: this.listDrivers(),
      driverStatus: this.listDriverStatus(),
      trips: Array.from(this.trips.values()),
      tripEvents: Array.from(this.tripEvents.values()),
      dispatchOffers: Array.from(this.dispatchOffers.values()),
      tripLocations: Array.from(this.tripLocations.values()),
      tripShareTokens: Array.from(this.tripShareTokens.values()),
      safetyIncidents: Array.from(this.safetyIncidents.values()),
      ratings: Array.from(this.ratings.values()),
    };
  }

  reset(): void {
    this.drivers.clear();
    this.driverStatus.clear();
    this.trips.clear();
    this.tripEvents.clear();
    this.dispatchOffers.clear();
    this.tripLocations.clear();
    this.safetyIncidents.clear();
    this.tripShareTokens.clear();
    this.ratings.clear();
    this.tripPins.clear();
    this.idempotency.clear();
    this.lockQueue.clear();
    this.driverGeoCellById.clear();
    this.driverIdsByGeoCell.clear();
  }
}

export const platformStore = new InMemoryRidePlatformStore();
