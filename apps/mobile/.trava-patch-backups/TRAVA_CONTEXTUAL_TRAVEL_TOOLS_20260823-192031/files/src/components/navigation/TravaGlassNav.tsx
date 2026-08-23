import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { type Href, usePathname, useRouter } from "expo-router";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type IconName = ComponentProps<typeof Ionicons>["name"];
type NavKey = "home" | "discover" | "ai" | "trips" | "profile";
type NavItem = { key: NavKey; label: string; href: Href; icon: IconName; activeIcon: IconName };

const ITEMS: readonly NavItem[] = [
  { key: "home", label: "Home", href: "/(traveler)/(tabs)/home" as Href, icon: "home-outline", activeIcon: "home" },
  { key: "discover", label: "Discover", href: "/(traveler)/(tabs)/explore" as Href, icon: "compass-outline", activeIcon: "compass" },
  { key: "ai", label: "AI", href: "/(traveler)/(tabs)/ai" as Href, icon: "sparkles-outline", activeIcon: "sparkles" },
  { key: "trips", label: "Trips", href: "/(traveler)/(tabs)/trips" as Href, icon: "airplane-outline", activeIcon: "airplane" },
  { key: "profile", label: "Profile", href: "/(traveler)/(tabs)/profile" as Href, icon: "person-outline", activeIcon: "person" },
] as const;

function resolveActiveKey(pathname: string): NavKey | null {
  if (pathname.startsWith("/trip/")) return "trips";
  if (pathname === "/home" || pathname.endsWith("/home")) return "home";
  if (pathname === "/explore" || pathname.endsWith("/explore")) return "discover";
  if (pathname === "/trips" || pathname.endsWith("/trips")) return "trips";
  if (pathname === "/ai" || pathname.endsWith("/ai")) return "ai";
  if (pathname === "/profile" || pathname.endsWith("/profile")) return "profile";
  return null;
}

export function TravaGlassNav({ placement = "floating" }: { placement?: "floating" | "tabbar" }) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const activeKey = resolveActiveKey(pathname);

  const bar = <View style={styles.shell}>
    <BlurView intensity={58} tint="light" style={StyleSheet.absoluteFill} />
    <View pointerEvents="none" style={styles.frost}/>
    <View style={styles.row}>
      {ITEMS.map((item) => {
        const active=item.key===activeKey;
        if(item.key==="ai") return <Pressable key={item.key} accessibilityRole="button" accessibilityLabel="AI chat" accessibilityState={{selected:active}} onPress={()=>router.replace(item.href)} style={({pressed})=>[styles.aiSlot,pressed&&styles.pressed]}>
          <View style={styles.aiGlow}/>
          <LinearGradient colors={["#70B9FF","#A8A5FF","#F29AC5"]} start={{x:.08,y:.08}} end={{x:.92,y:.92}} style={[styles.aiButton,active&&styles.aiButtonActive]}>
            <View style={styles.aiHighlight}/>
            <Ionicons name="sparkles" size={28} color="#FFFFFF"/>
            <Text style={styles.aiLabel}>AI</Text>
          </LinearGradient>
        </Pressable>;
        return <Pressable key={item.key} accessibilityRole="button" accessibilityLabel={item.label} accessibilityState={{selected:active}} onPress={()=>router.replace(item.href)} style={({pressed})=>[styles.item,pressed&&styles.pressed]}>
          <Ionicons name={active?item.activeIcon:item.icon} size={25} color={active?(item.key==="discover"?"#3564F3":"#13203B"):"#70809A"}/>
          <Text style={[styles.label,active&&styles.labelActive,item.key==="discover"&&active&&styles.discoverActive]}>{item.label}</Text>
        </Pressable>;
      })}
    </View>
  </View>;

  if(placement==="tabbar") return <View style={[styles.tabbarHost,{paddingBottom:Math.max(10,insets.bottom)}]}>{bar}</View>;
  return <View pointerEvents="box-none" style={[styles.floatingHost,{bottom:Math.max(10,insets.bottom+4)}]}>{bar}</View>;
}

const styles=StyleSheet.create({
  floatingHost:{position:"absolute",left:0,right:0,zIndex:150,alignItems:"center",paddingHorizontal:18},
  tabbarHost:{width:"100%",alignItems:"center",justifyContent:"flex-end",paddingTop:6,paddingHorizontal:18,backgroundColor:"transparent"},
  shell:{width:"92%",maxWidth:780,height:96,overflow:"visible",borderRadius:48,borderWidth:1,borderColor:"rgba(255,255,255,.70)",backgroundColor:"rgba(255,255,255,.70)",boxShadow:"0 18px 46px rgba(36,50,79,.12)"},
  frost:{...StyleSheet.absoluteFillObject,borderRadius:48,backgroundColor:"rgba(255,255,255,.28)"},
  row:{flex:1,flexDirection:"row",alignItems:"center",justifyContent:"space-around",paddingHorizontal:16},
  item:{width:100,height:70,borderRadius:28,alignItems:"center",justifyContent:"center",gap:4},
  label:{color:"#6E7D96",fontSize:10.5,lineHeight:13,fontWeight:"700"},labelActive:{color:"#14213A",fontWeight:"900"},discoverActive:{color:"#315EF2"},
  aiSlot:{width:104,height:112,alignItems:"center",justifyContent:"center",marginTop:-28,position:"relative"},
  aiGlow:{position:"absolute",width:92,height:92,borderRadius:46,backgroundColor:"rgba(133,170,255,.26)",boxShadow:"0 13px 33px rgba(107,104,255,.30)"},
  aiButton:{width:78,height:78,borderRadius:39,alignItems:"center",justifyContent:"center",borderWidth:2,borderColor:"rgba(255,255,255,.88)",boxShadow:"0 11px 28px rgba(113,115,244,.30)",overflow:"hidden"},
  aiButtonActive:{transform:[{scale:1.03}]},aiHighlight:{position:"absolute",left:7,top:6,width:36,height:20,borderRadius:18,backgroundColor:"rgba(255,255,255,.26)",transform:[{rotate:"-18deg"}]},aiLabel:{marginTop:1,color:"#FFFFFF",fontSize:10.5,fontWeight:"900"},pressed:{opacity:.78,transform:[{scale:.97}]},
});
