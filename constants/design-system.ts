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
  primary: "#F77316", // Exact orange from image
  primaryPressed: "#EA580C",
  primarySoft: "#FFF7ED",
  accent: "#1E40AF", // Exact blue from image
  accentSoft: "#EFF6FF",
  background: "#F8FAFF",
  surface: "#FFFFFF",
  surfaceMuted: "#F1F5F9",
  text: "#0F172A",
  textMuted: "#64748B",
  border: "#E2E8F0",
  success: "#22C55E",
  warning: "#F59E0B",
  danger: "#EF4444",
  mapUser: "#F77316",
  mapPickup: "#22C55E",
  mapDropoff: "#EF4444",
  mapDriver: "#1E40AF",
};

export const driverTheme: BrandTheme = {
  mode: "driver",
  primary: "#1E40AF",
  primaryPressed: "#1D4ED8",
  primarySoft: "#EFF6FF",
  accent: "#F77316",
  accentSoft: "#FFF7ED",
  background: "#F8FAFF",
  surface: "#FFFFFF",
  surfaceMuted: "#F1F5F9",
  text: "#0F172A",
  textMuted: "#64748B",
  border: "#E2E8F0",
  success: "#22C55E",
  warning: "#F59E0B",
  danger: "#EF4444",
  mapUser: "#1E40AF",
  mapPickup: "#F77316",
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
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  } satisfies ViewStyle,
  md: {
    shadowColor: "#0F172A",
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  } satisfies ViewStyle,
  lg: {
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  } satisfies ViewStyle,
};
