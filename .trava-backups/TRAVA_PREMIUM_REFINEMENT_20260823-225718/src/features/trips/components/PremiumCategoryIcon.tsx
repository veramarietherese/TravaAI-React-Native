import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

const EMOJI: Record<string, string> = {
  flight: "✈️", transport: "🚕", transportation: "🚕", stay: "🛏️", accommodation: "🛏️",
  food: "🍔", "food & dining": "🍔", sightseeing: "📸", shopping: "🛍️", meeting: "💼",
  activities: "🎟️", other: "📄", airport: "✈️", cafe: "☕", cafes: "☕", parks: "🌳",
  park: "🌳", hiking: "🥾", work: "💼", restaurant: "🍽️", hotel: "🛏️", landmark: "🏛️",
};
const COLORS: Record<string, readonly [string, string, string]> = {
  food: ["#FFF5D8", "#FFD898", "#FF9A70"], "food & dining": ["#FFF5D8", "#FFD898", "#FF9A70"], restaurant: ["#FFF5D8", "#FFD898", "#FF9A70"],
  stay: ["#EEF2FF", "#C9D6FF", "#9BB2F1"], accommodation: ["#EEF2FF", "#C9D6FF", "#9BB2F1"], hotel: ["#EEF2FF", "#C9D6FF", "#9BB2F1"],
  flight: ["#EAF9FF", "#BFE9FF", "#8CC7F4"], transport: ["#EAF9FF", "#C9EDFF", "#8CC7F4"], transportation: ["#EAF9FF", "#C9EDFF", "#8CC7F4"], airport: ["#EAF9FF", "#C9EDFF", "#8CC7F4"],
  shopping: ["#FFF0F6", "#FFC8DB", "#FF97BD"], activities: ["#F1ECFF", "#D8C9FF", "#B89AF5"], sightseeing: ["#F1ECFF", "#D8C9FF", "#B89AF5"],
  meeting: ["#EEF8F3", "#C9F0DE", "#8DD6B6"], work: ["#EEF8F3", "#C9F0DE", "#8DD6B6"], other: ["#F2F4F7", "#DEE3E9", "#BBC4CF"],
};

const FOOD_IMAGE = require("../../../../assets/images/trava-icons/food-burger.png");
const STAY_IMAGE = require("../../../../assets/images/trava-icons/stay-bed.png");

export function PremiumCategoryIcon({ category, size = 46, style }: { category: string; size?: number; style?: StyleProp<ViewStyle> }) {
  const key = category.toLowerCase();
  const exactAsset = key.includes("food") || key === "restaurant" ? FOOD_IMAGE : key.includes("stay") || key.includes("hotel") || key.includes("accommodation") ? STAY_IMAGE : null;
  const emoji = EMOJI[key] ?? (key.includes("food") ? "🍔" : key.includes("hotel") ? "🛏️" : key.includes("flight") ? "✈️" : key.includes("shop") ? "🛍️" : "📍");
  const colors = COLORS[key] ?? (["#F6F7FA", "#E9EDF3", "#D8DEE8"] as const);
  return <View style={[styles.shadow, { width: size + 8, height: size + 8 }, style]}>
    <View style={styles.tilt}>
      <LinearGradient colors={colors} start={{ x: .1, y: .05 }} end={{ x: .9, y: .95 }} style={[styles.tile, { width: size, height: size, borderRadius: size * .3 }]}>
        <View style={styles.highlight}/>
        {exactAsset ? <Image source={exactAsset} contentFit="contain" style={{ width: size * .78, height: size * .78 }} /> : <Text style={{ fontSize: size * .5 }}>{emoji}</Text>}
      </LinearGradient>
    </View>
  </View>;
}

export function PremiumActionGlyph({ glyph, size = 58, colors = ["#FFF5E8", "#F8D9FF", "#B9C9FF"] }: { glyph: string; size?: number; colors?: readonly [string, string, string] }) {
  return <View style={[styles.shadow, { width: size + 10, height: size + 10 }]}><View style={styles.tiltAlt}><LinearGradient colors={colors} start={{x:0,y:0}} end={{x:1,y:1}} style={[styles.tile,{width:size,height:size,borderRadius:size*.32}]}><View style={styles.highlight}/><Text style={{fontSize:size*.42}}>{glyph}</Text></LinearGradient></View></View>;
}

const styles = StyleSheet.create({
  shadow:{alignItems:"center",justifyContent:"center"},
  tilt:{transform:[{rotate:"-4deg"}],boxShadow:"0 10px 20px rgba(43,51,72,.14)"},
  tiltAlt:{transform:[{rotate:"3deg"}],boxShadow:"0 11px 24px rgba(73,78,120,.15)"},
  tile:{overflow:"hidden",alignItems:"center",justifyContent:"center",borderWidth:1,borderColor:"rgba(255,255,255,.92)"},
  highlight:{position:"absolute",left:7,right:7,top:6,height:14,borderRadius:12,backgroundColor:"rgba(255,255,255,.34)"},
});
