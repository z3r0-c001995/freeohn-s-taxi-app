import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import axios from "axios";

// Google API types (simplified)
interface PlaceAutocompleteResult {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

interface PlaceDetailsResult {
  place_id: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  formatted_address: string;
}

interface RouteResult {
  distanceMeters: number;
  duration: string; // e.g., "1234s"
  polyline: {
    encodedPolyline: string;
  };
  legs: Array<{
    steps: Array<{
      navigationInstruction: {
        instructions: string;
        maneuver: string;
      };
      distanceMeters: number;
      duration: string;
    }>;
  }>;
}

export const googleRouter = router({
  placesAutocomplete: protectedProcedure
    .input(z.object({ query: z.string(), location: z.object({ lat: z.number(), lng: z.number() }).optional() }))
    .query(async ({ input }) => {
      const apiKey = process.env.GOOGLE_MAPS_SERVER_KEY;
      if (!apiKey) throw new Error("Google Maps server key not configured");

      const params = new URLSearchParams({
        input: input.query,
        key: apiKey,
        types: "(regions)",
      });

      if (input.location) {
        params.append("location", `${input.location.lat},${input.location.lng}`);
        params.append("radius", "50000"); // 50km
      }

      const response = await axios.get(`https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`);
      return response.data.predictions as PlaceAutocompleteResult[];
    }),

  placeDetails: protectedProcedure
    .input(z.object({ placeId: z.string() }))
    .query(async ({ input }) => {
      const apiKey = process.env.GOOGLE_MAPS_SERVER_KEY;
      if (!apiKey) throw new Error("Google Maps server key not configured");

      const params = new URLSearchParams({
        place_id: input.placeId,
        key: apiKey,
        fields: "place_id,geometry,formatted_address",
      });

      const response = await axios.get(`https://maps.googleapis.com/maps/api/place/details/json?${params}`);
      return response.data.result as PlaceDetailsResult;
    }),

  computeRoute: protectedProcedure
    .input(z.object({
      origin: z.object({ lat: z.number(), lng: z.number() }),
      destination: z.object({ lat: z.number(), lng: z.number() }),
      travelMode: z.enum(["DRIVE"]).default("DRIVE"),
    }))
    .query(async ({ input }) => {
      const apiKey = process.env.GOOGLE_MAPS_SERVER_KEY;
      if (!apiKey) throw new Error("Google Maps server key not configured");

      const response = await axios.post(
        `https://routes.googleapis.com/directions/v2:computeRoutes?key=${apiKey}`,
        {
          origin: { location: { latLng: input.origin } },
          destination: { location: { latLng: input.destination } },
          travelMode: input.travelMode,
          routingPreference: "BEST_GUESS",
          computeAlternativeRoutes: false,
          routeModifiers: {
            avoidTolls: false,
            avoidHighways: false,
            avoidFerries: false,
          },
          languageCode: "en-US",
          units: "METRIC",
        },
        {
          headers: {
            "Content-Type": "application/json",
            "X-Goog-FieldMask": "routes.distanceMeters,routes.duration,routes.polyline,routes.legs.steps",
          },
        }
      );

      const route = response.data.routes?.[0] as RouteResult | undefined;
      if (!route) throw new Error("No route found");

      return {
        distanceMeters: route.distanceMeters,
        durationSeconds: parseInt(route.duration.replace("s", "")),
        encodedPolyline: route.polyline.encodedPolyline,
        steps: route.legs[0]?.steps.map(step => ({
          instructions: step.navigationInstruction?.instructions || "",
          maneuver: step.navigationInstruction?.maneuver || "",
          distanceMeters: step.distanceMeters,
          durationSeconds: parseInt(step.duration.replace("s", "")),
        })) || [],
      };
    }),
});

export type GoogleRouter = typeof googleRouter;