import { Text, TextInput, View, type TextInputProps } from "react-native";

import { radii } from "@/constants/design-system";
import { useBrandTheme } from "@/hooks/use-brand-theme";

interface AppInputProps extends TextInputProps {
  label?: string;
  hint?: string;
  error?: string;
}

export function AppInput({ label, hint, error, style, ...props }: AppInputProps) {
  const brand = useBrandTheme();
  const helperText = error || hint;

  return (
    <View style={{ gap: 6 }}>
      {label ? (
        <Text style={{ fontSize: 13, fontWeight: "600", color: brand.text }}>{label}</Text>
      ) : null}
      <TextInput
        placeholderTextColor={brand.textMuted}
        style={[
          {
            borderRadius: radii.md,
            borderWidth: 1,
            borderColor: error ? brand.danger : brand.border,
            backgroundColor: brand.surface,
            paddingHorizontal: 14,
            paddingVertical: 12,
            color: brand.text,
            fontSize: 15,
          },
          style,
        ]}
        {...props}
      />
      {helperText ? (
        <Text style={{ fontSize: 12, color: error ? brand.danger : brand.textMuted }}>{helperText}</Text>
      ) : null}
    </View>
  );
}
