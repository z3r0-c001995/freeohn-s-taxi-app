import { useState, useEffect } from "react";
import { Alert, Image, ScrollView, Switch, Text, TouchableOpacity, View, Platform, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "@/components/screen-container";
import { DriverNavBar } from "@/components/navigation/DriverNavBar";
import { PassengerNavBar } from "@/components/navigation/PassengerNavBar";
import { AppBadge } from "@/components/ui/app-badge";
import { AppButton } from "@/components/ui/app-button";
import { AppCard } from "@/components/ui/app-card";
import { AppInput } from "@/components/ui/app-input";
import { APP_LABEL, IS_DRIVER_APP, IS_SEEKER_APP } from "@/constants/app-variant";
import { APP_LOGO } from "@/constants/brand-assets";
import { radii, shadows } from "@/constants/design-system";
import { useBrandTheme } from "@/hooks/use-brand-theme";
import { useAppStore } from "@/lib/store";
import { updateUser } from "@/lib/db-service";

export default function SettingsScreen() {
  const router = useRouter();
  const brand = useBrandTheme();
  const {
    currentUser,
    setCurrentUser,
    setIsAuthenticated,
    setDriverProfile,
    setActiveRide,
    updateCurrentUser,
    persist,
  } = useAppStore();

  const isDriver = IS_DRIVER_APP || currentUser?.role === "driver";
  const phone = (currentUser as Record<string, any> | null)?.phone;

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [locationEnabled, setLocationEnabled] = useState(true);

  useEffect(() => {
    if (currentUser) {
      const parts = (currentUser.name || "").split(" ");
      setFirstName((currentUser as any).firstName || parts[0] || "");
      setLastName((currentUser as any).lastName || parts.slice(1).join(" ") || "");
      setEmail(currentUser.email || "");
      setPhoneNumber(phone || "");
    }
  }, [currentUser, phone]);

  const handleSaveProfile = async () => {
    if (!currentUser) return;
    setIsSaving(true);
    try {
      if (Platform.OS !== "web") {
        await updateUser(currentUser.id.toString(), {
          firstName,
          lastName,
          email,
          phone: phoneNumber,
        });
      }
      updateCurrentUser({
        name: `${firstName} ${lastName}`.trim(),
        email,
        phone: phoneNumber,
      } as any);
      await persist();
      Alert.alert("Success", "Profile updated successfully.");
      setIsEditing(false);
    } catch (e) {
      Alert.alert("Error", "Could not save profile.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert("Sign out", "Do you want to sign out from this device?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          setActiveRide(null);
          setDriverProfile(null);
          setCurrentUser(null);
          setIsAuthenticated(false);
          await persist();
          router.replace("/(auth)/onboarding");
        },
      },
    ]);
  };

  if (!currentUser) {
    return (
      <ScreenContainer className="bg-background items-center justify-center">
        <Text style={{ color: brand.textMuted }}>Loading settings...</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="bg-background" containerClassName="bg-background">
      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
          <View style={{ gap: 16, paddingHorizontal: 16, paddingTop: 16 }}>
            {/* Header Account Banner */}
            <View
              style={[
                styles.accountHeader,
                {
                  backgroundColor: "#0A1E49",
                  borderColor: "#1E3A8A",
                },
              ]}
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <Image
                    source={APP_LOGO}
                    style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: "#FFFFFF" }}
                    resizeMode="cover"
                  />
                  <View>
                    <Text style={{ color: "#94A3B8", fontSize: 11, fontWeight: "600", textTransform: "uppercase" }}>
                      {isDriver ? "Driver Account" : "Passenger Account"}
                    </Text>
                    <Text style={{ color: "#FFFFFF", fontSize: 20, fontWeight: "800" }}>{currentUser.name}</Text>
                  </View>
                </View>
                <AppBadge label={isDriver ? "Driver" : "Seeker"} tone={isDriver ? "success" : "primary"} />
              </View>
              <Text style={{ marginTop: 10, color: "#CBD5E1", fontSize: 12 }}>{APP_LABEL}</Text>
            </View>

            {/* Profile Information & Edit Card */}
            <AppCard>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontSize: 16, fontWeight: "800", color: brand.text }}>Profile Information</Text>
                {!isEditing ? (
                  <TouchableOpacity onPress={() => setIsEditing(true)}>
                    <Text style={{ color: brand.primary, fontWeight: "700" }}>Edit</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {isEditing ? (
                <View style={{ marginTop: 12, gap: 10 }}>
                  <AppInput label="First Name" value={firstName} onChangeText={setFirstName} />
                  <AppInput label="Last Name" value={lastName} onChangeText={setLastName} />
                  <AppInput label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
                  <AppInput label="Phone Number" value={phoneNumber} onChangeText={setPhoneNumber} keyboardType="phone-pad" />
                  <View style={{ flexDirection: "row", gap: 10, marginTop: 6 }}>
                    <AppButton
                      label="Cancel"
                      variant="outline"
                      onPress={() => setIsEditing(false)}
                      style={{ flex: 1 }}
                    />
                    <AppButton
                      label="Save"
                      onPress={handleSaveProfile}
                      loading={isSaving}
                      style={{ flex: 1 }}
                    />
                  </View>
                </View>
              ) : (
                <View style={{ marginTop: 10, gap: 6 }}>
                  <View style={styles.profileRow}>
                    <Text style={[styles.profileLabel, { color: brand.textMuted }]}>Name</Text>
                    <Text style={[styles.profileValue, { color: brand.text }]}>{currentUser.name}</Text>
                  </View>
                  {phone ? (
                    <View style={styles.profileRow}>
                      <Text style={[styles.profileLabel, { color: brand.textMuted }]}>Phone</Text>
                      <Text style={[styles.profileValue, { color: brand.text }]}>{String(phone)}</Text>
                    </View>
                  ) : null}
                  {currentUser.email ? (
                    <View style={styles.profileRow}>
                      <Text style={[styles.profileLabel, { color: brand.textMuted }]}>Email</Text>
                      <Text style={[styles.profileValue, { color: brand.text }]}>{currentUser.email}</Text>
                    </View>
                  ) : null}
                </View>
              )}
            </AppCard>

            {/* DRIVER MENUS */}
            {isDriver && (
              <AppCard tone="muted">
                <Text style={{ fontSize: 16, fontWeight: "800", color: brand.text, marginBottom: 10 }}>
                  Driver Management
                </Text>
                <View style={{ gap: 8 }}>
                  <AppButton
                    label="Driver Profile & Documents"
                    variant="outline"
                    onPress={() => router.push("/driver-profile" as never)}
                    leftIcon={<Ionicons name="shield-checkmark-outline" size={18} color={brand.primary} />}
                  />
                  <AppButton
                    label="Earnings & Cashout"
                    variant="outline"
                    onPress={() => router.push("/driver-earnings" as never)}
                    leftIcon={<Ionicons name="wallet-outline" size={18} color={brand.primary} />}
                  />
                  <AppButton
                    label="Completed Trips History"
                    variant="outline"
                    onPress={() => router.push("/ride-history" as never)}
                    leftIcon={<Ionicons name="time-outline" size={18} color={brand.primary} />}
                  />
                  <AppButton
                    label="Invite Friends & Drivers"
                    variant="outline"
                    onPress={() => router.push("/invite-friends" as never)}
                    leftIcon={<Ionicons name="gift-outline" size={18} color={brand.primary} />}
                  />
                  <TouchableOpacity
                    onPress={() => router.push("/safety-center" as never)}
                    style={[styles.menuNavRow, { borderColor: brand.border, backgroundColor: brand.surface }]}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <Ionicons name="shield-half-outline" size={20} color={brand.primary} />
                      <Text style={{ color: brand.text, fontWeight: "700", fontSize: 14 }}>Driver Safety Center</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={brand.textMuted} />
                  </TouchableOpacity>
                </View>
              </AppCard>
            )}

            {/* PASSENGER MENUS (Seeker) */}
            {!isDriver && (
              <>
                {/* Rides & Payments Hub */}
                <AppCard tone="muted">
                  <Text style={{ fontSize: 16, fontWeight: "800", color: brand.text, marginBottom: 12 }}>
                    Rides & Payment
                  </Text>
                  <View style={{ gap: 8 }}>
                    <TouchableOpacity
                      onPress={() => router.push("/payment" as never)}
                      style={[styles.menuNavRow, { borderColor: brand.border, backgroundColor: brand.surface }]}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <Ionicons name="wallet-outline" size={20} color={brand.primary} />
                        <View>
                          <Text style={{ color: brand.text, fontWeight: "700", fontSize: 14 }}>Payment Methods</Text>
                          <Text style={{ color: brand.textMuted, fontSize: 11 }}>Mobile Money (MoMo), Cards, Cash</Text>
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={brand.textMuted} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => router.push("/ride-history" as never)}
                      style={[styles.menuNavRow, { borderColor: brand.border, backgroundColor: brand.surface }]}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <Ionicons name="receipt-outline" size={20} color={brand.primary} />
                        <View>
                          <Text style={{ color: brand.text, fontWeight: "700", fontSize: 14 }}>My Trips & Receipts</Text>
                          <Text style={{ color: brand.textMuted, fontSize: 11 }}>View history, receipts & ratings</Text>
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={brand.textMuted} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => router.push("/promotions" as never)}
                      style={[styles.menuNavRow, { borderColor: brand.border, backgroundColor: brand.surface }]}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <Ionicons name="pricetag-outline" size={20} color={brand.primary} />
                        <View>
                          <Text style={{ color: brand.text, fontWeight: "700", fontSize: 14 }}>Promotions & Discounts</Text>
                          <Text style={{ color: brand.textMuted, fontSize: 11 }}>Coupons, promo codes & deals</Text>
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={brand.textMuted} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => router.push("/favourites" as never)}
                      style={[styles.menuNavRow, { borderColor: brand.border, backgroundColor: brand.surface }]}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <Ionicons name="bookmark-outline" size={20} color={brand.primary} />
                        <View>
                          <Text style={{ color: brand.text, fontWeight: "700", fontSize: 14 }}>Saved Places</Text>
                          <Text style={{ color: brand.textMuted, fontSize: 11 }}>Home, Work & frequent destinations</Text>
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={brand.textMuted} />
                    </TouchableOpacity>
                  </View>
                </AppCard>

                {/* Safety & Support Hub */}
                <AppCard tone="muted">
                  <Text style={{ fontSize: 16, fontWeight: "800", color: brand.text, marginBottom: 12 }}>
                    Safety & Support
                  </Text>
                  <View style={{ gap: 8 }}>
                    <TouchableOpacity
                      onPress={() => router.push("/safety-center" as never)}
                      style={[styles.menuNavRow, { borderColor: brand.border, backgroundColor: brand.surface }]}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <Ionicons name="shield-checkmark-outline" size={20} color="#16A34A" />
                        <View>
                          <Text style={{ color: brand.text, fontWeight: "700", fontSize: 14 }}>Safety Center & SOS</Text>
                          <Text style={{ color: brand.textMuted, fontSize: 11 }}>Emergency assistance & ride sharing</Text>
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={brand.textMuted} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => router.push("/invite-friends" as never)}
                      style={[styles.menuNavRow, { borderColor: brand.border, backgroundColor: brand.surface }]}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <Ionicons name="gift-outline" size={20} color="#EA580C" />
                        <View>
                          <Text style={{ color: brand.text, fontWeight: "700", fontSize: 14 }}>Invite Friends</Text>
                          <Text style={{ color: brand.textMuted, fontSize: 11 }}>Share referral code & earn free rides</Text>
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={brand.textMuted} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => router.push("/support" as never)}
                      style={[styles.menuNavRow, { borderColor: brand.border, backgroundColor: brand.surface }]}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <Ionicons name="help-buoy-outline" size={20} color={brand.primary} />
                        <View>
                          <Text style={{ color: brand.text, fontWeight: "700", fontSize: 14 }}>Help & Support</Text>
                          <Text style={{ color: brand.textMuted, fontSize: 11 }}>24/7 customer service & FAQs</Text>
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={brand.textMuted} />
                    </TouchableOpacity>
                  </View>
                </AppCard>
              </>
            )}

            {/* App Settings Card */}
            <AppCard>
              <Text style={{ fontSize: 16, fontWeight: "800", color: brand.text }}>App Preferences</Text>
              <View style={{ marginTop: 12, gap: 10 }}>
                <View
                  style={[
                    styles.switchRow,
                    {
                      borderColor: brand.border,
                      backgroundColor: brand.surfaceMuted,
                    },
                  ]}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Ionicons name="notifications-outline" size={18} color={brand.primary} />
                    <Text style={{ color: brand.text, fontWeight: "600" }}>Push notifications</Text>
                  </View>
                  <Switch value={notificationsEnabled} onValueChange={setNotificationsEnabled} />
                </View>

                <View
                  style={[
                    styles.switchRow,
                    {
                      borderColor: brand.border,
                      backgroundColor: brand.surfaceMuted,
                    },
                  ]}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Ionicons name="navigate-outline" size={18} color={brand.primary} />
                    <Text style={{ color: brand.text, fontWeight: "600" }}>Location services</Text>
                  </View>
                  <Switch value={locationEnabled} onValueChange={setLocationEnabled} />
                </View>
              </View>
            </AppCard>

            {/* Sign Out Action Button */}
            <AppButton label="Sign Out" variant="danger" onPress={handleLogout} />
          </View>
        </ScrollView>

        {/* Universal Role-based Bottom Navigation Bar */}
        {isDriver ? <DriverNavBar /> : <PassengerNavBar />}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  accountHeader: {
    borderRadius: radii.xl,
    padding: 18,
    borderWidth: 1,
    ...shadows.md,
  },
  profileRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  profileLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  profileValue: {
    fontSize: 14,
    fontWeight: "700",
  },
  menuNavRow: {
    borderRadius: radii.md,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  switchRow: {
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
});
