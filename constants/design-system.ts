import type { ViewStyle } from "react-native";

export type AppThemeMode = "rider" | "driver";

export interface BrandTheme {
  mode: AppThemeMode;
  primary: string;
  primaryPressed: string;
  primarySoft: string;
  accent: string;
  accentSoft: string;
  background: string;
  surface: string;
  surfaceMuted: string;
  text: string;
  textMuted: string;
  border: string;
  success: string;
  warning: string;
  danger: string;
  mapUser: string;
  mapPickup: string;
  mapDropoff: string;
  mapDriver: string;
}

export const riderTheme: BrandTheme = {
  mode: "rider",
  primary: "#F97316",
  primaryPressed: "#EA580C",
  primarySoft: "#FFF2E8",
  accent: "#1E40AF",
  accentSoft: "#E8EEFF",
  background: "#F7FAFF",
  surface: "#FFFFFF",
  surfaceMuted: "#F8FAFC",
  text: "#0F172A",
  textMuted: "#64748B",
  border: "#E2E8F0",
  success: "#16A34A",
  warning: "#F59E0B",
  danger: "#EF4444",
  mapUser: "#F97316",
  mapPickup: "#16A34A",
  mapDropoff: "#EF4444",
  mapDriver: "#1E40AF",
};

export const driverTheme: BrandTheme = {
  mode: "driver",
  primary: "#1E40AF",
  primaryPressed: "#1D4ED8",
  primarySoft: "#EAF0FF",
  accent: "#F97316",
  accentSoft: "#FFF2E8",
  background: "#F6F8FC",
  surface: "#FFFFFF",
  surfaceMuted: "#F8FAFC",
  text: "#0F172A",
  textMuted: "#64748B",
  border: "#E2E8F0",
  success: "#16A34A",
  warning: "#F59E0B",
  danger: "#EF4444",
  mapUser: "#1E40AF",
  mapPickup: "#F97316",
  mapDropoff: "#EF4444",
  mapDriver: "#1E40AF",
};

export const spacing = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  xxl: 32,
} as const;

export const radii = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
} as const;

export const shadows = {
  sm: {
    shadowColor: "#0F172A",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  } satisfies ViewStyle,
  md: {
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  } satisfies ViewStyle,
};
