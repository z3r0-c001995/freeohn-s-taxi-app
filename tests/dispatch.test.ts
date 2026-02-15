import { beforeEach, describe, expect, it } from "vitest";
import { platformStore } from "../server/modules/platform/store";
import { tripService } from "../server/modules/trips/trip.service";

const riderUser = { id: 501, role: "rider" as const };
const driverUser = { id: 701, role: "driver" as const };
const staleDriverUser = { id: 702, role: "driver" as const };
const freshDriverUser = { id: 703, role: "driver" as const };
const ownerAdmin = { id: 1, role: "admin" as const };

const baseTripPayload = {
  pickup: { lat: -1.286389, lng: 36.817223 },
  dropoff: { lat: -1.292066, lng: 36.821945 },
  pickupAddress: "Kenyatta Ave",
  dropoffAddress: "Upper Hill",
  distanceMeters: 3400,
  durationSeconds: 900,
  rideType: "standard" as const,
  paymentMethod: "CASH" as const,
};

async function waitFor<T>(fn: () => T | null, timeoutMs = 1500): Promise<T> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const value = fn();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("Timeout waiting for condition");
}

describe("Dispatch service", () => {
  beforeEach(() => {
    platformStore.reset();
  });

  it("matches nearest verified online driver and assigns trip", async () => {
    const profile = tripService.registerDriverByAdmin(ownerAdmin, driverUser.id, {
      vehicleMake: "Toyota",
      vehicleModel: "Aqua",
      vehicleColor: "Blue",
      plateNumber: "KDA123A",
      verified: true,
    });
    tripService.verifyDriver(profile.driverId, true);
    tripService.setDriverStatus(driverUser, {
      isOnline: true,
      lat: -1.2868,
      lng: 36.8177,
    });

    const trip = await tripService.createTrip(riderUser, {
      ...baseTripPayload,
      idempotencyKey: "dispatch-match-1",
    });

    const request = await waitFor(() => {
      const pending = tripService.listDriverRequests(driverUser);
      return pending[0] ?? null;
    });

    await tripService.respondDriverRequest(driverUser, request.id, true);

    const assigned = tripService.getTrip(riderUser, trip.id);
    expect(assigned.state).toBe("DRIVER_ASSIGNED");
    expect(assigned.driver?.driverId).toBe(profile.driverId);
  });

  it("moves trip to NO_DRIVER_FOUND when no eligible drivers are online", async () => {
    const trip = await tripService.createTrip(riderUser, {
      ...baseTripPayload,
      idempotencyKey: "dispatch-no-driver-1",
    });

    const noDriverTrip = await waitFor(() => {
      const current = tripService.getTrip(riderUser, trip.id);
      return current.state === "NO_DRIVER_FOUND" ? current : null;
    });

    expect(noDriverTrip.state).toBe("NO_DRIVER_FOUND");
  });

  it("skips stale drivers and offers trip to fresh nearby drivers", async () => {
    const staleProfile = tripService.registerDriverByAdmin(ownerAdmin, staleDriverUser.id, {
      vehicleMake: "Toyota",
      vehicleModel: "Aqua",
      vehicleColor: "Gray",
      plateNumber: "STL001",
      verified: true,
    });
    const freshProfile = tripService.registerDriverByAdmin(ownerAdmin, freshDriverUser.id, {
      vehicleMake: "Honda",
      vehicleModel: "Fit",
      vehicleColor: "White",
      plateNumber: "FRH001",
      verified: true,
    });
    tripService.verifyDriver(staleProfile.driverId, true);
    tripService.verifyDriver(freshProfile.driverId, true);

    tripService.setDriverStatus(staleDriverUser, {
      isOnline: true,
      lat: -1.2865,
      lng: 36.8173,
    });
    platformStore.setDriverStatus(staleProfile.driverId, {
      lastSeenAt: new Date(Date.now() - 25_000).toISOString(),
    });

    tripService.setDriverStatus(freshDriverUser, {
      isOnline: true,
      lat: -1.2875,
      lng: 36.8185,
    });

    const trip = await tripService.createTrip(riderUser, {
      ...baseTripPayload,
      idempotencyKey: "dispatch-stale-filter-1",
    });

    const freshOffer = await waitFor(() => tripService.listDriverRequests(freshDriverUser)[0] ?? null);
    expect(freshOffer.tripId).toBe(trip.id);

    expect(tripService.listDriverRequests(staleDriverUser)).toHaveLength(0);
    expect(platformStore.getDriverStatus(staleProfile.driverId)?.isOnline).toBe(false);
  });
});
