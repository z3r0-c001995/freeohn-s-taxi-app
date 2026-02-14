import type { TripState } from "../../../shared/ride-hailing";

type TransitionGraph = Record<TripState, ReadonlyArray<TripState>>;

const transitions: TransitionGraph = {
  CREATED: ["MATCHING", "CANCELLED_BY_PASSENGER"],
  MATCHING: ["DRIVER_ASSIGNED", "NO_DRIVER_FOUND", "CANCELLED_BY_PASSENGER"],
  DRIVER_ASSIGNED: ["DRIVER_ARRIVING", "CANCELLED_BY_PASSENGER", "CANCELLED_BY_DRIVER"],
  DRIVER_ARRIVING: ["PIN_VERIFICATION", "IN_PROGRESS", "CANCELLED_BY_PASSENGER", "CANCELLED_BY_DRIVER"],
  PIN_VERIFICATION: ["IN_PROGRESS", "CANCELLED_BY_PASSENGER", "CANCELLED_BY_DRIVER"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED_BY_DRIVER"],
  COMPLETED: [],
  CANCELLED_BY_PASSENGER: [],
  CANCELLED_BY_DRIVER: [],
  NO_DRIVER_FOUND: [],
};

export function isTerminalTripState(state: TripState): boolean {
  return (
    state === "COMPLETED" ||
    state === "CANCELLED_BY_DRIVER" ||
    state === "CANCELLED_BY_PASSENGER" ||
    state === "NO_DRIVER_FOUND"
  );
}

export function canTransition(from: TripState, to: TripState): boolean {
  return transitions[from].includes(to);
}

export function assertTransition(from: TripState, to: TripState): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid state transition from ${from} to ${to}`);
  }
}

export function getAllowedTransitions(state: TripState): ReadonlyArray<TripState> {
  return transitions[state];
}

