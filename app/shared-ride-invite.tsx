import { useState } from "react";
import { Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "@/components/screen-container";
import { AppBadge } from "@/components/ui/app-badge";
import { AppButton } from "@/components/ui/app-button";
import { AppCard } from "@/components/ui/app-card";
import { AppInput } from "@/components/ui/app-input";
import { radii, shadows } from "@/constants/design-system";
import { useBrandTheme } from "@/hooks/use-brand-theme";

export default function SharedRideInviteScreen() {
  const router = useRouter();
  const brand = useBrandTheme();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleSendInvite = async () => {
    if (!phoneNumber || phoneNumber.length < 8) {
      Alert.alert("Invalid number", "Please enter a valid phone number to invite.");
      return;
    }
    
    setIsSending(true);
    try {
      // Simulate API call to send invite
      await new Promise(res => setTimeout(res, 1000));
      Alert.alert("Invite Sent", `We've sent an invitation to ${phoneNumber} to join this ride.`);
      setPhoneNumber("");
      router.back();
    } catch (e) {
      Alert.alert("Error", "Could not send invitation at this time.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <ScreenContainer className="bg-background" containerClassName="bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <View style={{ gap: 16, paddingBottom: 20 }}>
          <View
            style={{
              borderRadius: radii.xl,
              padding: 18,
              backgroundColor: "#0A1E49",
              ...shadows.md,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <TouchableOpacity
                onPress={() => router.back()}
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 999,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "rgba(255,255,255,0.14)",
                }}
              >
                <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
              </TouchableOpacity>
              <AppBadge label="Carpool" tone="primary" />
            </View>
            <Text style={{ marginTop: 14, fontSize: 28, fontWeight: "800", color: "#FFFFFF" }}>Share Ride</Text>
            <Text style={{ marginTop: 6, fontSize: 13, color: "#CBD5E1" }}>
              Invite a friend to join this trip and split the fare.
            </Text>
          </View>

          <AppCard>
            <Text style={{ fontSize: 16, fontWeight: "800", color: brand.text }}>Invite a Friend</Text>
            <Text style={{ marginTop: 8, fontSize: 13, color: brand.textMuted, marginBottom: 12 }}>
              Enter their phone number to send them an SMS invite link. They will be added as a co-passenger once they accept.
            </Text>
            
            <AppInput
              label="Phone Number"
              placeholder="+260 97 0000000"
              keyboardType="phone-pad"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
            />

            <View style={{ marginTop: 16 }}>
              <AppButton 
                label="Send Invite" 
                onPress={handleSendInvite} 
                loading={isSending}
                leftIcon={<Ionicons name="paper-plane-outline" size={18} color="#FFFFFF" />}
              />
            </View>
          </AppCard>
          
          <AppCard tone="muted">
             <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
               <Ionicons name="information-circle-outline" size={24} color={brand.textMuted} />
               <View style={{ flex: 1 }}>
                 <Text style={{ fontSize: 13, color: brand.textMuted }}>
                    Only users within your immediate locale will be able to join an ongoing ride optimally.
                 </Text>
               </View>
             </View>
          </AppCard>

        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
