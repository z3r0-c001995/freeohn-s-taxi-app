import type { Server as HttpServer } from "http";
import type { Request } from "express";
import { Server as SocketIOServer, type Socket } from "socket.io";
import { sdk } from "../../_core/sdk";
import { tripService } from "../trips/trip.service";
import { locationStreamingService } from "./location.service";
import { platformStore } from "../platform/store";
import { logger } from "../observability/logger";
import { userRoleValues, type UserRole } from "../../../shared/ride-hailing";

type AuthUser = {
  id: number;
  role: UserRole;
};

type TripSubscribePayload = {
  tripId?: string;
};

type SocketAck = {
  ok: boolean;
  error?: string;
};

function isOriginAllowed(origin: string, allowList: string[]): boolean {
  if (allowList.length === 0) return true;
  for (const allowed of allowList) {
    if (allowed === "*" || allowed === origin) return true;
    if (allowed.startsWith("*.")) {
      const suffix = allowed.slice(1);
      if (origin.endsWith(suffix)) return true;
    }
  }
  return false;
}

function parseDevUser(socket: Socket): AuthUser | null {
  const allowDevAuth =
    process.env.NODE_ENV !== "production" || process.env.ALLOW_DEV_AUTH_HEADER === "1";
  if (!allowDevAuth) return null;

  const auth = (socket.handshake.auth ?? {}) as Record<string, unknown>;
  const userIdRaw =
    auth.devUserId ??
    socket.handshake.headers["x-dev-user-id"] ??
    socket.handshake.query.devUserId;
  const roleRaw =
    auth.devUserRole ??
    socket.handshake.headers["x-dev-user-role"] ??
    socket.handshake.query.devUserRole;

  if (typeof userIdRaw !== "string" && typeof userIdRaw !== "number") return null;
  if (typeof roleRaw !== "string") return null;

  const id = Number(userIdRaw);
  const role = roleRaw.trim().toLowerCase();
  if (!Number.isFinite(id) || id <= 0) return null;
  if (!userRoleValues.includes(role as UserRole)) return null;

  return { id, role: role as UserRole };
}

async function resolveSocketUser(socket: Socket): Promise<AuthUser | null> {
  const devUser = parseDevUser(socket);
  if (devUser) return devUser;

  const auth = (socket.handshake.auth ?? {}) as Record<string, unknown>;
  const bearerToken = typeof auth.bearerToken === "string" ? auth.bearerToken.trim() : "";

  const headers: Record<string, unknown> = {
    ...socket.handshake.headers,
  };
  if (bearerToken) {
    headers.authorization = `Bearer ${bearerToken}`;
  }

  try {
    const user = await sdk.authenticateRequest({ headers } as Request);
    return {
      id: user.id,
      role: user.role as UserRole,
    };
  } catch {
    return null;
  }
}

export function registerRealtimeGateway(server: HttpServer, allowList: string[]) {
  const io = new SocketIOServer(server, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) {
          callback(null, true);
          return;
        }
        if (isOriginAllowed(origin, allowList)) {
          callback(null, true);
          return;
        }
        callback(new Error("CORS origin not allowed"));
      },
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  io.use(async (socket, next) => {
    const authUser = await resolveSocketUser(socket);
    if (!authUser) {
      next(new Error("Unauthorized"));
      return;
    }
    socket.data.authUser = authUser;
    next();
  });

  io.on("connection", (socket) => {
    const authUser = socket.data.authUser as AuthUser | undefined;
    if (!authUser) {
      socket.disconnect(true);
      return;
    }

    const unsubs = new Map<string, () => void>();

    const unsubscribeKey = (key: string) => {
      const unsub = unsubs.get(key);
      if (unsub) {
        unsub();
        unsubs.delete(key);
      }
    };

    const subscribeTrip = (tripId: string) => {
      const key = `trip:${tripId}`;
      if (unsubs.has(key)) return;

      const unsubscribe = locationStreamingService.subscribeTrip(tripId, (event) => {
        socket.emit("trip:event", event);
      });
      unsubs.set(key, unsubscribe);
    };

    socket.on("trip:subscribe", (payload: TripSubscribePayload, ack?: (result: SocketAck) => void) => {
      try {
        const tripId = typeof payload?.tripId === "string" ? payload.tripId.trim() : "";
        if (!tripId) {
          ack?.({ ok: false, error: "tripId is required" });
          return;
        }

        const trip = tripService.getTrip(authUser, tripId);
        subscribeTrip(tripId);
        socket.join(`trip:${tripId}`);
        socket.emit("trip:event", { type: "snapshot", trip });

        const latestDriverLocation = platformStore
          .listTripLocations(tripId, 50)
          .find((location) => location.role === "driver");

        if (latestDriverLocation) {
          socket.emit("trip:event", {
            type: "driver.location",
            tripId,
            driverId: trip.driverId ?? latestDriverLocation.userId,
            lat: latestDriverLocation.lat,
            lng: latestDriverLocation.lng,
            heading: latestDriverLocation.heading ?? null,
            speed: latestDriverLocation.speed ?? null,
            timestamp: latestDriverLocation.createdAt,
          });
        }

        ack?.({ ok: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to subscribe";
        ack?.({ ok: false, error: message });
      }
    });

    socket.on("trip:unsubscribe", (payload: TripSubscribePayload, ack?: (result: SocketAck) => void) => {
      const tripId = typeof payload?.tripId === "string" ? payload.tripId.trim() : "";
      if (!tripId) {
        ack?.({ ok: false, error: "tripId is required" });
        return;
      }
      unsubscribeKey(`trip:${tripId}`);
      socket.leave(`trip:${tripId}`);
      ack?.({ ok: true });
    });

    socket.on("disconnect", () => {
      for (const unsubscribe of unsubs.values()) {
        unsubscribe();
      }
      unsubs.clear();
    });

    logger.info("realtime.socket.connected", {
      socketId: socket.id,
      userId: authUser.id,
      role: authUser.role,
    });
  });

  logger.info("realtime.socket.gateway.ready", {
    transports: ["websocket", "polling"],
  });

  return io;
}
