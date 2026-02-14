// Load environment variables with proper priority (system > .env)
require("./scripts/load-env.js");
import type { ExpoConfig } from "expo/config";

type AppVariant = "driver" | "seeker";

const rawVariant = (process.env.APP_VARIANT ?? process.env.EXPO_PUBLIC_APP_VARIANT ?? "seeker")
  .toLowerCase()
  .trim();
const appVariant: AppVariant = rawVariant === "driver" ? "driver" : "seeker";
process.env.EXPO_PUBLIC_APP_VARIANT = appVariant;

// Bundle ID format: space.manus.<project_name_dots>.<timestamp>
// e.g., "my-app" created at 2024-01-15 10:30:45 -> "space.manus.my.app.t20240115103045"
// Bundle ID can only contain letters, numbers, and dots
// Android requires each dot-separated segment to start with a letter
const rawBundleId = "space.manus.ride_hailing_app.t20260201043515";
const bundleId =
  rawBundleId
    .replace(/[-_]/g, ".") // Replace hyphens/underscores with dots
    .replace(/[^a-zA-Z0-9.]/g, "") // Remove invalid chars
    .replace(/\.+/g, ".") // Collapse consecutive dots
    .replace(/^\.+|\.+$/g, "") // Trim leading/trailing dots
    .toLowerCase()
    .split(".")
    .map((segment) => {
      // Android requires each segment to start with a letter
      // Prefix with 'x' if segment starts with a digit
      return /^[a-zA-Z]/.test(segment) ? segment : "x" + segment;
    })
    .join(".") || "space.manus.app";
const variantSuffix = appVariant === "driver" ? "driver" : "seeker";
const appScheme = appVariant === "driver" ? "freeohndriver" : "freeohnseeker";
const appName = appVariant === "driver" ? "Freeohn Driver" : "Freeohn Service Seeker";
const appSlug = appVariant === "driver" ? "freeohn-driver" : "freeohn-seeker";
const packageId = `${bundleId}.${variantSuffix}`;
const seekerProjectId = process.env.EAS_PROJECT_ID_SEEKER ?? "3f0b926d-bba9-4ea9-81fd-b188040f405a";
const driverProjectId = process.env.EAS_PROJECT_ID_DRIVER ?? "51241631-cc10-4138-a7ed-c6ae8eefd642";
const easProjectId = appVariant === "driver" ? driverProjectId : seekerProjectId;
process.env.EXPO_PUBLIC_DEEP_LINK_SCHEME = appScheme;

const env = {
  // App branding - update these values directly (do not use env vars)
  appName,
  appSlug,
  // S3 URL of the app logo - set this to the URL returned by generate_image when creating custom logo
  // Leave empty to use the default icon from assets/images/icon.png
  logoUrl: "",
  scheme: appScheme,
  iosBundleId: packageId,
  androidPackage: packageId,
};

const config: ExpoConfig = {
  name: env.appName,
  slug: env.appSlug,
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: env.scheme,
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    bundleIdentifier: env.iosBundleId,
    "infoPlist": {
        "ITSAppUsesNonExemptEncryption": false
      }
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#E6F4FE",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    package: env.androidPackage,
    permissions: [
      "POST_NOTIFICATIONS",
      "ACCESS_FINE_LOCATION",
      "ACCESS_COARSE_LOCATION",
      "ACCESS_BACKGROUND_LOCATION",
      "CAMERA",
      "READ_EXTERNAL_STORAGE",
      "WRITE_EXTERNAL_STORAGE"
    ],
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [
          {
            scheme: env.scheme,
            host: "*",
          },
        ],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },
  web: {
    bundler: "metro",
    output: "static",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    "expo-router",
    [
      "expo-audio",
      {
        microphonePermission: "Allow $(PRODUCT_NAME) to access your microphone.",
      },
    ],
    [
      "expo-video",
      {
        supportsBackgroundPlayback: true,
        supportsPictureInPicture: true,
      },
    ],
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#ffffff",
        dark: {
          backgroundColor: "#000000",
        },
      },
    ],
    [
      "expo-build-properties",
      {
        android: {
          buildArchs: ["armeabi-v7a", "arm64-v8a"],
          minSdkVersion: 24,
        },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    ...(easProjectId
      ? {
          eas: {
            projectId: easProjectId,
          },
        }
      : {}),
    appVariant,
  },
};

export default config;
