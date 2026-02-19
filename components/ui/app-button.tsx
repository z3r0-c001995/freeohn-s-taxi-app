import { ActivityIndicator, Pressable, Text, View, type StyleProp, type ViewStyle } from "react-native";
import type { ReactNode } from "react";

import { radii, shadows } from "@/constants/design-system";
import { useBrandTheme } from "@/hooks/use-brand-theme";

type ButtonVariant = "primary" | "secondary" | "outline" | "danger" | "success" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

interface AppButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  style?: StyleProp<ViewStyle>;
  fullWidth?: boolean;
  testID?: string;
}

const sizeStyles: Record<ButtonSize, { py: number; px: number; fontSize: number }> = {
  sm: { py: 10, px: 14, fontSize: 13 },
  md: { py: 13, px: 16, fontSize: 15 },
  lg: { py: 15, px: 18, fontSize: 16 },
};

export function AppButton({
  label,
  onPress,
  variant = "primary",
  size = "md",
  disabled,
  loading,
  leftIcon,
  rightIcon,
  style,
  fullWidth = true,
  testID,
}: AppButtonProps) {
  const brand = useBrandTheme();
  const activeVariant = disabled ? "ghost" : variant;
  const selectedSize = sizeStyles[size];

  const variantStyles = (() => {
    switch (activeVariant) {
      case "secondary":
        return {
          backgroundColor: brand.accent,
          borderColor: brand.accent,
          textColor: "#FFFFFF",
        };
      case "outline":
        return {
          backgroundColor: brand.surface,
          borderColor: brand.accent,
          textColor: brand.accent,
        };
      case "danger":
        return {
          backgroundColor: brand.danger,
          borderColor: brand.danger,
          textColor: "#FFFFFF",
        };
      case "success":
        return {
          backgroundColor: brand.success,
          borderColor: brand.success,
          textColor: "#FFFFFF",
        };
      case "ghost":
        return {
          backgroundColor: brand.surfaceMuted,
          borderColor: brand.border,
          textColor: brand.textMuted,
        };
      case "primary":
      default:
        return {
          backgroundColor: brand.primary,
          borderColor: brand.primary,
          textColor: "#FFFFFF",
        };
    }
  })();

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        {
          borderRadius: radii.md,
          borderWidth: 1,
          borderColor: variantStyles.borderColor,
          backgroundColor: pressed
            ? activeVariant === "primary"
              ? brand.primaryPressed
              : variantStyles.backgroundColor
            : variantStyles.backgroundColor,
          paddingVertical: selectedSize.py,
          paddingHorizontal: selectedSize.px,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: 8,
          width: fullWidth ? "100%" : undefined,
          opacity: disabled || loading ? 0.72 : 1,
        },
        activeVariant === "primary" || activeVariant === "secondary" ? shadows.sm : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variantStyles.textColor} />
      ) : (
        <>
          {leftIcon}
          <Text
            style={{
              fontSize: selectedSize.fontSize,
              fontWeight: "700",
              color: variantStyles.textColor,
            }}
          >
            {label}
          </Text>
          {rightIcon}
        </>
      )}
    </Pressable>
  );
}
