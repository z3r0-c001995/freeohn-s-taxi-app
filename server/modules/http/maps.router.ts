import { Router } from "express";
import { z } from "zod";
import { appRouter } from "../../routers";

const autocompleteSchema = z.object({
  query: z.string().trim().min(2).max(100),
  location: z
    .object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    })
    .optional(),
});

const reverseGeocodeSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const computeRouteSchema = z.object({
  origin: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
  destination: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
  travelMode: z.enum(["DRIVE"]).default("DRIVE"),
});

function sendError(res: any, error: unknown) {
  const message = error instanceof Error ? error.message : "Request failed";
  res.status(400).json({ error: message });
}

function getMapsCaller(req: any, res: any) {
  return appRouter.createCaller({
    req,
    res,
    user: req.authUser ?? null,
  });
}

export function createMapsHttpRouter(): Router {
  const router = Router();

  router.get("/config", (_req, res) => {
    const tileStyleUrl =
      process.env.MAP_STYLE_URL?.trim() ||
      "https://demotiles.maplibre.org/style.json";
    const tileAttribution =
      process.env.MAP_TILE_ATTRIBUTION?.trim() ||
      "© OpenStreetMap contributors";

    res.json({
      provider: "maplibre+osm+ors",
      tileStyleUrl,
      tileAttribution,
      countryBias: (process.env.ORS_COUNTRY_BIAS || "ZM").trim().toUpperCase(),
    });
  });

  router.post("/autocomplete", async (req, res) => {
    try {
      const input = autocompleteSchema.parse(req.body);
      const caller = getMapsCaller(req, res);
      const predictions = await caller.maps.placesAutocomplete(input);
      res.json({ predictions });
    } catch (error) {
      sendError(res, error);
    }
  });

  router.post("/reverse-geocode", async (req, res) => {
    try {
      const input = reverseGeocodeSchema.parse(req.body);
      const caller = getMapsCaller(req, res);
      const result = await caller.maps.reverseGeocode(input);
      res.json(result);
    } catch (error) {
      sendError(res, error);
    }
  });

  router.post("/route", async (req, res) => {
    try {
      const input = computeRouteSchema.parse(req.body);
      const caller = getMapsCaller(req, res);
      const result = await caller.maps.computeRoute(input);
      res.json(result);
    } catch (error) {
      sendError(res, error);
    }
  });

  return router;
}
