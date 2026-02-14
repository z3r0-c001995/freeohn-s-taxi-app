import crypto from "node:crypto";

export function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
}

export function createNumericPin(length = 4): string {
  let pin = "";
  for (let i = 0; i < length; i += 1) {
    pin += Math.floor(Math.random() * 10).toString();
  }
  return pin;
}

export function hashPin(pin: string): string {
  return crypto.createHash("sha256").update(pin).digest("hex");
}

export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export function createShareToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

