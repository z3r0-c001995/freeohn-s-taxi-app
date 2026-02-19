import { IS_DRIVER_APP } from "@/constants/app-variant";
import { driverTheme, riderTheme } from "@/constants/design-system";

export function useBrandTheme() {
  return IS_DRIVER_APP ? driverTheme : riderTheme;
}
