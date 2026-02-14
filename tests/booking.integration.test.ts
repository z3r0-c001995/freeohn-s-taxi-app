import { beforeEach, describe, expect, it } from "vitest";
import { platformStore } from "../server/modules/platform/store";
import { tripService } from "../server/modules/trips/trip.service";

const riderUser = { id: 1101, role: "rider" as const };
const driverUser = { id: 2201, role: "driver" as const };
const ownerAdmin = { id: 1, role: "admin" as const };

const tripPayload = {
  pickup: { lat: -1.286389, lng: 36.817223 },
  dropoff: { lat: -1.292066, lng: 36.821945 },
  pickupAddress: "Nairobi CBD",
  dropoffAddress: "Upper Hill",
  distanceMeters: 4500,
  durationSeconds: 1100,
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

describe("Booking flow integration", () => {
  beforeEach(() => {
    platformStore.reset();
  });

  it("supports create -> match -> arrive -> start -> complete -> rate", async () => {
    const profile = tripService.registerDriverByAdmin(ownerAdmin, driverUser.id, {
      vehicleMake: "Honda",
      vehicleModel: "Fit",
      vehicleColor: "White",
      plateNumber: "KDD456B",
      verified: true,
    });
    tripService.verifyDriver(profile.driverId, true);
    tripService.setDriverStatus(driverUser, {
      isOnline: true,
      lat: -1.2867,
      lng: 36.8179,
    });

    const trip = await tripService.createTrip(riderUser, {
      ...tripPayload,
      idempotencyKey: "integration-trip-1",
    });

    const request = await waitFor(() => tripService.listDriverRequests(driverUser)[0] ?? null);
    await tripService.respondDriverRequest(driverUser, request.id, true);

    const assignedTrip = tripService.getTrip(riderUser, trip.id);
    expect(assignedTrip.state).toBe("DRIVER_ASSIGNED");

    await tripService.driverArrived(driverUser, trip.id);
    const riderTripAfterArrival = tripService.getTrip(riderUser, trip.id);
    expect(["DRIVER_ARRIVING", "PIN_VERIFICATION"]).toContain(riderTripAfterArrival.state);

    const pin = riderTripAfterArrival.startPin ?? undefined;
    const startedTrip = await tripService.startTrip(driverUser, trip.id, pin);
    expect(startedTrip.state).toBe("IN_PROGRESS");

    const completion = await tripService.completeTrip(driverUser, trip.id);
    expect(completion.trip.state).toBe("COMPLETED");
    expect(completion.payment.method).toBe("CASH");

    const rating = tripService.submitTripRating(riderUser, trip.id, 5, "Smooth ride");
    expect(rating.driverRating).toBeGreaterThan(0);
  });
});
