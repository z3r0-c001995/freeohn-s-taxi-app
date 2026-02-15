import { z } from "zod";
import axios from "axios";
import { publicProcedure, router } from "../_core/trpc";
import { haversineKm } from "../modules/dispatch/geo";
import { logger } from "../modules/observability/logger";

const ORS_BASE_URL = (process.env.ORS_BASE_URL || "https://api.openrouteservice.org").replace(/\/$/, "");
const ORS_TIMEOUT_MS = Number(process.env.ORS_TIMEOUT_MS || 4500);
const ORS_COUNTRY_BIAS = (process.env.ORS_COUNTRY_BIAS || "ZM").trim().toUpperCase();
const MAPS_CACHE_TTL_MS = Number(process.env.MAPS_CACHE_TTL_MS || 45_000);
const MAPS_RATE_WINDOW_MS = Number(process.env.MAPS_RATE_WINDOW_MS || 60_000);
const MAPS_RATE_MAX = Number(process.env.MAPS_RATE_MAX || 120);

type OrsFeature = {
  geometry?: {
    coordinates?: [number, number] | number[][];
  };
  properties?: {
    id?: string;
    gid?: string;
    label?: string;
    name?: string;
    locality?: string;
    region?: string;
    country?: string;
    country_a?: string;
  };
};

type CacheEntry = {
  expiresAt: number;
  value: unknown;
};

type RateEntry = {
  count: number;
  resetAt: number;
};

const mapsCache = new Map<string, CacheEntry>();
const mapsRateBuckets = new Map<string, RateEntry>();

const fallbackPlaces = [
  { name: "Kenneth Kaunda International Airport", locality: "Lusaka", region: "Lusaka", country: "Zambia", lat: -15.3305, lng: 28.4529 },
  { name: "East Park Mall", locality: "Lusaka", region: "Lusaka", country: "Zambia", lat: -15.3897, lng: 28.3237 },
  { name: "Levy Junction", locality: "Lusaka", region: "Lusaka", country: "Zambia", lat: -15.4169, lng: 28.2866 },
  { name: "Manda Hill", locality: "Lusaka", region: "Lusaka", country: "Zambia", lat: -15.4064, lng: 28.3036 },
  { name: "Arcades Shopping Centre", locality: "Lusaka", region: "Lusaka", country: "Zambia", lat: -15.3984, lng: 28.3223 },
  { name: "Kitwe City Centre", locality: "Kitwe", region: "Copperbelt", country: "Zambia", lat: -12.8024, lng: 28.2132 },
  { name: "Ndola City Centre", locality: "Ndola", region: "Copperbelt", country: "Zambia", lat: -12.9587, lng: 28.6366 },
  { name: "Livingstone Town Centre", locality: "Livingstone", region: "Southern", country: "Zambia", lat: -17.8419, lng: 25.8544 },
];

function getOrsApiKey(): string | null {
  const key = process.env.ORS_API_KEY?.trim();
  return key || null;
}

function normalizeQuery(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, 80);
}

function getClientKey(ctx: { user: { id: number } | null; req: { ip?: string; headers?: Record<string, unknown> } }): string {
  if (ctx.user?.id) return `user:${ctx.user.id}`;
  if (ctx.req.ip) return `ip:${ctx.req.ip}`;
  const headerForwardedFor = typeof ctx.req.headers?.["x-forwarded-for"] === "string" ? ctx.req.headers["x-forwarded-for"] : "";
  return headerForwardedFor ? `xff:${headerForwardedFor.split(",")[0]?.trim()}` : "anon";
}

function enforceMapsRateLimit(key: string, scope: string): void {
  const bucketKey = `${scope}:${key}`;
  const now = Date.now();
  const current = mapsRateBuckets.get(bucketKey);

  if (!current || now >= current.resetAt) {
    mapsRateBuckets.set(bucketKey, { count: 1, resetAt: now + MAPS_RATE_WINDOW_MS });
    return;
  }

  if (current.count >= MAPS_RATE_MAX) {
    throw new Error("Too many map requests. Please retry in a few seconds.");
  }

  current.count += 1;
}

function getCached<T>(key: string): T | null {
  const now = Date.now();
  const entry = mapsCache.get(key);
  if (!entry) return null;
  if (now >= entry.expiresAt) {
    mapsCache.delete(key);
    return null;
  }
  return entry.value as T;
}

function setCached(key: string, value: unknown): void {
  mapsCache.set(key, {
    value,
    expiresAt: Date.now() + MAPS_CACHE_TTL_MS,
  });

  if (mapsCache.size < 400) return;
  const now = Date.now();
  for (const [cacheKey, entry] of mapsCache.entries()) {
    if (entry.expiresAt <= now) {
      mapsCache.delete(cacheKey);
    }
  }
}

function haversineDistanceMeters(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
): number {
  const earthRadius = 6_371_000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(destination.lat - origin.lat);
  const dLng = toRad(destination.lng - origin.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(origin.lat)) * Math.cos(toRad(destination.lat)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
}

function encodePolyline(points: { lat: number; lng: number }[]): string {
  let previousLat = 0;
  let previousLng = 0;

  const encodeValue = (value: number): string => {
    let current = value < 0 ? ~(value << 1) : value << 1;
    let encoded = "";
    while (current >= 0x20) {
      encoded += String.fromCharCode((0x20 | (current & 0x1f)) + 63);
      current >>= 5;
    }
    encoded += String.fromCharCode(current + 63);
    return encoded;
  };

  return points
    .map((point) => {
      const lat = Math.round(point.lat * 1e5);
      const lng = Math.round(point.lng * 1e5);
      const deltaLat = lat - previousLat;
      const deltaLng = lng - previousLng;
      previousLat = lat;
      previousLng = lng;
      return `${encodeValue(deltaLat)}${encodeValue(deltaLng)}`;
    })
    .join("");
}

function formatAutocompletePrediction(feature: OrsFeature, fallbackIndex: number) {
  const coordinates = feature.geometry?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    return null;
  }

  const [lngRaw, latRaw] = coordinates as unknown[];
  if (typeof lngRaw !== "number" || typeof latRaw !== "number") {
    return null;
  }

  const lng = lngRaw;
  const lat = latRaw;
  const props = feature.properties ?? {};
  const description = props.label || props.name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  const mainText = props.name || description.split(",")[0] || description;
  const secondaryText =
    [props.locality, props.region, props.country, props.country_a].filter(Boolean).join(", ") || description;
  const placeId = props.id || props.gid || `ors_${fallbackIndex}_${lat}_${lng}`;

  return {
    place_id: placeId,
    description,
    structured_formatting: {
      main_text: mainText,
      secondary_text: secondaryText,
    },
    geometry: {
      location: {
        lat,
        lng,
      },
    },
    formatted_address: description,
  };
}

function parseCoordinatesFromQuery(query: string): { lat: number; lng: number } | null {
  const match = query.match(/^(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function formatFallbackPrediction(input: {
  placeId: string;
  name: string;
  locality?: string;
  region?: string;
  country?: string;
  lat: number;
  lng: number;
}) {
  const secondaryText = [input.locality, input.region, input.country].filter(Boolean).join(", ");
  const description = [input.name, secondaryText].filter(Boolean).join(", ");

  return {
    place_id: input.placeId,
    description,
    structured_formatting: {
      main_text: input.name,
      secondary_text: secondaryText || description,
    },
    geometry: {
      location: {
        lat: input.lat,
        lng: input.lng,
      },
    },
    formatted_address: description,
  };
}

function fallbackPlacesAutocomplete(query: string, location?: { lat: number; lng: number }) {
  const parsedCoordinates = parseCoordinatesFromQuery(query);
  const fallbackResults: ReturnType<typeof formatFallbackPrediction>[] = [];

  if (parsedCoordinates) {
    fallbackResults.push(
      formatFallbackPrediction({
        placeId: `coords_${parsedCoordinates.lat}_${parsedCoordinates.lng}`,
        name: `Dropped pin (${parsedCoordinates.lat.toFixed(5)}, ${parsedCoordinates.lng.toFixed(5)})`,
        locality: "Custom coordinates",
        country: "Zambia",
        lat: parsedCoordinates.lat,
        lng: parsedCoordinates.lng,
      }),
    );
  }

  const normalized = query.toLowerCase();
  const placeMatches = fallbackPlaces
    .filter((place) => `${place.name} ${place.locality} ${place.region}`.toLowerCase().includes(normalized))
    .map((place) => ({
      ...formatFallbackPrediction({
        placeId: `fallback_${place.name.replace(/\s+/g, "_").toLowerCase()}`,
        name: place.name,
        locality: place.locality,
        region: place.region,
        country: place.country,
        lat: place.lat,
        lng: place.lng,
      }),
      sortDistanceKm: location ? haversineKm(location.lat, location.lng, place.lat, place.lng) : Number.MAX_SAFE_INTEGER,
    }))
    .sort((a, b) => a.sortDistanceKm - b.sortDistanceKm)
    .slice(0, 8)
    .map(({ sortDistanceKm, ...item }) => item);

  return [...fallbackResults, ...placeMatches].slice(0, 8);
}

function fallbackReverseGeocode(input: { lat: number; lng: number }) {
  const nearest = fallbackPlaces
    .map((place) => ({
      place,
      distanceKm: haversineKm(input.lat, input.lng, place.lat, place.lng),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm)[0];

  if (nearest && nearest.distanceKm <= 0.4) {
    return {
      address: `${nearest.place.name}, ${nearest.place.locality}, ${nearest.place.country}`,
    };
  }

  return { address: `${input.lat.toFixed(6)}, ${input.lng.toFixed(6)}` };
}

function fallbackRoute(origin: { lat: number; lng: number }, destination: { lat: number; lng: number }) {
  const distanceMeters = Math.max(1, Math.round(haversineDistanceMeters(origin, destination)));
  const averageSpeedMps = 11; // about 40km/h
  const durationSeconds = Math.max(60, Math.round(distanceMeters / averageSpeedMps));
  return {
    distanceMeters,
    durationSeconds,
    encodedPolyline: encodePolyline([origin, destination]),
    steps: [
      {
        instructions: "Head to destination",
        maneuver: "STRAIGHT",
        distanceMeters,
        durationSeconds,
      },
    ],
  };
}

export const mapsRouter = router({
  placesAutocomplete: publicProcedure
    .input(
      z.object({
        query: z.string().trim().min(2).max(100),
        location: z.object({ lat: z.number(), lng: z.number() }).optional(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const query = normalizeQuery(input.query);
      if (query.length < 2) {
        return [];
      }

      enforceMapsRateLimit(getClientKey(ctx), "autocomplete");

      const cacheKey = `ac:${query}:${input.location?.lat ?? ""}:${input.location?.lng ?? ""}`;
      const cached = getCached<ReturnType<typeof fallbackPlacesAutocomplete>>(cacheKey);
      if (cached) {
        return cached;
      }

      const apiKey = getOrsApiKey();
      if (!apiKey) {
        const fallback = fallbackPlacesAutocomplete(query, input.location);
        setCached(cacheKey, fallback);
        return fallback;
      }

      try {
        const params = new URLSearchParams({
          api_key: apiKey,
          text: query,
          size: "8",
        });

        if (ORS_COUNTRY_BIAS) {
          params.set("boundary.country", ORS_COUNTRY_BIAS);
        }

        if (input.location) {
          params.set("focus.point.lat", String(input.location.lat));
          params.set("focus.point.lon", String(input.location.lng));
        }

        const response = await axios.get<{ features?: OrsFeature[] }>(`${ORS_BASE_URL}/geocode/autocomplete?${params}`, {
          timeout: ORS_TIMEOUT_MS,
        });
        const results = (response.data.features ?? [])
          .map((feature, index) => formatAutocompletePrediction(feature, index))
          .filter((feature): feature is NonNullable<typeof feature> => feature !== null);

        const finalResults = results.length > 0 ? results : fallbackPlacesAutocomplete(query, input.location);
        setCached(cacheKey, finalResults);
        return finalResults;
      } catch (error) {
        logger.warn("maps.placesAutocomplete.failed", {
          message: error instanceof Error ? error.message : "unknown",
        });
        const fallback = fallbackPlacesAutocomplete(query, input.location);
        setCached(cacheKey, fallback);
        return fallback;
      }
    }),

  reverseGeocode: publicProcedure
    .input(z.object({ lat: z.number(), lng: z.number() }))
    .query(async ({ input, ctx }) => {
      enforceMapsRateLimit(getClientKey(ctx), "reverseGeocode");

      const cacheKey = `rg:${input.lat.toFixed(6)}:${input.lng.toFixed(6)}`;
      const cached = getCached<{ address: string }>(cacheKey);
      if (cached) {
        return cached;
      }

      const apiKey = getOrsApiKey();
      if (!apiKey) {
        const fallback = fallbackReverseGeocode(input);
        setCached(cacheKey, fallback);
        return fallback;
      }

      try {
        const params = new URLSearchParams({
          api_key: apiKey,
          "point.lat": String(input.lat),
          "point.lon": String(input.lng),
          size: "1",
        });
        if (ORS_COUNTRY_BIAS) {
          params.set("boundary.country", ORS_COUNTRY_BIAS);
        }

        const response = await axios.get<{ features?: OrsFeature[] }>(`${ORS_BASE_URL}/geocode/reverse?${params}`, {
          timeout: ORS_TIMEOUT_MS,
        });
        const best = response.data.features?.[0];
        const result = {
          address: best?.properties?.label || fallbackReverseGeocode(input).address,
        };
        setCached(cacheKey, result);
        return result;
      } catch (error) {
        logger.warn("maps.reverseGeocode.failed", {
          message: error instanceof Error ? error.message : "unknown",
        });
        const fallback = fallbackReverseGeocode(input);
        setCached(cacheKey, fallback);
        return fallback;
      }
    }),

  computeRoute: publicProcedure
    .input(
      z.object({
        origin: z.object({ lat: z.number(), lng: z.number() }),
        destination: z.object({ lat: z.number(), lng: z.number() }),
        travelMode: z.enum(["DRIVE"]).default("DRIVE"),
      }),
    )
    .query(async ({ input, ctx }) => {
      enforceMapsRateLimit(getClientKey(ctx), "computeRoute");

      const cacheKey = `route:${input.origin.lat.toFixed(5)}:${input.origin.lng.toFixed(5)}:${input.destination.lat.toFixed(5)}:${input.destination.lng.toFixed(5)}`;
      const cached = getCached<ReturnType<typeof fallbackRoute>>(cacheKey);
      if (cached) {
        return cached;
      }

      const apiKey = getOrsApiKey();
      if (!apiKey) {
        const fallback = fallbackRoute(input.origin, input.destination);
        setCached(cacheKey, fallback);
        return fallback;
      }

      try {
        const response = await axios.post<{
          features?: {
            geometry?: { coordinates?: number[][] };
            properties?: {
              summary?: { distance?: number; duration?: number };
              segments?: {
                steps?: {
                  instruction?: string;
                  type?: number;
                  distance?: number;
                  duration?: number;
                }[];
              }[];
            };
          }[];
        }>(
          `${ORS_BASE_URL}/v2/directions/driving-car/geojson`,
          {
            coordinates: [
              [input.origin.lng, input.origin.lat],
              [input.destination.lng, input.destination.lat],
            ],
            instructions: true,
          },
          {
            headers: {
              Authorization: apiKey,
              "Content-Type": "application/json",
            },
            timeout: ORS_TIMEOUT_MS,
          },
        );

        const feature = response.data.features?.[0];
        const coords = feature?.geometry?.coordinates ?? [];
        const summary = feature?.properties?.summary;
        const segments = feature?.properties?.segments ?? [];
        const points = coords
          .filter((coord): coord is [number, number] => Array.isArray(coord) && coord.length >= 2)
          .map((coord) => ({ lat: coord[1], lng: coord[0] }));

        if (points.length < 2) {
          const fallback = fallbackRoute(input.origin, input.destination);
          setCached(cacheKey, fallback);
          return fallback;
        }

        const distanceMeters = Math.max(
          1,
          Math.round(summary?.distance ?? haversineDistanceMeters(input.origin, input.destination)),
        );
        const durationSeconds = Math.max(1, Math.round(summary?.duration ?? distanceMeters / 11));

        const result = {
          distanceMeters,
          durationSeconds,
          encodedPolyline: encodePolyline(points),
          steps: segments.flatMap((segment) =>
            (segment.steps ?? []).map((step) => ({
              instructions: step.instruction || "",
              maneuver: step.type != null ? String(step.type) : "",
              distanceMeters: Math.max(0, Math.round(step.distance ?? 0)),
              durationSeconds: Math.max(0, Math.round(step.duration ?? 0)),
            })),
          ),
        };

        setCached(cacheKey, result);
        return result;
      } catch (error) {
        logger.warn("maps.computeRoute.failed", {
          message: error instanceof Error ? error.message : "unknown",
        });
        const fallback = fallbackRoute(input.origin, input.destination);
        setCached(cacheKey, fallback);
        return fallback;
      }
    }),
});

export type MapsRouter = typeof mapsRouter;
