import { useState } from "react";
import { Alert, ScrollView, Share, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "@/components/screen-container";
import { DriverNavBar } from "@/components/navigation/DriverNavBar";
import { PassengerNavBar } from "@/components/navigation/PassengerNavBar";
import { AppCard } from "@/components/ui/app-card";
import { AppButton } from "@/components/ui/app-button";
import { IS_DRIVER_APP } from "@/constants/app-variant";
import { radii, shadows } from "@/constants/design-system";
import { useBrandTheme } from "@/hooks/use-brand-theme";
import { useAppStore } from "@/lib/store";

export default function InviteFriendsScreen() {
  const router = useRouter();
  const brand = useBrandTheme();
  const { currentUser } = useAppStore();
  const [copied, setCopied] = useState(false);

  // Deterministic referral code from phone digits
  const referralCode = currentUser
    ? `FREEOHN${String(currentUser.id).slice(-5).toUpperCase()}`
    : "FREEOHN00000";

  const inviteLink = `https://freeohn.app/invite/${referralCode}`;

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Join me on Freeohn, Zambia's ride-hailing app in Mansa! Use my code ${referralCode} and we both get 10% off. Download: ${inviteLink}`,
        url: inviteLink,
      });
    } catch {
      Alert.alert("Share", `Your referral link: ${inviteLink}`);
    }
  };

  const handleCopy = () => {
    setCopied(true);
    Alert.alert("Copied!", `Referral code ${referralCode} copied.`);
    setTimeout(() => setCopied(false), 2000);
  };

  const confirmedCount = 0; // TODO: fetch from invites DB table
  const discountEarned = confirmedCount >= 5 ? 20 : confirmedCount >= 3 ? 10 : 0;

  return (
    <ScreenContainer className="bg-background" containerClassName="bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <View style={{ gap: 16, paddingBottom: 24 }}>
          {/* Header */}
          <View
            style={{
              borderRadius: radii.xl,
              padding: 20,
              backgroundColor: "#4C1D95",
              ...shadows.md,
            }}
          >
            <TouchableOpacity
              onPress={() => router.back()}
              style={{ width: 38, height: 38, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center", marginBottom: 12 }}
            >
              <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={{ fontSize: 28, fontWeight: "800", color: "#FFFFFF" }}>Invite Friends</Text>
            <Text style={{ marginTop: 6, fontSize: 13, color: "#DDD6FE" }}>
              Invite 3–5 friends and earn ride discounts for both of you!
            </Text>
          </View>

          {/* Discount Progress */}
          <AppCard>
            <Text style={{ fontWeight: "800", fontSize: 16, color: brand.text, marginBottom: 12 }}>
              Your Progress
            </Text>
            <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
              {[{ target: 3, discount: 10 }, { target: 5, discount: 20 }].map((tier) => (
                <View key={tier.target} style={{ alignItems: "center" }}>
                  <View
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 32,
                      backgroundColor: confirmedCount >= tier.target ? "#8B5CF6" : brand.surfaceMuted,
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: 8,
                    }}
                  >
                    {confirmedCount >= tier.target ? (
                      <Ionicons name="checkmark" size={28} color="#FFFFFF" />
                    ) : (
                      <Text style={{ fontWeight: "800", fontSize: 18, color: brand.textMuted }}>
                        {tier.target}
                      </Text>
                    )}
                  </View>
                  <Text style={{ fontWeight: "700", color: brand.text, fontSize: 13 }}>
                    {tier.discount}% OFF
                  </Text>
                  <Text style={{ fontSize: 11, color: brand.textMuted }}>{tier.target} friends</Text>
                </View>
              ))}
              <View style={{ alignItems: "center" }}>
                <View
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 32,
                    backgroundColor: "#F5F3FF",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 8,
                  }}
                >
                  <Text style={{ fontWeight: "800", fontSize: 18, color: "#8B5CF6" }}>
                    {confirmedCount}
                  </Text>
                </View>
                <Text style={{ fontWeight: "700", color: brand.text, fontSize: 13 }}>Confirmed</Text>
                <Text style={{ fontSize: 11, color: brand.textMuted }}>so far</Text>
              </View>
            </View>
            {discountEarned > 0 && (
              <View style={{ marginTop: 14, backgroundColor: "#F0FDF4", borderRadius: radii.md, padding: 12, flexDirection: "row", alignItems: "center" }}>
                <Ionicons name="gift" size={18} color="#22C55E" />
                <Text style={{ marginLeft: 8, fontWeight: "700", color: "#15803D" }}>
                  🎉 You've earned {discountEarned}% off your next ride!
                </Text>
              </View>
            )}
          </AppCard>

          {/* Referral Code */}
          <AppCard>
            <Text style={{ fontWeight: "800", fontSize: 16, color: brand.text, marginBottom: 12 }}>
              Your Referral Code
            </Text>
            <TouchableOpacity
              onPress={handleCopy}
              style={{
                backgroundColor: "#F5F3FF",
                borderRadius: radii.md,
                padding: 16,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                borderWidth: 1.5,
                borderColor: "#8B5CF6",
                borderStyle: "dashed",
              }}
            >
              <Text style={{ fontWeight: "800", fontSize: 20, color: "#7C3AED", letterSpacing: 2 }}>
                {referralCode}
              </Text>
              <Ionicons name={copied ? "checkmark-circle" : "copy-outline"} size={22} color="#8B5CF6" />
            </TouchableOpacity>

            <AppButton
              label="Share Invite Link"
              onPress={handleShare}
              style={{ marginTop: 14 }}
              leftIcon={<Ionicons name="share-social-outline" size={18} color="#FFFFFF" />}
            />
          </AppCard>

          {/* How it works */}
          <AppCard tone="muted">
            <Text style={{ fontWeight: "800", fontSize: 16, color: brand.text, marginBottom: 12 }}>
              How It Works
            </Text>
            {[
              { step: "1", text: "Share your referral code or link with friends in Mansa." },
              { step: "2", text: "Your friend signs up using your code." },
              { step: "3", text: "Once they complete their first ride, it counts as confirmed." },
              { step: "4", text: "Get 3 confirmations = 10% off. Get 5 = 20% off your next ride!" },
            ].map((item) => (
              <View key={item.step} style={{ flexDirection: "row", marginBottom: 10 }}>
                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: "#8B5CF6", alignItems: "center", justifyContent: "center", marginRight: 12, marginTop: 1 }}>
                  <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 12 }}>{item.step}</Text>
                </View>
                <Text style={{ flex: 1, color: brand.textMuted, fontSize: 14, lineHeight: 20 }}>{item.text}</Text>
              </View>
            ))}
          </AppCard>
        </View>
      </ScrollView>
      {IS_DRIVER_APP ? <DriverNavBar /> : <PassengerNavBar />}
    </ScreenContainer>
  );
}
