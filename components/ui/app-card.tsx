import { View, type ViewProps } from "react-native";

import { radii, shadows } from "@/constants/design-system";
import { useBrandTheme } from "@/hooks/use-brand-theme";

type CardTone = "default" | "muted" | "accent" | "primary";

interface AppCardProps extends ViewProps {
  tone?: CardTone;
  elevated?: boolean;
  padded?: boolean;
}

export function AppCard({ children, tone = "default", elevated = true, padded = true, style, ...rest }: AppCardProps) {
  const brand = useBrandTheme();

  const toneStyle = (() => {
    switch (tone) {
      case "muted":
        return { backgroundColor: brand.surfaceMuted, borderColor: brand.border };
      case "accent":
        return { backgroundColor: brand.accentSoft, borderColor: brand.border };
      case "primary":
        return { backgroundColor: brand.primarySoft, borderColor: brand.border };
      case "default":
      default:
        return { backgroundColor: brand.surface, borderColor: brand.border };
    }
  })();

  return (
    <View
      {...rest}
      style={[
        {
          borderRadius: radii.xl, // Premium rounded corners
          borderWidth: 0.5, // Thinner border
          padding: padded ? 18 : 0,
        },
        toneStyle,
        elevated ? shadows.md : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}
