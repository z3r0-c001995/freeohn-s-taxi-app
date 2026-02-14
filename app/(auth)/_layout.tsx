import { Stack } from "expo-router";

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="phone-entry" />
      <Stack.Screen name="otp-verification" />
      <Stack.Screen name="profile-setup" />
    </Stack>
  );
}
