import type { NextFunction, Request, Response } from "express";

type RateLimitOptions = {
  windowMs: number;
  max: number;
  keyFn?: (req: Request) => string;
};

type CounterEntry = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, CounterEntry>();

export function createRateLimiter(options: RateLimitOptions) {
  const keyFn =
    options.keyFn ??
    ((req: Request) => {
      const user = req.authUser?.id ? `user:${req.authUser.id}` : "anon";
      return `${user}:${req.path}`;
    });

  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    const key = keyFn(req);
    const entry = buckets.get(key);

    if (!entry || now >= entry.resetAt) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      next();
      return;
    }

    if (entry.count >= options.max) {
      res.setHeader("Retry-After", Math.ceil((entry.resetAt - now) / 1000));
      res.status(429).json({ error: "Too many requests" });
      return;
    }

    entry.count += 1;
    next();
  };
}

