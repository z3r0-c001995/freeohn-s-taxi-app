import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";

export function StartupSplash() {
  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <Image source={require("../assets/images/splash-icon.png")} style={styles.logo} resizeMode="contain" />
      </View>
      <Text style={styles.title}>Ride Hailing App</Text>
      <Text style={styles.subtitle}>Finding your ride...</Text>
      <ActivityIndicator size="small" color="#1D4ED8" style={styles.loader} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  logoContainer: {
    width: 112,
    height: 112,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E0F2FE",
    marginBottom: 24,
  },
  logo: {
    width: 88,
    height: 88,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0F172A",
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    color: "#475569",
  },
  loader: {
    marginTop: 20,
  },
});
