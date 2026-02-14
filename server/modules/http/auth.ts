import type { NextFunction, Request, Response } from "express";
import { sdk } from "../../_core/sdk";
import { userRoleValues, type UserRole } from "../../../shared/ride-hailing";

function parseDevUser(req: Request): Request["authUser"] | null {
  const allowDevAuth =
    process.env.NODE_ENV !== "production" || process.env.ALLOW_DEV_AUTH_HEADER === "1";
  if (!allowDevAuth) {
    return null;
  }

  const userIdHeader = req.headers["x-dev-user-id"];
  const roleHeader = req.headers["x-dev-user-role"];
  if (typeof userIdHeader !== "string" || typeof roleHeader !== "string") {
    return null;
  }

  const id = Number(userIdHeader);
  const role = roleHeader.trim().toLowerCase();
  if (!Number.isFinite(id) || id <= 0) {
    return null;
  }
  if (!userRoleValues.includes(role as UserRole)) {
    return null;
  }

  return {
    id,
    openId: String(id),
    name: "Dev User",
    email: null,
    loginMethod: "dev-header",
    role: role as UserRole,
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
