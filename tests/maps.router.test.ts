import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { TrpcContext } from "../server/_core/context";
import { mapsRouter } from "../server/routers/maps.router";

function createCallerContext(): TrpcContext {
  return {
    req: {
      ip: "127.0.0.1",
      headers: {},
    } as any,
    res: {} as any,
    user: null,
  };
}

describe("maps router hardening", () => {
  const previousOrsApiKey = process.env.ORS_API_KEY;

  beforeEach(() => {
    delete process.env.ORS_API_KEY;
  });

  afterEach(() => {
    if (previousOrsApiKey) {
      process.env.ORS_API_KEY = previousOrsApiKey;
      return;
    }
    delete process.env.ORS_API_KEY;
  });

  it("returns offline autocomplete fallback results when ORS key is absent", async () => {
    const caller = mapsRouter.createCaller(createCallerContext());
    const results = await caller.placesAutocomplete({
      query: "East Park",
      location: { lat: -15.389, lng: 28.323 },
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.description.toLowerCase()).toContain("east park");
  });

  it("supports coordinate-style address search fallback", async () => {
    const caller = mapsRouter.createCaller(createCallerContext());
    const results = await caller.placesAutocomplete({
      query: "-15.4162, 28.3115",
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.description.toLowerCase()).toContain("dropped pin");
  });
});
