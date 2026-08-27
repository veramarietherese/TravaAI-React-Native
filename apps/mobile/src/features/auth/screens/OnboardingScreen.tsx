import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { type Href, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View, useWindowDimensions, Platform } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { AuthProgress } from "../components/AuthProgress";
import {
  completeOnboarding,
  getOnboardingStep,
  setLastPortal,
  setOnboardingStep,
} from "../utils/auth-storage";

const slides = [
  require("../../../../assets/images/onboarding/onboarding-1.gif"),
  require("../../../../assets/images/onboarding/onboarding-2.gif"),
] as const;

const stepLabels = ["Discover", "Start planning"] as const;

export function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const [ready, setReady] = useState(false);
  const [opacity] = useState(() => new Animated.Value(1));

  const compactHeight = height < 720;
  const veryCompactHeight = height < 640;
  const narrowWidth = width < 380;
  const wideViewport = width / Math.max(height, 1) > 0.72;

  useEffect(() => {
    let mounted = true;
    void getOnboardingStep().then((step) => {
      if (!mounted) return;
      setIndex(step);
      setReady(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const transitionTo = (nextIndex: number) => {
    Animated.timing(opacity, { toValue: 0, duration: 90, useNativeDriver: Platform.OS !== "web" }).start(() => {
      setIndex(nextIndex);
      void setOnboardingStep(nextIndex);
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: Platform.OS !== "web" }).start();
    });
  };

  const finish = async (portal: "traveler" | "agency") => {
    await Promise.all([completeOnboarding(), setLastPortal(portal)]);
    router.replace((portal === "agency" ? "/agency-login" : "/login") as Href);
  };

  const advance = () => {
    if (index < slides.length - 1) {
      transitionTo(index + 1);
      return;
    }
    void finish("traveler");
  };

  const goBack = () => {
    if (index > 0) transitionTo(index - 1);
  };

  if (!ready) return <View style={styles.loading} />;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.screen}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity }]}>
          <Image
            source={slides[index]}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            contentPosition="center"
            blurRadius={wideViewport ? 22 : 0}
            transition={80}
          />
          {wideViewport ? <View style={styles.ambientWash} /> : null}
          <Image
            source={slides[index]}
            style={StyleSheet.absoluteFill}
            contentFit={wideViewport ? "contain" : "cover"}
            contentPosition="center"
            transition={80}
          />
        </Animated.View>

        <LinearGradient
          colors={[
            "rgba(2,8,23,0.02)",
            "rgba(2,8,23,0.05)",
            "rgba(2,8,23,0.30)",
            "rgba(2,8,23,0.88)",
          ]}
          locations={[0, 0.48, 0.68, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Onboarding page ${index + 1} of ${slides.length}. Tap the artwork to continue.`}
          onPress={advance}
          style={[StyleSheet.absoluteFill, styles.tapLayer]}
        />

        <View style={[{ pointerEvents: "box-none" }, 
            styles.topBar,
            {
              paddingTop: Math.max(insets.top, 8),
              paddingHorizontal: narrowWidth ? 14 : 20,
            },
          ]}
        >
          <View style={styles.topBarInner}>
            {index > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Previous onboarding screen"
                hitSlop={10}
                onPress={goBack}
                style={({ pressed }) => [styles.topButton, pressed && styles.pressed]}
              >
                <Text style={styles.topButtonText}>‹ Back</Text>
              </Pressable>
            ) : (
              <View style={styles.topButtonPlaceholder} />
            )}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Skip onboarding and open traveler sign in"
              hitSlop={10}
              onPress={() => void finish("traveler")}
              style={({ pressed }) => [styles.topButton, pressed && styles.pressed]}
            >
              <Text style={styles.topButtonText}>Skip</Text>
            </Pressable>
          </View>
        </View>

        <View style={[{ pointerEvents: "box-none" }, 
            styles.bottomWrap,
            {
              paddingHorizontal: narrowWidth ? 14 : 20,
              paddingBottom: Math.max(insets.bottom + (compactHeight ? 12 : 18), 20),
            },
          ]}
        >
          <View style={[styles.bottomContent, compactHeight && styles.compactBottomContent]}>
            <AuthProgress steps={stepLabels} current={index} light />

            <Pressable
              accessibilityRole="button"
              onPress={advance}
              style={({ pressed }) => [
                styles.primaryButton,
                compactHeight && styles.compactPrimaryButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.primaryButtonText}>
                {index === slides.length - 1 ? "Start as a traveler" : "Continue"}
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open travel agency sign in"
              onPress={() => void finish("agency")}
              style={({ pressed }) => [
                styles.agencyButton,
                compactHeight && styles.compactAgencyButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.agencyButtonText}>Travel agency portal</Text>
            </Pressable>

            {!veryCompactHeight ? (
              <Text style={styles.hint}>Tap the artwork to move forward</Text>
            ) : null}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#071637" },
  screen: { flex: 1, overflow: "hidden", backgroundColor: "#071637" },
  loading: { flex: 1, backgroundColor: "#071637" },
  ambientWash: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(7,22,55,0.26)",
  },
  tapLayer: { zIndex: 1 },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 4,
  },
  topBarInner: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  topButton: {
    minHeight: 42,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: "rgba(4,14,43,0.46)",
  },
  topButtonPlaceholder: { width: 76, height: 42 },
  topButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
    },
  bottomWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 4,
  },
  bottomContent: {
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
    gap: 12,
  },
  compactBottomContent: { gap: 9 },
  primaryButton: {
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    elevation: 5,
  },
  compactPrimaryButton: { minHeight: 50 },
  primaryButtonText: { color: "#0F172A", fontSize: 15, fontWeight: "900" },
  agencyButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.62)",
    backgroundColor: "rgba(2,8,23,0.34)",
  },
  compactAgencyButton: { minHeight: 44 },
  agencyButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  hint: {
    color: "rgba(255,255,255,0.76)",
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
    fontWeight: "600",
  },
  pressed: { opacity: 0.76, transform: [{ scale: 0.985 }] },
});
