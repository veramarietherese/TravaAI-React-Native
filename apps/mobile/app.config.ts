import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Trava AI",
  slug: "trava-ai",
  scheme: "travaai",
  version: "1.0.0",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  plugins: ["expo-router", "expo-secure-store", "expo-image"],
  experiments: {
    typedRoutes: true
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.veramarietherese.travaai"
  },
  android: {
    package: "com.veramarietherese.travaai"
  }
});
