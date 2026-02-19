import { Text, View } from "react-native";

import { radii } from "@/constants/design-system";
import { useBrandTheme } from "@/hooks/use-brand-theme";

type BadgeTone = "neutral" | "primary" | "success" | "warning" | "danger";

interface AppBadgeProps {
  label: string;
  tone?: BadgeTone;
}

export function AppBadge({ label, tone = "neutral" }: AppBadgeProps) {
  const brand = useBrandTheme();

  const palette = (() => {
    switch (tone) {
      case "primary":
        return { bg: brand.primarySoft, fg: brand.primary };
      case "success":
        return { bg: "#DCFCE7", fg: brand.success };
      case "warning":
        return { bg: "#FEF3C7", fg: brand.warning };
      case "danger":
        return { bg: "#FEE2E2", fg: brand.danger };
      case "neutral":
      default:
        return { bg: brand.surfaceMuted, fg: brand.textMuted };
    }
  })();

  return (
    <View
      style={{
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: radii.pill,
        alignSelf: "flex-start",
        backgroundColor: palette.bg,
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: "700", color: palette.fg }}>{label}</Text>
    </View>
  );
}
