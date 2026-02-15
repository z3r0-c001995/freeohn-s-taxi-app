import { beforeEach, describe, expect, it } from "vitest";
import { platformStore } from "../server/modules/platform/store";
import { tripService } from "../server/modules/trips/trip.service";

const riderUser = { id: 4101, role: "rider" as const };
const ownerAdmin = { id: 1, role: "admin" as const };
const driverOne = { id: 4201, role: "driver" as const };
const driverTwo = { id: 4202, role: "driver" as const };
const unverifiedDriver = { id: 4203, role: "driver" as const };

describe("Nearby drivers query", () => {
  beforeEach(() => {
    platformStore.reset();
  });

  it("returns only verified, fresh, closest drivers for seeker map", () => {
    const one = tripService.registerDriverByAdmin(ownerAdmin, driverOne.id, {
      vehicleMake: "Toyota",
      vehicleModel: "Aqua",
      vehicleColor: "Blue",
      plateNumber: "NBY001",
      verified: true,
    });
    const two = tripService.registerDriverByAdmin(ownerAdmin, driverTwo.id, {
      vehicleMake: "Honda",
      vehicleModel: "Fit",
      vehicleColor: "White",
      plateNumber: "NBY002",
      verified: true,
    });
    const three = tripService.registerDriverByAdmin(ownerAdmin, unverifiedDriver.id, {
      vehicleMake: "Mazda",
      vehicleModel: "Demio",
      vehicleColor: "Red",
      plateNumber: "NBY003",
      verified: false,
    });
    tripService.verifyDriver(one.driverId, true);
    tripService.verifyDriver(two.driverId, true);
    tripService.verifyDriver(three.driverId, false);

    tripService.setDriverStatus(driverOne, { isOnline: true, lat: -15.4162, lng: 28.3114 });
    tripService.setDriverStatus(driverTwo, { isOnline: true, lat: -15.4262, lng: 28.3314 });
    platformStore.setDriverStatus(three.driverId, {
      isOnline: true,
      lat: -15.4172,
      lng: 28.3124,
    });
    platformStore.setDriverStatus(two.driverId, {
      lastSeenAt: new Date(Date.now() - 30_000).toISOString(),
    });

    const result = tripService.listNearbyDrivers(riderUser, {
      pickup: { lat: -15.4160, lng: 28.3115 },
      radiusKm: 8,
      limit: 10,
    });

    expect(result.drivers).toHaveLength(1);
    expect(result.drivers[0]?.driverId).toBe(one.driverId);
    expect(result.drivers[0]?.vehicle.color).toBe("Blue");
    expect(result.drivers[0]?.distanceMeters).toBeGreaterThanOrEqual(0);
    expect(platformStore.getDriverStatus(two.driverId)?.isOnline).toBe(false);
  });
});
