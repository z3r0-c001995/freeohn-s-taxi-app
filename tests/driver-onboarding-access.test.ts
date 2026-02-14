import { beforeEach, describe, expect, it } from "vitest";
import { platformStore } from "../server/modules/platform/store";
import { tripService } from "../server/modules/trips/trip.service";

const ownerAdmin = { id: 1, role: "admin" as const };
const riderUser = { id: 1001, role: "rider" as const };
const driverUser = { id: 2001, role: "driver" as const };

const driverProfilePayload = {
  vehicleMake: "Toyota",
  vehicleModel: "Prius",
  vehicleColor: "Silver",
  plateNumber: "KAA111A",
};

const tripPayload = {
  pickup: { lat: -1.286389, lng: 36.817223 },
  dropoff: { lat: -1.292066, lng: 36.821945 },
  pickupAddress: "CBD",
  dropoffAddress: "Upper Hill",
  distanceMeters: 2600,
  durationSeconds: 700,
  rideType: "standard" as const,
  paymentMethod: "CASH" as const,
  idempotencyKey: "rider-only-create-trip",
};

describe("Driver onboarding and access control", () => {
  beforeEach(() => {
    platformStore.reset();
  });

  it("allows only company owner/admin to register drivers", () => {
    expect(() =>
      tripService.registerDriverByAdmin(riderUser, driverUser.id, {
        ...driverProfilePayload,
      }),
    ).toThrow("Role rider cannot perform this operation");

    const profile = tripService.registerDriverByAdmin(ownerAdmin, driverUser.id, {
      ...driverProfilePayload,
    });
    expect(profile.userId).toBe(driverUser.id);
    expect(profile.verified).toBe(false);
  });

  it("blocks unverified drivers from going online", () => {
    const profile = tripService.registerDriverByAdmin(ownerAdmin, driverUser.id, {
      ...driverProfilePayload,
      verified: false,
    });
    expect(profile.verified).toBe(false);

    expect(() =>
      tripService.setDriverStatus(driverUser, {
        isOnline: true,
        lat: -1.2868,
        lng: 36.8178,
      }),
    ).toThrow("Driver must be verified before going online");

    tripService.verifyDriver(profile.driverId, true);
    const status = tripService.setDriverStatus(driverUser, {
      isOnline: true,
      lat: -1.2868,
      lng: 36.8178,
    });
    expect(status.isOnline).toBe(true);
  });

  it("allows only service seekers (riders) to create trips", async () => {
    await expect(tripService.createTrip(driverUser, tripPayload)).rejects.toThrow(
      "Role driver cannot perform this operation",
    );
    await expect(tripService.createTrip(riderUser, tripPayload)).resolves.toBeTruthy();
  });
});
