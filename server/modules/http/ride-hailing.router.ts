import { Router, type Request } from "express";
import { z } from "zod";
import {
  createTripRequestSchema,
  driverLocationRequestSchema,
  driverStatusRequestSchema,
  fareEstimateRequestSchema,
  tripCancelRequestSchema,
  tripRatingRequestSchema,
  tripStartRequestSchema,
} from "../../../shared/ride-hailing";
import { locationStreamingService } from "../location/location.service";
import { collectMetrics } from "../observability/metrics";
import { withIdempotency } from "../platform/idempotency";
import { platformStore } from "../platform/store";
import { safetyService } from "../safety/safety.service";
import { tripService } from "../trips/trip.service";
import { requireAuth, requireRole } from "./auth";
import { createRateLimiter } from "./rate-limit";

const driverProfileSchema = z.object({
  userId: z.number().int().positive().optional(),
  vehicleMake: z.string().min(1).max(80),
  vehicleModel: z.string().min(1).max(80),
  vehicleColor: z.string().min(1).max(80),
  plateNumber: z.string().min(1).max(32),
  verified: z.boolean().optional(),
});

const supportContactSchema = z.object({
  tripId: z.string().min(1).optional(),
  message: z.string().trim().min(1).max(1000),
});

function getAuthUser(req: Request) {
  const user = req.authUser;
  if (!user) {
    throw new Error("Unauthenticated");
  }
  return {
    id: user.id,
    role: user.role,
  } as const;
}

function getIdempotencyKey(req: Request, bodyKey?: string): string | undefined {
  const headerKey = req.headers["idempotency-key"];
  if (typeof headerKey === "string" && headerKey.trim()) {
    return headerKey.trim();
  }
  return bodyKey?.trim();
}

function sendError(res: any, error: unknown) {
  const message = error instanceof Error ? error.message : "Request failed";
  res.status(400).json({ error: message });
}

export function createRideHailingRouter(): Router {
  const router = Router();

  router.get("/share/:token", (req, res) => {
    try {
      const payload = safetyService.resolveShareToken(req.params.token);
      res.json(payload);
    } catch (error) {
      sendError(res, error);
    }
  });

  router.use(requireAuth);

  router.get("/metrics", requireRole("admin"), (_req, res) => {
    res.json(collectMetrics());
  });

  router.post(
    "/trips/estimate",
    requireRole("rider", "admin"),
    createRateLimiter({ windowMs: 60_000, max: 60 }),
    (req, res) => {
      try {
        const input = fareEstimateRequestSchema.parse(req.body);
        const estimate = tripService.estimateFare(input);
        res.json(estimate);
      } catch (error) {
        sendError(res, error);
      }
    },
  );

  router.post(
    "/trips",
    requireRole("rider", "admin"),
    createRateLimiter({ windowMs: 60_000, max: 10 }),
    async (req, res) => {
      try {
        const user = getAuthUser(req);
        const input = createTripRequestSchema.parse(req.body);
        const idempotencyKey = getIdempotencyKey(req, input.idempotencyKey);
        const trip = await withIdempotency(`trip:create:${user.id}`, idempotencyKey, async () =>
          tripService.createTrip(user, input),
        );
        res.status(201).json(trip);
      } catch (error) {
        sendError(res, error);
      }
    },
  );

  router.get("/trips/:tripId", (req, res) => {
    try {
      const user = getAuthUser(req);
      const trip = tripService.getTrip(user, req.params.tripId);
      res.json(trip);
    } catch (error) {
      sendError(res, error);
    }
  });

  router.post(
    "/trips/:tripId/cancel",
    createRateLimiter({ windowMs: 60_000, max: 12 }),
    async (req, res) => {
      try {
        const user = getAuthUser(req);
        const body = tripCancelRequestSchema.parse(req.body);
        const idempotencyKey = getIdempotencyKey(req);
        const trip = await withIdempotency(`trip:cancel:${req.params.tripId}:${user.id}`, idempotencyKey, async () =>
          tripService.cancelTrip(user, req.params.tripId, body.reason),
        );
        res.json(trip);
      } catch (error) {
        sendError(res, error);
      }
    },
  );

  router.post("/trips/:tripId/share", (req, res) => {
    try {
      const user = getAuthUser(req);
      const payload = safetyService.createTripShareToken({
        tripId: req.params.tripId,
        createdByUserId: String(user.id),
      });
      res.status(201).json(payload);
    } catch (error) {
      sendError(res, error);
    }
  });

  router.post("/trips/share/:token/revoke", (req, res) => {
    try {
      const user = getAuthUser(req);
      const payload = safetyService.revokeShareToken(req.params.token, String(user.id));
      res.json(payload);
    } catch (error) {
      sendError(res, error);
    }
  });

  router.post(
    "/trips/:tripId/sos",
    createRateLimiter({ windowMs: 60_000, max: 3 }),
    (req, res) => {
      try {
        const user = getAuthUser(req);
        const description =
          typeof req.body?.description === "string" && req.body.description.trim()
            ? req.body.description.trim()
            : "Emergency triggered from app";
        const response = safetyService.reportIncident({
          tripId: req.params.tripId,
          reporterUserId: String(user.id),
          reporterRole: user.role,
          category: "SOS",
          description,
        });
        res.status(201).json(response);
      } catch (error) {
        sendError(res, error);
      }
    },
  );

  router.post("/support/contact", (req, res) => {
    try {
      const user = getAuthUser(req);
      const body = supportContactSchema.parse(req.body);
      const tripId = body.tripId ?? "general_support";
      const response = safetyService.reportIncident({
        tripId,
        reporterUserId: String(user.id),
        reporterRole: user.role,
        category: "SUPPORT",
        description: body.message,
      });
      res.status(201).json(response);
    } catch (error) {
      sendError(res, error);
    }
  });

  router.post("/trips/:tripId/rate", requireRole("rider", "admin"), (req, res) => {
    try {
      const user = getAuthUser(req);
      const body = tripRatingRequestSchema.parse(req.body);
      const result = tripService.submitTripRating(user, req.params.tripId, body.score, body.feedback);
      res.status(201).json(result);
    } catch (error) {
      sendError(res, error);
    }
  });

  router.post("/driver/profile", requireRole("admin"), (req, res) => {
    try {
      const user = getAuthUser(req);
      const input = driverProfileSchema.parse(req.body);
      const targetUserId = input.userId;
      if (!targetUserId) {
        throw new Error("userId is required. Drivers are registered by company owner/admin.");
      }
      const profile = tripService.registerDriverByAdmin(user, targetUserId, input);
      res.status(201).json(profile);
    } catch (error) {
      sendError(res, error);
    }
  });

  router.post("/admin/drivers/register", requireRole("admin"), (req, res) => {
    try {
      const user = getAuthUser(req);
      const input = driverProfileSchema.parse(req.body);
      const targetUserId = input.userId;
      if (!targetUserId) {
        throw new Error("userId is required");
      }
      const profile = tripService.registerDriverByAdmin(user, targetUserId, input);
      res.status(201).json(profile);
    } catch (error) {
      sendError(res, error);
    }
  });

  router.post("/admin/drivers/:driverId/verify", requireRole("admin"), (req, res) => {
    try {
      const verified = req.body?.verified !== false;
      const result = tripService.verifyDriver(req.params.driverId, verified);
      res.json(result);
    } catch (error) {
      sendError(res, error);
    }
  });

  router.post("/driver/status", requireRole("driver", "admin"), (req, res) => {
    try {
      const user = getAuthUser(req);
      const payload = driverStatusRequestSchema.parse(req.body);
      const result = tripService.setDriverStatus(user, payload);
      res.json(result);
    } catch (error) {
      sendError(res, error);
    }
  });

  router.get("/driver/requests", requireRole("driver", "admin"), (req, res) => {
    try {
      const user = getAuthUser(req);
      res.json({ requests: tripService.listDriverRequests(user) });
    } catch (error) {
      sendError(res, error);
    }
  });

  router.get("/driver/dashboard", requireRole("driver", "admin"), (req, res) => {
    try {
      const user = getAuthUser(req);
      res.json(tripService.getDriverDashboard(user));
    } catch (error) {
      sendError(res, error);
    }
  });

  router.post("/driver/requests/:offerId/accept", requireRole("driver", "admin"), async (req, res) => {
    try {
      const user = getAuthUser(req);
      const response = await tripService.respondDriverRequest(user, req.params.offerId, true);
      res.json(response);
    } catch (error) {
      sendError(res, error);
    }
  });

  router.post("/driver/requests/:offerId/decline", requireRole("driver", "admin"), async (req, res) => {
    try {
      const user = getAuthUser(req);
      const response = await tripService.respondDriverRequest(user, req.params.offerId, false);
      res.json(response);
    } catch (error) {
      sendError(res, error);
    }
  });

  router.post("/driver/location", requireRole("driver", "admin"), (req, res) => {
    try {
      const user = getAuthUser(req);
      const payload = driverLocationRequestSchema.parse(req.body);
      const result = tripService.updateDriverLocation(user, payload);
      res.json(result);
    } catch (error) {
      sendError(res, error);
    }
  });

  router.post("/trips/:tripId/arrived", requireRole("driver", "admin"), async (req, res) => {
    try {
      const user = getAuthUser(req);
      const result = await tripService.driverArrived(user, req.params.tripId);
      res.json(result);
    } catch (error) {
      sendError(res, error);
    }
  });

  router.post(
    "/trips/:tripId/start",
    requireRole("driver", "admin"),
    createRateLimiter({ windowMs: 10 * 60_000, max: 12 }),
    async (req, res) => {
      try {
        const user = getAuthUser(req);
        const body = tripStartRequestSchema.parse(req.body);
        const idempotencyKey = getIdempotencyKey(req, body.idempotencyKey);
        const result = await withIdempotency(`trip:start:${req.params.tripId}:${user.id}`, idempotencyKey, async () =>
          tripService.startTrip(user, req.params.tripId, body.pin),
        );
        res.json(result);
      } catch (error) {
        sendError(res, error);
      }
    },
  );

  router.post("/trips/:tripId/complete", requireRole("driver", "admin"), async (req, res) => {
    try {
      const user = getAuthUser(req);
      const idempotencyKey = getIdempotencyKey(req);
      const result = await withIdempotency(`trip:complete:${req.params.tripId}:${user.id}`, idempotencyKey, async () =>
        tripService.completeTrip(user, req.params.tripId),
      );
      res.json(result);
    } catch (error) {
      sendError(res, error);
    }
  });

  router.get("/stream/trips/:tripId", (req, res) => {
    try {
      const user = getAuthUser(req);
      const initialTrip = tripService.getTrip(user, req.params.tripId);

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders?.();

      const sendEvent = (event: unknown) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      };

      sendEvent({ type: "connected", tripId: req.params.tripId });
      sendEvent({ type: "snapshot", trip: initialTrip });

      const unsubscribe = locationStreamingService.subscribeTrip(req.params.tripId, (event) => {
        sendEvent(event);
      });

      const keepAlive = setInterval(() => {
        res.write(": keep-alive\n\n");
      }, 15_000);

      req.on("close", () => {
        clearInterval(keepAlive);
        unsubscribe();
        res.end();
      });
    } catch (error) {
      sendError(res, error);
    }
  });

  router.get("/debug/snapshot", requireRole("admin"), (_req, res) => {
    res.json(platformStore.getSnapshot());
  });

  return router;
}
