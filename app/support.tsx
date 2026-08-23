import { ScrollView, Text, TouchableOpacity, View, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "@/components/screen-container";
import { DriverNavBar } from "@/components/navigation/DriverNavBar";
import { PassengerNavBar } from "@/components/navigation/PassengerNavBar";
import { AppCard } from "@/components/ui/app-card";
import { IS_DRIVER_APP } from "@/constants/app-variant";
import { radii, shadows } from "@/constants/design-system";
import { useBrandTheme } from "@/hooks/use-brand-theme";

export default function SupportScreen() {
  const router = useRouter();
  const brand = useBrandTheme();

  const categories = [
    { id: 'ride', label: 'Ride Issues', icon: 'car-outline', color: '#F97316' },
    { id: 'payment', label: 'Payment', icon: 'card-outline', color: '#22C55E' },
    { id: 'account', label: 'Account', icon: 'person-outline', color: '#3B82F6' },
    { id: 'safety', label: 'Safety', icon: 'shield-checkmark-outline', color: '#EF4444' },
  ];

  const faqs = [
    "How to book a ride?",
    "Payment methods",
    "Cancel a ride",
    "Lost item",
    "Driver issues",
  ];

  return (
    <ScreenContainer className="bg-background" containerClassName="bg-background">
      <View style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20, flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity 
            onPress={() => router.back()}
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: brand.surface, alignItems: 'center', justifyContent: 'center', ...shadows.sm }}
          >
            <Ionicons name="arrow-back" size={24} color={brand.text} />
          </TouchableOpacity>
          <Text style={{ fontSize: 24, fontWeight: '800', color: brand.text, marginLeft: 16 }}>Support</Text>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={false}>
          {/* Hero Card */}
          <AppCard tone="primary" style={{ marginBottom: 24, padding: 24 }}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: brand.text }}>How can we help you today?</Text>
            <View style={{ marginTop: 20, flexDirection: 'row', alignItems: 'center', backgroundColor: brand.surface, borderRadius: radii.lg, paddingHorizontal: 16, height: 50, ...shadows.sm }}>
               <Ionicons name="search" size={20} color={brand.textMuted} />
               <TextInput 
                 placeholder="Search for help..." 
                 placeholderTextColor={brand.textMuted}
                 style={{ flex: 1, marginLeft: 12, fontSize: 16, color: brand.text }} 
               />
            </View>
          </AppCard>

          {/* Categories Grid */}
          <View style={{ marginBottom: 32 }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: brand.text, marginBottom: 16 }}>Categories</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {categories.map((cat) => (
                <TouchableOpacity 
                  key={cat.id} 
                  style={{ 
                    width: '48%', 
                    backgroundColor: brand.surface, 
                    borderRadius: radii.xl, 
                    padding: 20, 
                    alignItems: 'center',
                    ...shadows.sm,
                    borderWidth: 1,
                    borderColor: brand.border
                  }}
                >
                  <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: brand.surfaceMuted, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                    <Ionicons name={cat.icon as any} size={24} color={cat.color} />
                  </View>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: brand.text }}>{cat.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Top Questions */}
          <View>
            <Text style={{ fontSize: 18, fontWeight: '800', color: brand.text, marginBottom: 16 }}>Top Questions</Text>
            {faqs.map((faq, index) => (
              <TouchableOpacity 
                key={index}
                style={{ 
                  flexDirection: 'row', 
                  alignItems: 'center', 
                  backgroundColor: brand.surface, 
                  borderRadius: radii.lg, 
                  padding: 16, 
                  marginBottom: 12,
                  ...shadows.sm
                }}
              >
                <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: brand.text }}>{faq}</Text>
                <Ionicons name="chevron-forward" size={20} color={brand.textMuted} />
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
        {IS_DRIVER_APP ? <DriverNavBar /> : <PassengerNavBar />}
      </View>
    </ScreenContainer>
  );
}
