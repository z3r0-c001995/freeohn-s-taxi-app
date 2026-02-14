import type { UserRole } from "../../../shared/ride-hailing";
import { rideConfig, supportConfig } from "../core/config";
import { createShareToken } from "../core/crypto";
import { logger } from "../observability/logger";
import { incrementMetric } from "../observability/metrics";
import { platformStore } from "../platform/store";

export class SafetyService {
  createTripShareToken(input: { tripId: string; createdByUserId: string }) {
    const trip = platformStore.getTripById(input.tripId);
    if (!trip) {
      throw new Error("Trip not found");
    }
    const now = Date.now();
    const expiresAt = new Date(now + rideConfig.tripShareTokenTtlMs).toISOString();
    const token = createShareToken();
    const record = platformStore.createTripShareToken({
      tripId: input.tripId,
      createdByUserId: input.createdByUserId,
      token,
      expiresAt,
      revokedAt: null,
    });

    incrementMetric("safety.share_token.created");
    return {
      token: record.token,
      expiresAt: record.expiresAt,
      url: `/api/share/${record.token}`,
    };
  }

  revokeShareToken(token: string, requestedByUserId: string) {
    const record = platformStore.getTripShareToken(token);
    if (!record) {
      throw new Error("Share token not found");
    }
    if (record.createdByUserId !== requestedByUserId) {
      throw new Error("Not allowed to revoke this token");
    }
    const updated = platformStore.revokeTripShareToken(token);
    incrementMetric("safety.share_token.revoked");
    return updated;
  }

  resolveShareToken(token: string) {
    const record = platformStore.getTripShareToken(token);
    if (!record) {
      throw new Error("Share token not found");
    }
    if (record.revokedAt) {
      throw new Error("Share token revoked");
    }
    if (new Date(record.expiresAt).getTime() < Date.now()) {
      throw new Error("Share token expired");
    }

    const trip = platformStore.getTripById(record.tripId);
    if (!trip) {
      throw new Error("Trip not found");
    }
    const driver = trip.driverId ? platformStore.getDriverById(trip.driverId) : null;
    const driverStatus = trip.driverId ? platformStore.getDriverStatus(trip.driverId) : null;

    // Keep shared payload privacy-focused: no rider PII.
    return {
      trip: {
        id: trip.id,
        state: trip.state,
        pickupAddress: trip.pickup.address,
        dropoffAddress: trip.dropoff.address,
        createdAt: trip.createdAt,
      },
      driver: driver
        ? {
            driverId: driver.driverId,
            rating: driver.rating,
            vehicle: driver.vehicle,
            location: driverStatus?.lat != null && driverStatus?.lng != null
              ? { lat: driverStatus.lat, lng: driverStatus.lng }
              : null,
          }
        : null,
    };
  }

  reportIncident(input: {
    tripId: string;
    reporterUserId: string;
    reporterRole: UserRole;
    category: "SOS" | "SUPPORT";
    description: string;
  }) {
    const incident = platformStore.createSafetyIncident({
      tripId: input.tripId,
      reporterUserId: input.reporterUserId,
      reporterRole: input.reporterRole,
      category: input.category,
      status: "OPEN",
      description: input.description,
    });

    incrementMetric(`safety.incident.${input.category.toLowerCase()}`);
    logger.warn("safety.incident.created", {
      incidentId: incident.id,
      tripId: input.tripId,
      category: input.category,
    });

    return {
      incidentId: incident.id,
      status: incident.status,
      support: {
        email: supportConfig.email,
        phone: supportConfig.phone,
        emergencyPhone: supportConfig.emergencyPhone,
      },
    };
  }
}

export const safetyService = new SafetyService();

