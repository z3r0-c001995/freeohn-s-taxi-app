import { beforeEach, describe, expect, it } from "vitest";
import { collectMetrics } from "../server/modules/observability/metrics";
import { platformStore } from "../server/modules/platform/store";
import { tripService } from "../server/modules/trips/trip.service";

const ownerAdmin = { id: 1, role: "admin" as const };
const driverUser = { id: 3101, role: "driver" as const };

describe("Driver location anti-spoof guard", () => {
  beforeEach(() => {
    platformStore.reset();
  });

  it("rejects implausible location jumps", async () => {
    const profile = tripService.registerDriverByAdmin(ownerAdmin, driverUser.id, {
      vehicleMake: "Toyota",
      vehicleModel: "Vitz",
      vehicleColor: "Silver",
      plateNumber: "SPF120",
      verified: true,
    });
    tripService.verifyDriver(profile.driverId, true);

    tripService.setDriverStatus(driverUser, {
      isOnline: true,
      lat: -15.4162,
      lng: 28.3115,
    });

    // Short wait ensures elapsed time is tiny, making a long jump implausible.
    await new Promise((resolve) => setTimeout(resolve, 25));

    expect(() =>
      tripService.updateDriverLocation(driverUser, {
        lat: -15.2062,
        lng: 28.6115,
        speed: 120, // m/s
      }),
    ).toThrow("Suspicious location update rejected");

    const status = platformStore.getDriverStatus(profile.driverId);
    expect(status?.lat).toBeCloseTo(-15.4162, 4);
    expect(status?.lng).toBeCloseTo(28.3115, 4);

    const metrics = collectMetrics();
    expect((metrics.counters["driver.location.rejected.spoof"] ?? 0) > 0).toBe(true);
  });
});
