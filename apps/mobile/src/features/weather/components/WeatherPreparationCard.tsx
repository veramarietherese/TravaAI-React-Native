import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { fetchWeatherPreparation } from "../api/weather.api";

export function WeatherPreparationCard({
  latitude,
  longitude,
  destination,
}: {
  latitude: number | null | undefined;
  longitude: number | null | undefined;
  destination: string;
}) {
  const enabled = Number.isFinite(latitude) && Number.isFinite(longitude);
  const query = useQuery({
    queryKey: ["weather-prep", latitude, longitude],
    queryFn: () => fetchWeatherPreparation(Number(latitude), Number(longitude)),
    enabled,
    staleTime: 15 * 60_000,
    retry: 1,
  });

  if (!enabled) {
    return (
      <LinearGradient colors={["#EEF5FF", "#F8F2FF"]} style={styles.card}>
        <View style={styles.icon}><Text style={styles.iconText}>☁</Text></View>
        <View style={styles.copy}><Text style={styles.eyebrow}>WEATHER PREPARATION</Text><Text style={styles.title}>Add a mapped itinerary stop</Text><Text style={styles.text}>TRAVA will use the first mapped stop to prepare packing and weather guidance for {destination}.</Text></View>
      </LinearGradient>
    );
  }

  if (query.isLoading) {
    return <View style={styles.loading}><ActivityIndicator color="#7257EC" /><Text style={styles.loadingText}>Checking local weather for your trip…</Text></View>;
  }
  if (!query.data) return null;

  const weather = query.data;
  const prep = buildPreparation(weather.weatherCode, weather.precipitationProbability, weather.temperature, weather.windSpeed);
  return (
    <LinearGradient colors={["#EDF5FF", "#FFF4FA"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
      <View style={styles.weatherTop}>
        <View><Text style={styles.eyebrow}>WEATHER PREPARATION · LIVE</Text><Text style={styles.title}>{destination}</Text><Text style={styles.text}>{prep}</Text></View>
        <View style={styles.tempBubble}><Text style={styles.condition}>{weatherGlyph(weather.weatherCode)}</Text><Text style={styles.temp}>{Math.round(weather.temperature)}°</Text></View>
      </View>
      <View style={styles.facts}>
        <Fact label="High / Low" value={`${Math.round(weather.high)}° / ${Math.round(weather.low)}°`} />
        <Fact label="Rain chance" value={`${Math.round(weather.precipitationProbability)}%`} />
        <Fact label="Wind" value={`${Math.round(weather.windSpeed)} km/h`} />
        <Fact label="Feels like" value={`${Math.round(weather.apparentTemperature)}°`} />
      </View>
    </LinearGradient>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return <View style={styles.fact}><Text style={styles.factLabel}>{label}</Text><Text style={styles.factValue}>{value}</Text></View>;
}
function weatherGlyph(code: number) {
  if ([0, 1].includes(code)) return "☀";
  if ([2, 3].includes(code)) return "☁";
  if ([45, 48].includes(code)) return "≋";
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return "☂";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "❄";
  if ([95, 96, 99].includes(code)) return "ϟ";
  return "☁";
}
function buildPreparation(code: number, rain: number, temp: number, wind: number) {
  const items: string[] = [];
  if (rain >= 45 || [51,53,55,61,63,65,80,81,82,95,96,99].includes(code)) items.push("Pack a compact umbrella or light rain shell");
  if (temp >= 29) items.push("bring breathable clothing and hydration");
  else if (temp <= 14) items.push("layer up with a light jacket");
  else items.push("comfortable light layers should work well");
  if (wind >= 30) items.push("secure hats and loose items");
  return `${items.join("; ")}.`;
}
const styles = StyleSheet.create({
  card:{marginTop:12,padding:15,borderRadius:20,borderWidth:1,borderColor:"rgba(255,255,255,.95)"},weatherTop:{flexDirection:"row",justifyContent:"space-between",gap:12},copy:{flex:1},eyebrow:{color:"#5D6FC8",fontSize:7,letterSpacing:.9,fontWeight:"900"},title:{marginTop:4,color:"#17233F",fontSize:15,fontWeight:"900"},text:{marginTop:5,maxWidth:520,color:"#68758E",fontSize:8,lineHeight:13,fontWeight:"700"},
  tempBubble:{minWidth:67,height:67,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:3,borderRadius:20,backgroundColor:"rgba(255,255,255,.78)"},condition:{color:"#5C7FD6",fontSize:20},temp:{color:"#1E2A47",fontSize:18,fontWeight:"900"},
  facts:{marginTop:12,flexDirection:"row",gap:6},fact:{flex:1,minWidth:0,padding:8,borderRadius:12,backgroundColor:"rgba(255,255,255,.72)"},factLabel:{color:"#8994A9",fontSize:5,fontWeight:"800"},factValue:{marginTop:3,color:"#263149",fontSize:7,fontWeight:"900"},
  loading:{marginTop:12,minHeight:84,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:9,borderRadius:18,backgroundColor:"#F4F7FF"},loadingText:{color:"#79849A",fontSize:8,fontWeight:"700"},
  icon:{width:48,height:48,borderRadius:16,alignItems:"center",justifyContent:"center",backgroundColor:"rgba(255,255,255,.8)"},iconText:{color:"#7592D6",fontSize:22},
});
