import { Router, type Request } from "express";
import { timingSafeEqual } from "crypto";
import { z } from "zod";
import {
  createTripRequestSchema,
  driverLocationRequestSchema,
  driverStatusRequestSchema,
  fareEstimateRequestSchema,
  nearbyDriversRequestSchema,
  tripCancelRequestSchema,
  tripRatingRequestSchema,
  tripStartRequestSchema,
} from "../../../shared/ride-hailing";
import { locationStreamingService } from "../location/location.service";
import { collectMetrics } from "../observability/metrics";
import { withIdempotency } from "../platform/idempotency";
import { platformStore } from "../platform/store";
import { otpService } from "../platform/otp.service";
import { safetyService } from "../safety/safety.service";
import { isTerminalTripState } from "../trips/fsm";
import { tripService } from "../trips/trip.service";
import { requireAuth, requireRole } from "./auth";
import { createRateLimiter } from "./rate-limit";
import { sdk } from "../../_core/sdk";
import * as db from "../../db";
import { COOKIE_NAME } from "../../../shared/const";

const driverProfileSchema = z.object({
  userId: z.number().int().positive().optional(),
  vehicleMake: z.string().min(1).max(80),
  vehicleModel: z.string().min(1).max(80),
  vehicleColor: z.string().min(1).max(80),
  plateNumber: z.string().min(1).max(32),
  account: z
    .object({
      openId: z.string().trim().min(1).max(64).optional(),
      password: z.string().trim().min(6).max(200).optional(),
      isActive: z.boolean().optional(),
    })
    .optional(),
  personalInfo: z
    .object({
      fullName: z.string().trim().min(2).max(120),
      phoneNumber: z.string().trim().min(7).max(32),
      nrcNumber: z.string().trim().min(4).max(64),
      homeAddress: z.string().trim().min(4).max(240),
      emergencyContactName: z.string().trim().max(120).optional(),
      emergencyContactPhone: z.string().trim().max(32).optional(),
      payoutMethod: z.enum(["MOBILE_MONEY", "BANK"]).nullable().optional(),
      payoutAccountNumber: z.string().trim().nullable().optional(),
    })
    .optional(),
  compliance: z
    .object({
      driversLicenseNumber: z.string().trim().min(4).max(64),
      vehicleRegistrationNumber: z.string().trim().min(4).max(64),
      hasDriversLicense: z.boolean(),
      hasVehicleRegistrationDocument: z.boolean(),
      insured: z.boolean(),
      roadTaxCleared: z.boolean(),
      fitnessTestPassed: z.boolean(),
    })
    .optional(),
  commercial: z
    .object({
      ridesPurchased: z.number().int().min(0),
      notes: z.string().trim().max(500).optional(),
    })
    .optional(),
  documents: z
    .object({
      driversLicenseDocumentRef: z.string().trim().min(1).max(240),
      vehicleRegistrationDocumentRef: z.string().trim().min(1).max(240),
      insuranceDocumentRef: z.string().trim().min(1).max(240),
      roadTaxDocumentRef: z.string().trim().min(1).max(240),
      fitnessCertificateDocumentRef: z.string().trim().min(1).max(240),
    })
    .optional(),
  verified: z.boolean().optional(),
});

const driverCreditsSchema = z.object({
  ridesToAdd: z.number().int().positive().max(50_000),
});

const driverCredentialsUpdateSchema = z
  .object({
    openId: z.string().trim().min(1).max(64).optional(),
    password: z.string().trim().min(6).max(200).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => value.openId !== undefined || value.password !== undefined || value.isActive !== undefined, {
    message: "At least one field is required: openId, password, or isActive",
  });

const supportContactSchema = z.object({
  tripId: z.string().min(1).optional(),
  message: z.string().trim().min(1).max(1000),
});

const payoutSettingsSchema = z.object({
  payoutMethod: z.enum(["MOBILE_MONEY", "BANK"]).nullable().optional(),
  payoutAccountNumber: z.string().trim().nullable().optional(),
});

const adminLoginSchema = z.object({
  openId: z.string().trim().min(1).max(64),
  password: z.string().min(4).max(200),
});

const ADMIN_SESSION_TTL_MS = 1000 * 60 * 60 * 12;

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

function safeStringEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
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

  router.post("/admin/auth/login", async (req, res) => {
    const parsed = adminLoginSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid login payload" });
      return;
    }

    const expectedOpenId = (
      process.env.ADMIN_PORTAL_OPEN_ID ??
      process.env.OWNER_OPEN_ID ??
      (process.env.NODE_ENV !== "production" ? "9001" : "")
    ).trim();
    const expectedPassword = (
      process.env.ADMIN_PORTAL_PASSWORD ?? (process.env.NODE_ENV !== "production" ? "admin123" : "")
    ).trim();

    if (!expectedOpenId || !expectedPassword) {
      res.status(503).json({ error: "Admin portal credentials are not configured on the server." });
      return;
    }

    const openIdOk = safeStringEquals(parsed.data.openId.trim(), expectedOpenId);
    const passwordOk = safeStringEquals(parsed.data.password, expectedPassword);

    if (!openIdOk || !passwordOk) {
      res.status(401).json({ error: "Invalid admin credentials" });
      return;
    }

    await db.upsertUser({
      openId: expectedOpenId,
      name: "System Admin",
      role: "admin",
      loginMethod: "admin-portal",
      lastSignedIn: new Date(),
    });

    const adminUser = await db.getUserByOpenId(expectedOpenId);
    const devHeaderAllowed =
      process.env.NODE_ENV !== "production" || process.env.ALLOW_DEV_AUTH_HEADER === "1";

    if (!adminUser && !devHeaderAllowed) {
      res.status(500).json({ error: "Admin database identity is unavailable on this environment." });
      return;
    }

    if (adminUser) {
      const accessToken = await sdk.createSessionToken(expectedOpenId, {
        name: adminUser.name ?? "System Admin",
        expiresInMs: ADMIN_SESSION_TTL_MS,
      });

      res.cookie(COOKIE_NAME, accessToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: ADMIN_SESSION_TTL_MS,
      });

      res.json({
        authMode: "token",
        accessToken,
        devUserId: null,
        expiresInSeconds: Math.floor(ADMIN_SESSION_TTL_MS / 1000),
        user: {
          id: adminUser.id ?? null,
          openId: adminUser.openId,
          name: adminUser.name ?? "System Admin",
          role: "admin",
        },
      });
      return;
    }

    const fallbackDevUserIdRaw =
      process.env.ADMIN_PORTAL_DEV_USER_ID ?? process.env.ADMIN_PORTAL_OPEN_ID ?? process.env.OWNER_OPEN_ID ?? "9001";
    const fallbackParsed = Number(fallbackDevUserIdRaw);
    const fallbackDevUserId =
      Number.isFinite(fallbackParsed) && fallbackParsed > 0 ? String(Math.floor(fallbackParsed)) : "9001";

    res.json({
      authMode: "dev-header",
      accessToken: null,
      devUserId: fallbackDevUserId,
      expiresInSeconds: Math.floor(ADMIN_SESSION_TTL_MS / 1000),
      user: {
        id: Number(fallbackDevUserId),
        openId: expectedOpenId,
        name: "System Admin",
        role: "admin",
      },
    });
  });

  router.post("/auth/send-otp", async (req, res) => {
    try {
      const { phone } = req.body;
      if (!phone || typeof phone !== "string") {
        res.status(400).json({ error: "Phone number is required" });
        return;
      }
      await otpService.requestOtp(phone);
      res.json({ ok: true });
    } catch (error) {
      sendError(res, error);
    }
  });

  router.post("/auth/verify-otp", async (req, res) => {
    try {
      const { phone, code } = req.body;
      if (!phone || !code) {
        res.status(400).json({ error: "Phone and code are required" });
        return;
      }
      const isValid = otpService.verifyOtp(phone, code);
      if (!isValid) {
        res.status(401).json({ error: "Invalid or expired OTP" });
        return;
      }
      res.json({ ok: true, verified: true });
    } catch (error) {
      sendError(res, error);
    }
  });

  router.use(requireAuth);

  router.get("/admin/auth/me", requireRole("admin"), (req, res) => {
    const user = req.authUser;
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    res.json({
      user: {
        id: user.id ?? null,
        openId: user.openId,
        name: user.name ?? "System Admin",
        role: "admin",
      },
    });
  });

  router.post("/admin/auth/logout", requireRole("admin"), (_req, res) => {
    res.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    res.json({ ok: true });
  });

  router.get("/metrics", requireRole("admin"), (_req, res) => {
    res.json(collectMetrics());
  });

  router.get("/admin/overview", requireRole("admin"), (_req, res) => {
    const snapshot = platformStore.getSnapshot();
    const activeTrips = snapshot.trips.filter((trip) => !isTerminalTripState(trip.state));
    const completedTrips = snapshot.trips.filter((trip) => trip.state === "COMPLETED");
    const cancelledTrips = snapshot.trips.filter(
      (trip) => trip.state === "CANCELLED_BY_DRIVER" || trip.state === "CANCELLED_BY_PASSENGER",
    );
    const pendingDispatchOffers = snapshot.dispatchOffers.filter((offer) => offer.status === "PENDING");
    const openIncidents = snapshot.safetyIncidents.filter((incident) => incident.status === "OPEN");
    const verifiedDrivers = snapshot.drivers.filter((driver) => driver.verified);
    const onlineDrivers = snapshot.driverStatus.filter((status) => status.isOnline);

    res.json({
      generatedAt: new Date().toISOString(),
      counts: {
        totalDrivers: snapshot.drivers.length,
        onlineDrivers: onlineDrivers.length,
        verifiedDrivers: verifiedDrivers.length,
        activeTrips: activeTrips.length,
        completedTrips: completedTrips.length,
        cancelledTrips: cancelledTrips.length,
        pendingDispatchOffers: pendingDispatchOffers.length,
        openIncidents: openIncidents.length,
        ratingsSubmitted: snapshot.ratings.length,
      },
      metrics: collectMetrics(),
    });
  });

  router.get("/admin/drivers", requireRole("admin"), (_req, res) => {
    const snapshot = platformStore.getSnapshot();
    const statusByDriverId = new Map(snapshot.driverStatus.map((status) => [status.driverId, status] as const));
    const accountByDriverId = new Map(snapshot.driverAccounts.map((account) => [account.driverId, account] as const));

    const drivers = snapshot.drivers
      .map((driver) => {
        const status = statusByDriverId.get(driver.driverId) ?? null;
        const account = accountByDriverId.get(driver.driverId) ?? null;
        const personalInfo = driver.personalInfo ?? {
          fullName: `Driver ${driver.userId}`,
          phoneNumber: "",
          nrcNumber: "",
          homeAddress: "",
          emergencyContactName: null,
          emergencyContactPhone: null,
        };
        const compliance = driver.compliance ?? {
          driversLicenseNumber: "",
          vehicleRegistrationNumber: "",
          hasDriversLicense: false,
          hasVehicleRegistrationDocument: false,
          insured: false,
          roadTaxCleared: false,
          fitnessTestPassed: false,
        };
        const commercial = driver.commercial ?? {
          ridesPurchased: 0,
          ridesCompleted: 0,
          notes: null,
        };
        const documents = driver.documents ?? {
          driversLicenseDocumentRef: "",
          vehicleRegistrationDocumentRef: "",
          insuranceDocumentRef: "",
          roadTaxDocumentRef: "",
          fitnessCertificateDocumentRef: "",
        };
        const audit = driver.audit ?? {
          createdAt: "",
          updatedAt: "",
          createdByAdminId: null,
          updatedByAdminId: null,
          verificationReviewedAt: null,
          compliance: {
            driversLicenseCheckedAt: null,
            vehicleRegistrationCheckedAt: null,
            insuranceCheckedAt: null,
            roadTaxCheckedAt: null,
            fitnessCheckedAt: null,
          },
        };
        return {
          driverId: driver.driverId,
          userId: driver.userId,
          verified: driver.verified,
          rating: driver.rating,
          totalTrips: driver.totalTrips,
          vehicle: driver.vehicle,
          personalInfo,
          compliance,
          commercial: {
            ...commercial,
            ridesRemaining: Math.max(0, commercial.ridesPurchased - commercial.ridesCompleted),
          },
          documents,
          audit,
          account: account
            ? {
                openId: account.openId,
                isActive: account.isActive,
                passwordUpdatedAt: account.passwordUpdatedAt,
                lastLoginAt: account.lastLoginAt,
              }
            : null,
          status: status
            ? {
                isOnline: status.isOnline,
                lat: status.lat,
                lng: status.lng,
                lastSeenAt: status.lastSeenAt ?? null,
                activeTripId: status.activeTripId,
              }
            : null,
        };
      })
      .sort((a, b) => {
        if ((a.status?.isOnline ?? false) !== (b.status?.isOnline ?? false)) {
          return a.status?.isOnline ? -1 : 1;
        }
        if (a.verified !== b.verified) {
          return a.verified ? -1 : 1;
        }
        return a.driverId.localeCompare(b.driverId);
      });

    res.json({
      generatedAt: new Date().toISOString(),
      drivers,
    });
  });

  router.get("/admin/activities", requireRole("admin"), (req, res) => {
    const rawLimit = Number(req.query.limit ?? 60);
    const limit = Number.isFinite(rawLimit) ? Math.min(200, Math.max(10, Math.floor(rawLimit))) : 60;
    const snapshot = platformStore.getSnapshot();

    const trips = [...snapshot.trips].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, limit);
    const tripEvents = [...snapshot.tripEvents]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
    const incidents = [...snapshot.safetyIncidents]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
    const dispatchOffers = [...snapshot.dispatchOffers]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);

    res.json({
      generatedAt: new Date().toISOString(),
      trips,
      tripEvents,
      incidents,
      dispatchOffers,
    });
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
    "/drivers/nearby",
    requireRole("rider", "admin"),
    createRateLimiter({ windowMs: 60_000, max: 60 }),
    (req, res) => {
      try {
        const user = getAuthUser(req);
        const input = nearbyDriversRequestSchema.parse(req.body);
        const result = tripService.listNearbyDrivers(user, input);
        res.json(result);
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

  router.get("/trips", (req, res) => {
    try {
      const user = getAuthUser(req);
      const trips = tripService.listTrips(user);
      res.json(trips);
    } catch (error) {
      sendError(res, error);
    }
  });

  router.get("/trips/active", (req, res) => {
    try {
      const user = getAuthUser(req);
      const trip = tripService.getActiveTrip(user);
      res.json({ trip });
    } catch (error) {
      sendError(res, error);
    }
  });

  router.get("/trips/:tripId", (req, res) => {
    try {
      const user = getAuthUser(req);
      const trip = tripService.getTrip(user, req.params.tripId);
      res.json(trip);
    } catch (error) {
      sendError(res, error);
    }
  });

  const tripMessages = new Map<string, any[]>();

  router.get("/trips/:tripId/messages", (req, res) => {
    try {
      getAuthUser(req);
      const msgs = tripMessages.get(req.params.tripId) ?? [];
      res.json(msgs);
    } catch (error) {
      sendError(res, error);
    }
  });

  router.post("/trips/:tripId/messages", (req, res) => {
    try {
      getAuthUser(req);
      const { senderId, receiverId, message } = req.body;
      const msgs = tripMessages.get(req.params.tripId) ?? [];
      const newMsg = {
        id: Date.now(),
        ride_id: req.params.tripId,
        sender_id: senderId,
        receiver_id: receiverId,
        message,
        created_at: new Date().toISOString(),
      };
      msgs.push(newMsg);
      tripMessages.set(req.params.tripId, msgs);
      res.status(201).json(newMsg);
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
      const user = getAuthUser(req);
      const verified = req.body?.verified !== false;
      const result = tripService.verifyDriver(user, req.params.driverId, verified);
      res.json(result);
    } catch (error) {
      sendError(res, error);
    }
  });

  router.post("/admin/drivers/:driverId/credits", requireRole("admin"), (req, res) => {
    try {
      const user = getAuthUser(req);
      const body = driverCreditsSchema.parse(req.body);
      const result = tripService.addDriverRideCredits(user, req.params.driverId, body.ridesToAdd);
      res.json(result);
    } catch (error) {
      sendError(res, error);
    }
  });

  router.post("/admin/drivers/:driverId/credentials", requireRole("admin"), (req, res) => {
    try {
      const user = getAuthUser(req);
      const body = driverCredentialsUpdateSchema.parse(req.body);
      const result = tripService.updateDriverAccountCredentials(user, req.params.driverId, body);
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

  router.post("/driver/profile/payout", requireRole("driver", "admin"), (req, res) => {
    try {
      const user = getAuthUser(req);
      const body = payoutSettingsSchema.parse(req.body);
      const result = tripService.updateDriverPayoutSettings(user, body);
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

  router.post(
    "/driver/location",
    requireRole("driver", "admin"),
    createRateLimiter({ windowMs: 10_000, max: 12 }),
    (req, res) => {
      try {
        const user = getAuthUser(req);
        const payload = driverLocationRequestSchema.parse(req.body);
        const result = tripService.updateDriverLocation(user, payload);
        res.json(result);
      } catch (error) {
        sendError(res, error);
      }
    },
  );

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
