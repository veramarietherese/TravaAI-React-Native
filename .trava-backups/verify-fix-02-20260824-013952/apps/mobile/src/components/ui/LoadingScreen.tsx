import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";

const ASSETS = {
  airplane: require("../../../assets/images/trava-loader/airplane.png"),
  pin: require("../../../assets/images/trava-loader/pin.png"),
  calendar: require("../../../assets/images/trava-loader/calendar.png"),
  avatarMale: require("../../../assets/images/trava-loader/avatar_male.png"),
  avatarFemale: require("../../../assets/images/trava-loader/avatar_female.png"),
  avatarGlasses: require("../../../assets/images/trava-loader/avatar_glasses.png"),
  ticket: require("../../../assets/images/trava-loader/ticket.png"),
  globe: require("../../../assets/images/trava-loader/globe.png"),
  suitcase: require("../../../assets/images/trava-loader/suitcase.png"),
  star: require("../../../assets/images/trava-loader/center_star.png"),
  cloudLeft: require("../../../assets/images/trava-loader/cloud_left.png"),
  cloudRight: require("../../../assets/images/trava-loader/cloud_right.png"),
} as const;

type LoadingScreenProps = {
  message?: string;
};

type EnterAnim = {
  opacity: Animated.Value;
  scale: Animated.Value;
  y: Animated.Value;
};

function makeEnterAnim(): EnterAnim {
  return {
    opacity: new Animated.Value(0),
    scale: new Animated.Value(0.62),
    y: new Animated.Value(12),
  };
}

function startFloat(value: Animated.Value, distance: number, duration: number, delay = 0) {
  return Animated.loop(
    Animated.sequence([
      Animated.delay(delay),
      Animated.timing(value, {
        toValue: -distance,
        duration,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      }),
      Animated.timing(value, {
        toValue: distance,
        duration: duration * 2,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      }),
      Animated.timing(value, {
        toValue: 0,
        duration,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      }),
    ]),
  );
}

function Asset({
  source,
  style,
  enter,
  float,
}: {
  source: number;
  style: object;
  enter: EnterAnim;
  float: Animated.Value;
}) {
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        style,
        {
          opacity: enter.opacity,
          transform: [
            { translateY: Animated.add(enter.y, float) },
            { scale: enter.scale },
          ],
        },
      ]}
    >
      <Image source={source} resizeMode="contain" style={styles.assetImage} />
    </Animated.View>
  );
}

function Ripple({ delay, size }: { delay: number; size: number }) {
  const scale = useRef(new Animated.Value(0.82)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 1.28,
            duration: 2200,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(opacity, { toValue: 0.48, duration: 240, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0, duration: 1960, useNativeDriver: true }),
          ]),
        ]),
        Animated.timing(scale, { toValue: 0.82, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [delay, opacity, scale]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.ripple,
        { width: size, height: size, borderRadius: size / 2, opacity, transform: [{ scale }] },
      ]}
    />
  );
}

function GradientJourney() {
  const letters = [
    ["j", "#6697FF"],
    ["o", "#7B86FF"],
    ["u", "#9C76FF"],
    ["r", "#C46FEC"],
    ["n", "#EA72C9"],
    ["e", "#FA819D"],
    ["y", "#FFA060"],
  ] as const;

  return (
    <Text style={styles.journey} accessibilityLabel="journey">
      {letters.map(([letter, color], index) => (
        <Text key={`${letter}-${index}`} style={{ color }}>
          {letter}
        </Text>
      ))}
    </Text>
  );
}

export function LoadingScreen({ message = "Loading your next adventure..." }: LoadingScreenProps) {
  const { width, height } = useWindowDimensions();
  const stageWidth = Math.min(width * 0.94, 472, height * 0.52);
  const stageHeight = stageWidth * 1.08;

  const center = useMemo(() => makeEnterAnim(), []);
  const airplane = useMemo(() => makeEnterAnim(), []);
  const pin = useMemo(() => makeEnterAnim(), []);
  const calendar = useMemo(() => makeEnterAnim(), []);
  const avatarFemale = useMemo(() => makeEnterAnim(), []);
  const suitcase = useMemo(() => makeEnterAnim(), []);
  const avatarGlasses = useMemo(() => makeEnterAnim(), []);
  const globe = useMemo(() => makeEnterAnim(), []);
  const ticket = useMemo(() => makeEnterAnim(), []);
  const avatarMale = useMemo(() => makeEnterAnim(), []);

  const centerFloat = useRef(new Animated.Value(0)).current;
  const airplaneFloat = useRef(new Animated.Value(0)).current;
  const pinFloat = useRef(new Animated.Value(0)).current;
  const calendarFloat = useRef(new Animated.Value(0)).current;
  const femaleFloat = useRef(new Animated.Value(0)).current;
  const suitcaseFloat = useRef(new Animated.Value(0)).current;
  const glassesFloat = useRef(new Animated.Value(0)).current;
  const globeFloat = useRef(new Animated.Value(0)).current;
  const ticketFloat = useRef(new Animated.Value(0)).current;
  const maleFloat = useRef(new Animated.Value(0)).current;

  const copyOpacity = useRef(new Animated.Value(0)).current;
  const copyY = useRef(new Animated.Value(20)).current;
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const entries: Array<[EnterAnim, number]> = [
      [center, 0],
      [airplane, 180],
      [pin, 300],
      [calendar, 420],
      [avatarFemale, 540],
      [suitcase, 660],
      [avatarGlasses, 780],
      [globe, 900],
      [ticket, 1020],
      [avatarMale, 1140],
    ];

    const entrance = Animated.parallel(
      entries.map(([anim, delay]) =>
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(anim.opacity, {
              toValue: 1,
              duration: 320,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.spring(anim.scale, {
              toValue: 1,
              friction: 5.8,
              tension: 82,
              useNativeDriver: true,
            }),
            Animated.spring(anim.y, {
              toValue: 0,
              friction: 7,
              tension: 70,
              useNativeDriver: true,
            }),
          ]),
        ]),
      ),
    );

    const copy = Animated.sequence([
      Animated.delay(1040),
      Animated.parallel([
        Animated.timing(copyOpacity, {
          toValue: 1,
          duration: 520,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(copyY, {
          toValue: 0,
          duration: 520,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]);

    const progressAnimation = Animated.sequence([
      Animated.delay(1180),
      Animated.timing(progress, {
        toValue: 1,
        duration: 2500,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: false,
      }),
    ]);

    entrance.start();
    copy.start();
    progressAnimation.start();

    const floats = [
      startFloat(centerFloat, 2.5, 1250),
      startFloat(airplaneFloat, 4.5, 1500, 120),
      startFloat(pinFloat, 4, 1450, 260),
      startFloat(calendarFloat, 3.5, 1400, 400),
      startFloat(femaleFloat, 3.5, 1320, 520),
      startFloat(suitcaseFloat, 4.5, 1550, 680),
      startFloat(glassesFloat, 3.2, 1360, 820),
      startFloat(globeFloat, 4, 1640, 940),
      startFloat(ticketFloat, 4, 1500, 1060),
      startFloat(maleFloat, 3.5, 1420, 1180),
    ];
    floats.forEach((animation) => animation.start());

    return () => {
      entrance.stop();
      copy.stop();
      progressAnimation.stop();
      floats.forEach((animation) => animation.stop());
    };
  }, [
    airplane,
    airplaneFloat,
    avatarFemale,
    avatarGlasses,
    calendar,
    calendarFloat,
    center,
    centerFloat,
    copyOpacity,
    copyY,
    femaleFloat,
    glassesFloat,
    globe,
    globeFloat,
    maleFloat,
    avatarMale,
    pin,
    pinFloat,
    progress,
    suitcase,
    suitcaseFloat,
    ticket,
    ticketFloat,
  ]);

  const progressWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });

  return (
    <View style={styles.root} accessibilityRole="progressbar" accessibilityLabel="TRAVA AI is loading">
      <LinearGradient
        colors={["#FFF8EE", "#FFF1F3", "#F7EEFF", "#EEF5FF"]}
        locations={[0, 0.28, 0.66, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <View pointerEvents="none" style={styles.ambientPink} />
      <View pointerEvents="none" style={styles.ambientBlue} />

      <View style={styles.shell}>
        <View style={[styles.stage, { width: stageWidth, height: stageHeight }]}>
          <View style={[styles.orbit, styles.orbitOuter]} />
          <View style={[styles.orbit, styles.orbitLarge]} />
          <View style={[styles.orbit, styles.orbitMiddle]} />
          <View style={[styles.orbit, styles.orbitInner]} />
          <Ripple delay={0} size={stageWidth * 0.38} />
          <Ripple delay={760} size={stageWidth * 0.38} />
          <Ripple delay={1520} size={stageWidth * 0.38} />

          <View style={styles.centerGlow} />
          <Asset source={ASSETS.star} style={styles.centerStar} enter={center} float={centerFloat} />

          <Animated.Image
            source={ASSETS.cloudLeft}
            resizeMode="contain"
            style={[styles.cloud, styles.cloudLeft, { opacity: airplane.opacity }]}
          />
          <Animated.Image
            source={ASSETS.cloudRight}
            resizeMode="contain"
            style={[styles.cloud, styles.cloudRight, { opacity: suitcase.opacity }]}
          />

          <Asset source={ASSETS.airplane} style={styles.airplane} enter={airplane} float={airplaneFloat} />
          <Asset source={ASSETS.pin} style={styles.pin} enter={pin} float={pinFloat} />
          <Asset source={ASSETS.calendar} style={styles.calendar} enter={calendar} float={calendarFloat} />
          <Asset source={ASSETS.avatarFemale} style={styles.avatarFemale} enter={avatarFemale} float={femaleFloat} />
          <Asset source={ASSETS.suitcase} style={styles.suitcase} enter={suitcase} float={suitcaseFloat} />
          <Asset source={ASSETS.avatarGlasses} style={styles.avatarGlasses} enter={avatarGlasses} float={glassesFloat} />
          <Asset source={ASSETS.globe} style={styles.globe} enter={globe} float={globeFloat} />
          <Asset source={ASSETS.ticket} style={styles.ticket} enter={ticket} float={ticketFloat} />
          <Asset source={ASSETS.avatarMale} style={styles.avatarMale} enter={avatarMale} float={maleFloat} />

          <View style={[styles.twinkle, styles.twinkleOne]} />
          <View style={[styles.twinkle, styles.twinkleTwo]} />
          <View style={[styles.twinkle, styles.twinkleThree]} />
          <View style={[styles.twinkle, styles.twinkleFour]} />
        </View>

        <Animated.View style={[styles.copy, { opacity: copyOpacity, transform: [{ translateY: copyY }] }]}>
          <Text style={styles.brand}>
            <Text style={{ color: "#675AE9" }}>T R A </Text>
            <Text style={{ color: "#E96BAE" }}>V A </Text>
            <Text style={{ color: "#F28AC8" }}>✦</Text>
          </Text>
          <Text style={styles.heading}>Preparing your</Text>
          <GradientJourney />
          <Text style={styles.message}>{message}</Text>

          <View style={styles.progressCapsule}>
            <View style={styles.progressTrack}>
              <Animated.View style={[styles.progressClip, { width: progressWidth }]}>
                <LinearGradient
                  colors={["#4FAEFF", "#986BFF", "#EB6EC4", "#FF9B71"]}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={StyleSheet.absoluteFillObject}
                />
              </Animated.View>
            </View>
            <Text style={styles.progressStar}>✦</Text>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: "100%",
    minHeight: "100%",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: "#F9F4FF",
  },
  ambientPink: {
    position: "absolute",
    width: 420,
    height: 420,
    borderRadius: 210,
    top: -120,
    left: -120,
    backgroundColor: "rgba(255,204,213,0.15)",
  },
  ambientBlue: {
    position: "absolute",
    width: 430,
    height: 430,
    borderRadius: 215,
    right: -130,
    bottom: -130,
    backgroundColor: "rgba(193,213,255,0.16)",
  },
  shell: {
    width: "100%",
    maxWidth: 520,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  stage: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  orbit: {
    position: "absolute",
    alignSelf: "center",
    borderWidth: 1.2,
    borderColor: "rgba(255,255,255,0.92)",
    borderStyle: "dashed",
  },
  orbitOuter: { width: "96%", aspectRatio: 1, borderRadius: 9999, opacity: 0.74 },
  orbitLarge: { width: "78%", aspectRatio: 1, borderRadius: 9999, opacity: 0.82 },
  orbitMiddle: { width: "58%", aspectRatio: 1, borderRadius: 9999, opacity: 0.9 },
  orbitInner: { width: "34%", aspectRatio: 1, borderRadius: 9999, borderStyle: "solid", opacity: 0.96 },
  ripple: {
    position: "absolute",
    borderWidth: 1.2,
    borderColor: "rgba(255,255,255,0.8)",
  },
  centerGlow: {
    position: "absolute",
    width: "33%",
    aspectRatio: 1,
    borderRadius: 9999,
    backgroundColor: "rgba(255,255,255,0.46)",
    shadowColor: "#E27AF2",
    shadowOpacity: 0.22,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 0 },
  },
  assetImage: { width: "100%", height: "100%" },
  centerStar: { position: "absolute", left: "40%", top: "39%", width: "20%", height: "22%", zIndex: 10 },
  airplane: { position: "absolute", left: "6%", top: "9%", width: "34%", height: "29%", zIndex: 8 },
  pin: { position: "absolute", left: "42%", top: "0%", width: "16%", height: "25%", zIndex: 9 },
  calendar: { position: "absolute", right: "5%", top: "12%", width: "21%", height: "27%", zIndex: 8 },
  avatarFemale: { position: "absolute", right: "-1%", top: "40%", width: "19%", height: "24%", zIndex: 10 },
  suitcase: { position: "absolute", right: "3%", bottom: "12%", width: "22%", height: "31%", zIndex: 8 },
  avatarGlasses: { position: "absolute", left: "41%", bottom: "-3%", width: "18%", height: "23%", zIndex: 11 },
  globe: { position: "absolute", left: "36.5%", bottom: "7%", width: "27%", height: "31%", zIndex: 8 },
  ticket: { position: "absolute", left: "3%", bottom: "18%", width: "32%", height: "26%", zIndex: 7 },
  avatarMale: { position: "absolute", left: "-1%", top: "39%", width: "19%", height: "24%", zIndex: 10 },
  cloud: { position: "absolute", width: "12%", height: "10%", zIndex: 3 },
  cloudLeft: { left: "-2%", top: "14%" },
  cloudRight: { right: "-1%", bottom: "18%" },
  twinkle: {
    position: "absolute",
    width: 10,
    height: 10,
    backgroundColor: "#F6A0C4",
    transform: [{ rotate: "45deg" }],
    borderRadius: 2,
    opacity: 0.82,
  },
  twinkleOne: { left: "22%", top: "34%", backgroundColor: "#FFB667" },
  twinkleTwo: { right: "15%", top: "20%", backgroundColor: "#7D72FF" },
  twinkleThree: { left: "31%", bottom: "17%", backgroundColor: "#FF9D6E" },
  twinkleFour: { right: "23%", bottom: "37%", width: 7, height: 7, backgroundColor: "#EC7EC5" },
  copy: {
    width: "100%",
    alignItems: "center",
    marginTop: -8,
  },
  brand: {
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: 3.6,
    fontWeight: "800",
  },
  heading: {
    marginTop: 13,
    color: "#10162D",
    fontSize: 38,
    lineHeight: 43,
    fontWeight: "900",
    letterSpacing: -1.1,
    textAlign: "center",
  },
  journey: {
    marginTop: -2,
    fontSize: 56,
    lineHeight: 60,
    fontWeight: "900",
    letterSpacing: -2,
    textAlign: "center",
  },
  message: {
    marginTop: 13,
    color: "#8184A6",
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",
    textAlign: "center",
  },
  progressCapsule: {
    width: "86%",
    maxWidth: 380,
    height: 62,
    marginTop: 28,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 31,
    backgroundColor: "#0C0E1A",
    shadowColor: "#5C4A93",
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
  },
  progressTrack: {
    flex: 1,
    height: 14,
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: "#202337",
  },
  progressClip: {
    height: "100%",
    overflow: "hidden",
    borderRadius: 999,
  },
  progressStar: {
    width: 42,
    marginLeft: 10,
    color: "#F17FC1",
    fontSize: 24,
    lineHeight: 30,
    textAlign: "center",
    fontWeight: "900",
    textShadowColor: "rgba(241,127,193,0.35)",
    textShadowRadius: 10,
  },
});
