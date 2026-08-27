import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { type Href, useRouter } from "expo-router";
import type { PropsWithChildren, ReactNode } from "react";
import { useEffect, useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { AuthProgress } from "./AuthProgress";

const background = require("../../../../assets/images/onboarding/onboarding-2.gif");

interface AuthShellProps extends PropsWithChildren {
  title: string;
  caption: string;
  eyebrow?: string;
  footer?: ReactNode;
  backHref?: Href;
  onBack?: () => void;
  backLabel?: string;
  progress?: {
    steps: readonly string[];
    current: number;
  };
  portalLabel?: string;
}

export function AuthShell({
  title,
  caption,
  eyebrow = "TRAVA AI",
  children,
  footer,
  backHref,
  onBack,
  backLabel = "Back",
  progress,
  portalLabel,
}: AuthShellProps) {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [opacity] = useState(() => new Animated.Value(0));
  const [translateY] = useState(() => new Animated.Value(12));

  const wide = width >= 760;
  const narrow = width < 390;
  const compactHeight = height < 720;
  const roomyHeight = height >= 800;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: Platform.OS !== "web" }),
      Animated.spring(translateY, {
        toValue: 0,
        damping: 20,
        stiffness: 220,
        mass: 0.8,
        useNativeDriver: Platform.OS !== "web",
      }),
    ]).start();
  }, [opacity, translateY]);

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    if (backHref) {
      router.replace(backHref);
      return;
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/login");
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
        style={styles.screen}
      >
        <Image source={background} style={StyleSheet.absoluteFill} contentFit="cover" transition={120} />
        <LinearGradient
          colors={[
            "rgba(237,242,255,0.86)",
            "rgba(246,248,252,0.94)",
            "rgba(248,250,252,0.99)",
          ]}
          locations={[0, 0.44, 1]}
          style={StyleSheet.absoluteFill}
        />

        <View style={[{ pointerEvents: "box-none" }, 
            styles.topBar,
            {
              paddingTop: Math.max(insets.top, 8),
              paddingHorizontal: narrow ? 12 : 18,
            },
          ]}
        >
          <View style={styles.topBarInner}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={backLabel}
              hitSlop={10}
              onPress={handleBack}
              style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
            >
              <Text style={styles.backIcon}>‹</Text>
              <Text style={styles.backText}>{backLabel}</Text>
            </Pressable>
            {portalLabel ? <Text style={styles.portalBadge}>{portalLabel}</Text> : <View />}
          </View>
        </View>

        <ScrollView
          bounces={false}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            roomyHeight && styles.centeredScrollContent,
            {
              minHeight: Math.max(1, height - insets.top - insets.bottom),
              paddingHorizontal: narrow ? 14 : wide ? 28 : 18,
              paddingTop: compactHeight ? 74 : 92,
              paddingBottom: Math.max(insets.bottom + 24, 32),
            },
          ]}
        >
          <Animated.View
            style={[
              styles.content,
              wide && styles.wideContent,
              { opacity, transform: [{ translateY }] },
            ]}
          >
            {progress ? (
              <View style={styles.progress}>
                <AuthProgress steps={progress.steps} current={progress.current} />
              </View>
            ) : null}

            <View style={[styles.brand, compactHeight && styles.compactBrand]}>
              <Text style={styles.eyebrow}>{eyebrow}</Text>
              <Text
                style={[
                  styles.title,
                  narrow && styles.narrowTitle,
                  compactHeight && styles.compactTitle,
                ]}
              >
                {title}
              </Text>
              <Text style={styles.caption}>{caption}</Text>
            </View>

            <BlurView
              intensity={Platform.OS === "web" ? 38 : 58}
              tint="light"
              style={[styles.panel, narrow && styles.narrowPanel]}
            >
              <View
                style={[
                  styles.panelInner,
                  compactHeight && styles.compactPanelInner,
                  narrow && styles.narrowPanelInner,
                ]}
              >
                {children}
              </View>
            </BlurView>

            {footer ? <View style={styles.footer}>{footer}</View> : null}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F5F7FB" },
  screen: { flex: 1, overflow: "hidden", backgroundColor: "#F5F7FB" },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 5,
  },
  topBarInner: {
    width: "100%",
    maxWidth: 600,
    minHeight: 56,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.72)",
  },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
  backIcon: { marginTop: -2, color: "#0F172A", fontSize: 29, lineHeight: 29, fontWeight: "500" },
  backText: { color: "#0F172A", fontSize: 13, fontWeight: "800" },
  portalBadge: {
    overflow: "hidden",
    maxWidth: "56%",
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 14,
    color: "#0F172A",
    backgroundColor: "rgba(255,255,255,0.76)",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.65,
    textTransform: "uppercase",
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "flex-start",
  },
  centeredScrollContent: { justifyContent: "center" },
  content: {
    width: "100%",
    maxWidth: 500,
    alignSelf: "center",
    paddingBottom: 4,
  },
  wideContent: { maxWidth: 560 },
  progress: { marginBottom: 18 },
  brand: { marginBottom: 20 },
  compactBrand: { marginBottom: 16 },
  eyebrow: {
    marginBottom: 9,
    color: "#64748B",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 2.2,
  },
  title: {
    color: "#0F172A",
    fontSize: 38,
    lineHeight: 41,
    letterSpacing: -1.25,
    fontWeight: "900",
  },
  compactTitle: { fontSize: 33, lineHeight: 36 },
  narrowTitle: { fontSize: 31, lineHeight: 34, letterSpacing: -0.9 },
  caption: {
    maxWidth: 460,
    marginTop: 10,
    color: "#64748B",
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "500",
  },
  panel: {
    overflow: "hidden",
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.88)",
    elevation: 3,
  },
  narrowPanel: { borderRadius: 22 },
  panelInner: {
    gap: 15,
    paddingHorizontal: 22,
    paddingVertical: 22,
    backgroundColor: "rgba(255,255,255,0.54)",
  },
  compactPanelInner: { gap: 13, paddingVertical: 18 },
  narrowPanelInner: { paddingHorizontal: 17 },
  footer: { marginTop: 18, alignItems: "center" },
});
