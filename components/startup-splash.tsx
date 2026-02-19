import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { APP_LABEL, IS_DRIVER_APP } from "@/constants/app-variant";
import { driverTheme, riderTheme } from "@/constants/design-system";

export function StartupSplash() {
  const brand = IS_DRIVER_APP ? driverTheme : riderTheme;

  return (
    <View style={[styles.container, { backgroundColor: "#081833" }]}>
      <View style={[styles.glowCircleTop, { backgroundColor: "rgba(249, 115, 22, 0.38)" }]} />
      <View style={[styles.glowCircleBottom, { backgroundColor: "rgba(30, 64, 175, 0.34)" }]} />
      <View style={[styles.logoContainer, { borderColor: "rgba(255,255,255,0.16)" }]}>
        <Text style={[styles.logoLetter, { color: brand.primary }]}>F</Text>
      </View>
      <Text style={styles.title}>{APP_LABEL}</Text>
      <Text style={styles.subtitle}>
        {IS_DRIVER_APP ? "Connecting to dispatch..." : "Finding your ride..."}
      </Text>
      <ActivityIndicator size="small" color={brand.primary} style={styles.loader} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    overflow: "hidden",
  },
  glowCircleTop: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 999,
    top: -120,
    right: -70,
  },
  glowCircleBottom: {
    position: "absolute",
    width: 340,
    height: 340,
    borderRadius: 999,
    bottom: -150,
    left: -110,
  },
  logoContainer: {
    width: 118,
    height: 118,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    marginBottom: 24,
  },
  logoLetter: {
    fontSize: 54,
    fontWeight: "800",
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#F8FAFC",
    textAlign: "center",
  },
  subtitle: {
    marginTop: 10,
    fontSize: 14,
    color: "#CBD5E1",
    textAlign: "center",
  },
  loader: {
    marginTop: 20,
  },
});
