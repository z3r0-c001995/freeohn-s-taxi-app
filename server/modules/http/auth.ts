import type { NextFunction, Request, Response } from "express";
import { sdk } from "../../_core/sdk";
import { userRoleValues, type UserRole } from "../../../shared/ride-hailing";

export type AuthUser = Awaited<ReturnType<typeof sdk.authenticateRequest>>;

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthUser;
    }
  }
}

export function parseDevUser(req: Request): Request["authUser"] | null {
  const allowDevAuth =
    process.env.NODE_ENV !== "production" || process.env.ALLOW_DEV_AUTH_HEADER === "1";
  if (!allowDevAuth) {
    return null;
  }

  const userIdHeader = req.headers["x-dev-user-id"];
  const roleHeader = req.headers["x-dev-user-role"];
  if (typeof userIdHeader === "string" && typeof roleHeader === "string") {
    const id = Number(userIdHeader);
    const role = roleHeader.trim().toLowerCase();
    if (Number.isFinite(id) && id > 0 && userRoleValues.includes(role as UserRole)) {
      return {
        id,
        openId: String(id),
        name: role === "driver" ? "Freeohn Driver" : role === "admin" ? "System Admin" : "Freeohn Passenger",
        email: null,
        loginMethod: "dev-header",
        role: role as UserRole,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      };
    }
  }

  // Fallback for dev mode when calling routes directly (e.g. localhost browser testing)
  const path = req.originalUrl || req.url || req.path || "";
  const isDriverEndpoint =
    path.includes("/api/driver") ||
    path.includes("/driver/") ||
    (path.includes("/api/drivers") && !path.includes("/admin/"));
  const isAdminEndpoint = path.includes("/admin/");

  if (isAdminEndpoint) {
    return null; // Admin must provide admin credentials/header
  }

  if (isDriverEndpoint) {
    return {
      id: 2001001,
      openId: "2001001",
      name: "Freeohn Driver Demo",
      email: "driver@freeohn.com",
      loginMethod: "dev-default",
      role: "driver",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };
  }

  return {
    id: 1001,
    openId: "1001",
    name: "Freeohn Passenger Demo",
    email: "passenger@freeohn.com",
    loginMethod: "dev-default",
    role: "rider",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const devUser = parseDevUser(req);
    if (devUser) {
      req.authUser = devUser;
      next();
      return;
    }

    const user = await sdk.authenticateRequest(req);
    req.authUser = user;
    next();
  } catch (error) {
    res.status(401).json({ error: "Unauthorized" });
  }
}

export function requireRole(...roles: Array<"rider" | "driver" | "admin">) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const role = req.authUser?.role;
    if (!role || !roles.includes(role)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}

