import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createServer, type Server as HttpServer } from "http";
import { io as createClient, type Socket } from "socket.io-client";
import type { AddressInfo } from "net";
import { registerRealtimeGateway } from "../server/modules/location/socket.gateway";
import { platformStore } from "../server/modules/platform/store";
import { tripService } from "../server/modules/trips/trip.service";

const riderUser = { id: 1701, role: "rider" as const };
const driverUser = { id: 2701, role: "driver" as const };
const adminUser = { id: 1, role: "admin" as const };

const tripPayload = {
  pickup: { lat: -15.4154, lng: 28.2862 },
  dropoff: { lat: -15.4303, lng: 28.3075 },
  pickupAddress: "Lusaka CBD",
  dropoffAddress: "East Park Mall",
  distanceMeters: 5400,
  durationSeconds: 900,
  rideType: "standard" as const,
  paymentMethod: "CASH" as const,
};

async function waitFor<T>(fn: () => T | null, timeoutMs = 2500): Promise<T> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const value = fn();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("Timed out waiting for realtime event");
}

describe("Realtime socket gateway", () => {
  let server: HttpServer | null = null;
  let socket: Socket | null = null;
  let closeGateway: (() => Promise<void>) | null = null;

  beforeEach(() => {
    platformStore.reset();
  });

  afterEach(async () => {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
    if (closeGateway) {
      await closeGateway();
      closeGateway = null;
    }
    if (server) {
      await new Promise<void>((resolve) => server?.close(() => resolve()));
      server = null;
    }
  });

  it("pushes driver location updates over websocket to subscribed rider", async () => {
    const profile = tripService.registerDriverByAdmin(adminUser, driverUser.id, {
      vehicleMake: "Toyota",
      vehicleModel: "Vitz",
      vehicleColor: "Silver",
      plateNumber: "ALX120",
      verified: true,
    });
    tripService.verifyDriver(profile.driverId, true);
    tripService.setDriverStatus(driverUser, {
      isOnline: true,
      lat: -15.416,
      lng: 28.287,
    });

    const trip = await tripService.createTrip(riderUser, {
      ...tripPayload,
      idempotencyKey: "realtime-socket-trip-1",
    });
    const offer = await waitFor(() => tripService.listDriverRequests(driverUser)[0] ?? null);
    await tripService.respondDriverRequest(driverUser, offer.id, true);

    server = createServer((_req, res) => {
      res.statusCode = 200;
      res.end("ok");
    });
    const gateway = registerRealtimeGateway(server, []);
    closeGateway = async () =>
      new Promise<void>((resolve) => {
        gateway.close(() => resolve());
      });

    await new Promise<void>((resolve) => server?.listen(0, () => resolve()));
    const port = (server.address() as AddressInfo).port;

    socket = createClient(`http://127.0.0.1:${port}`, {
      transports: ["websocket"],
      auth: {
        devUserId: String(riderUser.id),
        devUserRole: riderUser.role,
      },
      timeout: 2000,
    });

    await new Promise<void>((resolve, reject) => {
      socket?.once("connect", () => resolve());
      socket?.once("connect_error", (error) => reject(error));
    });

    await new Promise<void>((resolve, reject) => {
      socket?.emit("trip:subscribe", { tripId: trip.id }, (ack?: { ok?: boolean; error?: string }) => {
        if (!ack?.ok) {
          reject(new Error(ack?.error || "Subscription failed"));
          return;
        }
        resolve();
      });
    });

    const events: Array<Record<string, unknown>> = [];
    socket.on("trip:event", (event) => {
      events.push(event as Record<string, unknown>);
    });

    tripService.updateDriverLocation(driverUser, {
      tripId: trip.id,
      lat: -15.4177,
      lng: 28.2955,
      heading: 42,
      speed: 8.4,
    });

    const locationEvent = await waitFor(() => {
      return (
        events.find((event) => event.type === "driver.location") as
          | { type: "driver.location"; tripId: string; lat: number; lng: number; heading: number; speed: number }
          | undefined
      ) ?? null;
    });

    expect(locationEvent.type).toBe("driver.location");
    expect(locationEvent.tripId).toBe(trip.id);
    expect(locationEvent.lat).toBeCloseTo(-15.4177, 4);
    expect(locationEvent.lng).toBeCloseTo(28.2955, 4);
    expect(locationEvent.heading).toBe(42);
  });
});
