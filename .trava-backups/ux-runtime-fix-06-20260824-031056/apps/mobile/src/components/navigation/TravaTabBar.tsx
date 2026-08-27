import { LinearGradient } from "expo-linear-gradient";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

const VISIBLE = ["home", "trips", "ai", "messages", "profile"] as const;
const ICONS: Record<string, string> = { home: "⌾", trips: "⌑", ai: "✣", messages: "◯", profile: "♙" };
const LABELS: Record<string, string> = { home: "Home", trips: "Trips", ai: "AI", messages: "Messages", profile: "Profile" };

export function TravaTabBar({ state, navigation, insets }: any) {
  const routes = VISIBLE.map((name) => state.routes.find((route: any) => route.name === name)).filter(Boolean);
  return (
    <View pointerEvents="box-none" style={[styles.shell, { bottom: Math.max(10, Number(insets?.bottom || 0) + 5) }]}>
      <View style={styles.bar}>
        {routes.map((route: any) => {
          const routeIndex = state.routes.findIndex((item: any) => item.key === route.key);
          const focused = state.index === routeIndex;
          const name = route.name as string;
          const onPress = () => {
            const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
          };
          if (name === "ai") {
            return <Pressable key={route.key} accessibilityRole="button" accessibilityState={focused ? { selected: true } : {}} onPress={onPress} style={styles.aiSlot}><LinearGradient colors={["#A18BFF", "#E989DB"]} start={{x:0,y:0}} end={{x:1,y:1}} style={[styles.aiButton, focused && styles.aiFocused]}><Text style={styles.aiIcon}>✣</Text><Text style={styles.aiLabel}>AI</Text></LinearGradient></Pressable>;
          }
          return <Pressable key={route.key} accessibilityRole="button" accessibilityState={focused ? { selected: true } : {}} onPress={onPress} style={styles.item}><View style={[styles.iconWrap, focused && styles.iconWrapFocused]}><Text style={[styles.icon, focused && styles.iconFocused]}>{ICONS[name]}</Text></View><Text numberOfLines={1} style={[styles.label, focused && styles.labelFocused]}>{LABELS[name]}</Text>{focused ? <View style={styles.dot}/> : null}</Pressable>;
        })}
      </View>
    </View>
  );
}

const styles=StyleSheet.create({shell:{position:"absolute",left:0,right:0,alignItems:"center",paddingHorizontal:14},bar:{width:"100%",maxWidth:440,height:66,flexDirection:"row",alignItems:"center",justifyContent:"space-around",paddingHorizontal:9,borderRadius:31,backgroundColor:Platform.OS==="web"?"rgba(255,255,255,0.90)":"rgba(255,255,255,0.97)",borderWidth:1,borderColor:"rgba(225,222,241,0.94)",shadowColor:"#3A3567",shadowOpacity:.15,shadowRadius:20,shadowOffset:{width:0,height:8},elevation:12},item:{flex:1,height:58,alignItems:"center",justifyContent:"center"},iconWrap:{width:31,height:28,borderRadius:14,alignItems:"center",justifyContent:"center"},iconWrapFocused:{backgroundColor:"#F0EBFF"},icon:{color:"#65718B",fontSize:18,fontWeight:"800"},iconFocused:{color:"#7258EC"},label:{marginTop:1,color:"#8C94A5",fontSize:5.8,fontWeight:"800"},labelFocused:{color:"#6E59D9"},dot:{position:"absolute",bottom:2,width:4,height:4,borderRadius:2,backgroundColor:"#7A61EF"},aiSlot:{width:82,height:70,alignItems:"center",justifyContent:"center",marginTop:-13},aiButton:{width:76,height:59,borderRadius:22,alignItems:"center",justifyContent:"center",borderWidth:1,borderColor:"rgba(255,255,255,.7)",shadowColor:"#C16BCE",shadowOpacity:.26,shadowRadius:14,shadowOffset:{width:0,height:6},elevation:10},aiFocused:{transform:[{scale:1.03}]},aiIcon:{color:"#FFF",fontSize:16,fontWeight:"900"},aiLabel:{marginTop:1,color:"#FFF",fontSize:8,fontWeight:"900"}});
