import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

function Block({ style }: { style?: object }) {
  return <View style={[s.block, style]} />;
}

export function HomeDashboardSkeleton() {
  return (
    <SafeAreaView accessibilityLabel="Loading travel dashboard" style={s.safe}>
      <StatusBar style="dark" />
      <View style={s.content}>
        <View style={s.header}>
          <View style={s.headerCopy}>
            <Block style={s.hello} />
            <Block style={s.name} />
          </View>
          <Block style={s.avatar} />
        </View>

        <LinearGradient colors={["#EEF5FF", "#F5F0FF", "#FFF3F8"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
          <View style={s.heroCopy}>
            <Block style={s.heroEyebrow} />
            <Block style={s.heroTitle} />
            <Block style={s.heroMeta} />
          </View>
          <View style={s.heroGlass} />
        </LinearGradient>

        <Block style={s.sectionTitle} />
        <View style={s.actions}>
          {[0, 1, 2, 3].map((item) => (
            <View key={item} style={s.action}>
              <Block style={s.actionIcon} />
              <View style={s.actionCopy}>
                <Block style={s.actionTitle} />
                <Block style={s.actionSub} />
              </View>
            </View>
          ))}
        </View>

        <Block style={s.sectionTitleWide} />
        <View style={s.cards}>
          <View style={s.card}><Block style={s.cardImage} /><Block style={s.cardLine} /><Block style={s.cardLineShort} /></View>
          <View style={s.card}><Block style={s.cardImage} /><Block style={s.cardLine} /><Block style={s.cardLineShort} /></View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F9FAFD" },
  content: { width: "100%", maxWidth: 920, alignSelf: "center", paddingHorizontal: 20, paddingTop: 10, gap: 18 },
  block: { backgroundColor: "#E9EDF4" },
  header: { minHeight: 58, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerCopy: { gap: 8 },
  hello: { width: 76, height: 9, borderRadius: 5 },
  name: { width: 150, height: 21, borderRadius: 10 },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: "#E8ECF6" },
  hero: { minHeight: 190, borderRadius: 30, padding: 22, overflow: "hidden", borderWidth: 1, borderColor: "#E5E9F2" },
  heroCopy: { gap: 12, maxWidth: 260 },
  heroEyebrow: { width: 90, height: 9, borderRadius: 5, backgroundColor: "rgba(79,115,255,.13)" },
  heroTitle: { width: 210, height: 30, borderRadius: 12, backgroundColor: "rgba(25,39,70,.12)" },
  heroMeta: { width: 155, height: 12, borderRadius: 6, backgroundColor: "rgba(25,39,70,.08)" },
  heroGlass: { position: "absolute", right: 22, bottom: 22, width: 88, height: 88, borderRadius: 28, backgroundColor: "rgba(255,255,255,.64)", borderWidth: 1, borderColor: "rgba(255,255,255,.92)" },
  sectionTitle: { width: 105, height: 16, borderRadius: 8 },
  sectionTitleWide: { width: 178, height: 16, borderRadius: 8 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  action: { width: "48%", minHeight: 82, flexGrow: 1, padding: 12, borderRadius: 22, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#ECEFF5" },
  actionIcon: { width: 46, height: 46, borderRadius: 16, backgroundColor: "#E9E4FF" },
  actionCopy: { flex: 1, gap: 7 },
  actionTitle: { width: "78%", height: 10, borderRadius: 5 },
  actionSub: { width: "58%", height: 7, borderRadius: 4, backgroundColor: "#F0F2F6" },
  cards: { flexDirection: "row", gap: 12, overflow: "hidden" },
  card: { width: 238, paddingBottom: 14, borderRadius: 23, overflow: "hidden", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#ECEFF5" },
  cardImage: { width: "100%", height: 120, backgroundColor: "#E7ECF5" },
  cardLine: { width: "72%", height: 12, borderRadius: 6, marginTop: 13, marginLeft: 13 },
  cardLineShort: { width: "46%", height: 8, borderRadius: 4, marginTop: 8, marginLeft: 13, backgroundColor: "#F0F2F6" },
});
