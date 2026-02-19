import { Platform } from "react-native";
import * as Application from "expo-application";

export type AppVariant = "driver" | "seeker";

function normalizeVariant(value: string | null | undefined): AppVariant | null {
  if (!value) return null;
  const normalized = value.toLowerCase().trim();
  if (normalized === "driver") return "driver";
  if (normalized === "seeker") return "seeker";
  return null;
}

function inferVariantFromApplicationId(appId: string | null | undefined): AppVariant | null {
  if (!appId) return null;
  const normalized = appId.toLowerCase();
  if (normalized.includes(".driver")) return "driver";
  if (normalized.includes(".seeker")) return "seeker";
  return null;
}

const envVariant = normalizeVariant(process.env.EXPO_PUBLIC_APP_VARIANT);
const nativeVariant =
  Platform.OS === "web" ? null : inferVariantFromApplicationId(Application.applicationId);

// Prefer native package-id detection so one Metro instance can serve both installed variants.
export const APP_VARIANT: AppVariant = nativeVariant ?? envVariant ?? "seeker";
export const IS_DRIVER_APP = APP_VARIANT === "driver";
export const IS_SEEKER_APP = APP_VARIANT === "seeker";

export const APP_LABEL = IS_DRIVER_APP ? "Freeohn Driver" : "Freeohn's Ride App";
