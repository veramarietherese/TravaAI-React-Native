import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => {
  const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
  return {
    ...config,
    name: "Trava AI",
    slug: "trava-ai",
    scheme: "travaai",
    version: "1.0.0",
    orientation: "portrait",
    userInterfaceStyle: "automatic",
    plugins: [
      "expo-router",
      "expo-secure-store",
      "expo-image",
      "expo-web-browser",
      ["expo-location", { locationWhenInUsePermission: "Allow Trava AI to show your position on trip maps." }],
      ["expo-image-picker", { photosPermission: "Allow Trava AI to choose trip covers and receipt images.", microphonePermission: false }],
      "expo-document-picker",
    ],
    experiments: { typedRoutes: true },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.veramarietherese.travaai",
    },
    android: {
      package: "com.veramarietherese.travaai",
      ...(googleMapsApiKey ? { config: { googleMaps: { apiKey: googleMapsApiKey } } } : {}),
    },
  };
};
