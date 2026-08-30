import { Ionicons } from "@expo/vector-icons";
import { useMemo, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

import type { DiscoverMapProps } from "./DiscoverMap.types";
export type { DiscoverPlace, PlaceImage, MapRoute, Coordinates, TravelMode } from "./DiscoverMap.types";

export function DiscoverMap(props: DiscoverMapProps) {
  const [fullScreen, setFullScreen] = useState(false);
  return <>
    <MapShell {...props} fullScreen={false} onFullScreen={() => setFullScreen(true)} />
    <Modal visible={fullScreen} animationType="slide" onRequestClose={() => setFullScreen(false)}>
      <View style={styles.fullBackdrop}><MapShell {...props} fullScreen onFullScreen={() => setFullScreen(false)} /></View>
    </Modal>
  </>;
}

function MapShell({ fullScreen, onFullScreen, ...props }: DiscoverMapProps & { fullScreen: boolean; onFullScreen(): void }) {
  const ref = useRef<WebView | null>(null);
  const html = useMemo(() => makeHtml(props), [props.center, props.places, props.route, props.selectedId, props.userLocation]);
  const message = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data) as { type?: string; id?: string; latitude?: number; longitude?: number };
      if (data.type === "select" && data.id) props.onSelect(data.id);
      if (data.type === "press" && typeof data.latitude === "number" && typeof data.longitude === "number") props.onMapPress?.({ latitude: data.latitude, longitude: data.longitude });
    } catch {}
  };
  const command = (name: string) => ref.current?.injectJavaScript(`window.travaCommand && window.travaCommand(${JSON.stringify(name)});true;`);

  return <View style={[styles.wrap, fullScreen && styles.full, { height: fullScreen ? undefined : props.height ?? 390 }]}>
    <WebView ref={ref} source={{ html }} originWhitelist={["*"]} javaScriptEnabled domStorageEnabled onMessage={message} style={styles.web} />
    <View style={styles.controls}>
      <Control icon={fullScreen ? "contract-outline" : "expand-outline"} onPress={onFullScreen} />
      <Control icon="add" onPress={() => command("zoom-in")} />
      <Control icon="remove" onPress={() => command("zoom-out")} />
      <Control icon="locate-outline" onPress={() => command("recenter")} />
    </View>
  </View>;
}

function Control({ icon, onPress }: { icon: React.ComponentProps<typeof Ionicons>["name"]; onPress(): void }) { return <Pressable onPress={onPress} style={styles.control}><Ionicons name={icon} size={19} color="#46516A" /></Pressable>; }

function makeHtml(props: DiscoverMapProps) {
  const data = JSON.stringify({ places: props.places.map((p) => ({ id:p.id,name:p.name,category:p.category,latitude:p.latitude,longitude:p.longitude,selected:p.id===props.selectedId })), center: props.center, user: props.userLocation ?? null, route: props.route?.coordinates ?? [] }).replace(/</g,"\\u003c");
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no"><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"><style>html,body,#map{width:100%;height:100%;margin:0}.leaflet-control-zoom{display:none}.leaflet-control-attribution{font-size:9px;background:rgba(255,255,255,.86)!important;color:#5F697A!important}.pin{width:38px;height:38px;border-radius:19px;background:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 14px rgba(0,0,0,.18)}.sel{box-shadow:0 0 0 6px rgba(124,98,229,.22),0 6px 14px rgba(0,0,0,.18)}</style></head><body><div id="map"></div><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script>const d=${data};const map=L.map('map',{zoomControl:false,attributionControl:true}).setView([d.center.latitude,d.center.longitude],13);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(map);d.places.forEach(p=>{const icon=L.divIcon({className:'',html:'<div class="pin '+(p.selected?'sel':'')+'">📍</div>',iconSize:[38,38],iconAnchor:[19,36]});L.marker([p.latitude,p.longitude],{icon}).addTo(map).on('click',()=>ReactNativeWebView.postMessage(JSON.stringify({type:'select',id:p.id})));});if(d.user)L.circleMarker([d.user.latitude,d.user.longitude],{radius:8,color:'#fff',weight:4,fillColor:'#4B86F8',fillOpacity:1}).addTo(map);if(d.route.length>1){const line=L.polyline(d.route.map(p=>[p.latitude,p.longitude]),{color:'#7663E6',weight:5}).addTo(map);map.fitBounds(line.getBounds().pad(.2));}else{const s=d.places.find(p=>p.selected);if(s)map.setView([s.latitude,s.longitude],14)}map.on('click',e=>ReactNativeWebView.postMessage(JSON.stringify({type:'press',latitude:e.latlng.lat,longitude:e.latlng.lng})));window.travaCommand=n=>{if(n==='zoom-in')map.zoomIn();if(n==='zoom-out')map.zoomOut();if(n==='recenter'){const s=d.user||d.places.find(p=>p.selected)||d.center;map.setView([s.latitude,s.longitude],15)}};setTimeout(()=>map.invalidateSize(),80);</script></body></html>`;
}

const styles=StyleSheet.create({wrap:{width:"100%",overflow:"hidden",borderRadius:24,borderWidth:1,borderColor:"#DDE4EA",backgroundColor:"#EAF2F5"},fullBackdrop:{flex:1,backgroundColor:"#EAF2F5"},full:{flex:1,height:undefined,borderRadius:0,borderWidth:0},web:{flex:1,backgroundColor:"#EAF2F5"},controls:{position:"absolute",right:12,top:12,gap:7},control:{width:42,height:42,borderRadius:14,alignItems:"center",justifyContent:"center",backgroundColor:"rgba(255,255,255,.96)",borderWidth:1,borderColor:"#E3E8EE"}});
