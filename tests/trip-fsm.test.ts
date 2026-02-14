import { describe, expect, it } from "vitest";
import { assertTransition, canTransition, getAllowedTransitions, isTerminalTripState } from "../server/modules/trips/fsm";

describe("Trip FSM", () => {
  it("allows valid transitions", () => {
    expect(canTransition("CREATED", "MATCHING")).toBe(true);
    expect(canTransition("MATCHING", "DRIVER_ASSIGNED")).toBe(true);
    expect(canTransition("DRIVER_ASSIGNED", "DRIVER_ARRIVING")).toBe(true);
    expect(canTransition("DRIVER_ARRIVING", "PIN_VERIFICATION")).toBe(true);
    expect(canTransition("PIN_VERIFICATION", "IN_PROGRESS")).toBe(true);
    expect(canTransition("IN_PROGRESS", "COMPLETED")).toBe(true);
  });

  it("rejects invalid transitions", () => {
    expect(canTransition("CREATED", "COMPLETED")).toBe(false);
    expect(canTransition("MATCHING", "IN_PROGRESS")).toBe(false);
    expect(canTransition("COMPLETED", "IN_PROGRESS")).toBe(false);
  });

  it("throws for invalid transition assertions", () => {
    expect(() => assertTransition("CREATED", "COMPLETED")).toThrow(/Invalid state transition/);
  });

  it("returns terminal states correctly", () => {
    expect(isTerminalTripState("COMPLETED")).toBe(true);
    expect(isTerminalTripState("NO_DRIVER_FOUND")).toBe(true);
    expect(isTerminalTripState("IN_PROGRESS")).toBe(false);
  });

  it("exposes non-empty transition list for active states", () => {
    expect(getAllowedTransitions("MATCHING").length).toBeGreaterThan(0);
    expect(getAllowedTransitions("COMPLETED")).toEqual([]);
  });
});

