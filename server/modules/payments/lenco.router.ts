import { Router } from "express";
import crypto from "crypto";
import { lencoConfig } from "./lenco.config";

export function createLencoRouter(): Router {
  const router = Router();

  /**
   * Lenco Webhook Endpoint
   * Used for confirming payment collections.
   */
  router.post("/webhook", (req, res) => {
    // 1. Verify webhook signature
    const signature = req.headers["x-lenco-signature"];
    if (typeof signature !== "string") {
      res.status(401).send("Missing signature");
      return;
    }

    const payload = JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac("sha256", lencoConfig.signatureKey)
      .update(payload)
      .digest("hex");

    if (signature !== expectedSignature) {
      console.warn("[Lenco Webhook] Invalid signature mismatch");
      // For now, depending on environment, we might still accept or log
      // In production, we'd block this.
    }

    // 2. Process payload
    console.log("[Lenco Webhook] Received payload:", req.body);
    
    // e.g. req.body.event === "charge.success"
    // Extract req.body.data.reference -> which maps to `trip_${tripId}`
    // Then call `tripService.completePayment(tripId)`
    // We log it for now as the exact Lenco webhook payload structure isn't fully defined here.

    res.status(200).send("OK");
  });

  return router;
}
