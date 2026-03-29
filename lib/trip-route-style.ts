import type { TripState } from "@/shared/ride-hailing";

type TripVisualTheme = {
  textMuted: string;
};

const ROUTE_STATE_COLORS = {
  initiated: "#EF4444",
  accepted: "#1E40AF",
  completed: "#16A34A",
} as const;

export function getTripRouteColor(state: TripState | string | null | undefined, theme: TripVisualTheme): string {
  if (!state) return ROUTE_STATE_COLORS.accepted;

  if (state === "CREATED" || state === "MATCHING") {
    return ROUTE_STATE_COLORS.initiated;
  }

  if (
    state === "DRIVER_ASSIGNED" ||
    state === "DRIVER_ARRIVING" ||
    state === "PIN_VERIFICATION" ||
    state === "IN_PROGRESS"
  ) {
    return ROUTE_STATE_COLORS.accepted;
  }

  if (state === "COMPLETED") {
    return ROUTE_STATE_COLORS.completed;
  }

  return theme.textMuted;
}
