import { createElement, useCallback, useEffect, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Modal, Pressable, StyleSheet, View } from "react-native";

import type { DiscoverMapProps } from "./DiscoverMap.types";
export type { DiscoverPlace, PlaceImage, MapRoute, Coordinates, TravelMode } from "./DiscoverMap.types";

type Frame = { contentWindow?: { postMessage(message: unknown, targetOrigin: string): void } | null };

export function DiscoverMap(props: DiscoverMapProps) {
  const [fullScreen, setFullScreen] = useState(false);
  return <>
    <MapShell {...props} fullScreen={false} onFullScreen={() => setFullScreen(true)} />
    <Modal visible={fullScreen} animationType="fade" onRequestClose={() => setFullScreen(false)}>
      <View style={styles.fullBackdrop}>
        <MapShell {...props} fullScreen onFullScreen={() => setFullScreen(false)} />
      </View>
    </Modal>
  </>;
}

function MapShell({ fullScreen, onFullScreen, ...props }: DiscoverMapProps & { fullScreen: boolean; onFullScreen(): void }) {
  const frameRef = useRef<Frame | null>(null);

  const sendState = useCallback(() => {
    frameRef.current?.contentWindow?.postMessage({
      type: "trava-state",
      state: {
        center: props.center,
        userLocation: props.userLocation ?? null,
        selectedId: props.selectedId ?? null,
        route: props.route?.coordinates ?? [],
        places: props.places.map((place) => ({
          id: place.id,
          name: place.name,
          category: place.category,
          latitude: place.latitude,
          longitude: place.longitude,
          imageUrl: place.image?.verifiedEntityMatch ? (place.image.thumbnailUrl || place.image.url) : null,
        })),
      },
    }, "*");
  }, [props.center, props.places, props.route, props.selectedId, props.userLocation]);

  useEffect(() => {
    sendState();
  }, [sendState]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.source !== frameRef.current?.contentWindow) return;
      const data = event.data as { type?: string; id?: string; latitude?: number; longitude?: number };
      if (data?.type === "trava-ready") sendState();
      if (data?.type === "trava-select" && data.id) props.onSelect(data.id);
      if (data?.type === "trava-press" && typeof data.latitude === "number" && typeof data.longitude === "number") {
        props.onMapPress?.({ latitude: data.latitude, longitude: data.longitude });
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [props.onMapPress, props.onSelect, sendState]);

  const command = (type: "zoom-in" | "zoom-out" | "recenter") => frameRef.current?.contentWindow?.postMessage({ type: `trava-${type}` }, "*");
  const height = fullScreen ? "100%" : props.height ?? 390;

  return <View style={[styles.wrap, fullScreen && styles.full, { height }]}>
    {createElement("iframe", {
      ref: frameRef as never,
      title: "TRAVA discovery map",
      srcDoc: MAP_HTML,
      sandbox: "allow-scripts allow-same-origin",
      onLoad: sendState,
      style: { width: "100%", height: "100%", border: 0, display: "block", background: "#EAF2F5" },
    })}
    <View style={styles.controls}>
      <MapControl icon={fullScreen ? "contract-outline" : "expand-outline"} label={fullScreen ? "Minimize map" : "Full screen map"} onPress={onFullScreen} />
      <MapControl icon="add" label="Zoom in" onPress={() => command("zoom-in")} />
      <MapControl icon="remove" label="Zoom out" onPress={() => command("zoom-out")} />
      <MapControl icon="locate-outline" label="Recenter map" onPress={() => command("recenter")} />
    </View>
  </View>;
}

function MapControl({ icon, label, onPress }: { icon: React.ComponentProps<typeof Ionicons>["name"]; label: string; onPress(): void }) {
  return <Pressable accessibilityLabel={label} onPress={onPress} style={({ pressed }: { pressed: boolean }) => [styles.control, pressed && { opacity: .68 }]}>
    <Ionicons name={icon} size={19} color="#46516A" />
  </Pressable>;
}

const MAP_HTML = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>*{box-sizing:border-box}html,body,#map{width:100%;height:100%;margin:0}body{overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,sans-serif}.leaflet-control-zoom{display:none}.leaflet-control-attribution{font-size:9px;background:rgba(255,255,255,.86)!important;color:#5F697A!important}.pin{position:relative;width:48px;height:58px;display:flex;justify-content:center;filter:drop-shadow(0 7px 10px rgba(34,54,80,.18))}.bubble{width:46px;height:46px;border-radius:23px;border:3px solid white;background:#fff;display:flex;align-items:center;justify-content:center;font-size:20px;overflow:hidden}.bubble img{width:100%;height:100%;object-fit:cover}.tail{position:absolute;top:39px;width:13px;height:13px;background:white;transform:rotate(45deg)}.pin.sel .bubble{box-shadow:0 0 0 6px rgba(130,102,229,.20);transform:scale(1.06)}.user{width:20px;height:20px;border:5px solid white;background:#4B86F8;border-radius:50%;box-shadow:0 0 0 9px rgba(75,134,248,.15)}</style></head>
<body><div id="map"></div><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script>
const map=L.map('map',{zoomControl:false,attributionControl:true,scrollWheelZoom:true,touchZoom:true,minZoom:2}).setView([10.3157,123.8854],13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(map);
let state={center:{latitude:10.3157,longitude:123.8854},places:[],selectedId:null,userLocation:null,route:[]};
let markers=[],userMarker=null,routeLayer=null,lastSelected=null,initialized=false;
function update(next){state=next||state;markers.forEach(m=>map.removeLayer(m));markers=[];const pts=Array.isArray(state.places)?state.places:[];pts.forEach(p=>{const visual=p.imageUrl?'<img referrerpolicy="no-referrer" src="'+esc(p.imageUrl)+'">':'<span>'+emoji(p.category)+'</span>';const icon=L.divIcon({className:'',html:'<div class="pin '+(p.id===state.selectedId?'sel':'')+'"><div class="tail"></div><div class="bubble">'+visual+'</div></div>',iconSize:[48,58],iconAnchor:[24,52]});const marker=L.marker([p.latitude,p.longitude],{icon}).addTo(map);marker.bindTooltip(esc(p.name),{direction:'top',offset:[0,-42]});marker.on('click',()=>parent.postMessage({type:'trava-select',id:p.id},'*'));markers.push(marker)});
if(userMarker){map.removeLayer(userMarker);userMarker=null}if(state.userLocation){userMarker=L.marker([state.userLocation.latitude,state.userLocation.longitude],{icon:L.divIcon({className:'',html:'<div class="user"></div>',iconSize:[20,20],iconAnchor:[10,10]}),zIndexOffset:1000}).addTo(map)}
if(routeLayer){map.removeLayer(routeLayer);routeLayer=null}const route=Array.isArray(state.route)?state.route:[];if(route.length>1){routeLayer=L.polyline(route.map(p=>[p.latitude,p.longitude]),{color:'#7663E6',weight:5,opacity:.88}).addTo(map);map.fitBounds(routeLayer.getBounds().pad(.22),{maxZoom:15});}else{const selected=pts.find(p=>p.id===state.selectedId);if(selected&&state.selectedId!==lastSelected)map.setView([selected.latitude,selected.longitude],14,{animate:initialized});else if(!initialized&&state.center)map.setView([state.center.latitude,state.center.longitude],13)}lastSelected=state.selectedId;initialized=true;setTimeout(()=>map.invalidateSize(),20)}
map.on('click',e=>parent.postMessage({type:'trava-press',latitude:e.latlng.lat,longitude:e.latlng.lng},'*'));
window.addEventListener('message',e=>{const data=e.data||{};if(data.type==='trava-state')update(data.state);if(data.type==='trava-zoom-in')map.zoomIn();if(data.type==='trava-zoom-out')map.zoomOut();if(data.type==='trava-recenter'){const selected=(state.places||[]).find(p=>p.id===state.selectedId);const target=state.userLocation||selected||state.center;if(target)map.setView([target.latitude,target.longitude],target===state.center?13:15,{animate:true})}});
parent.postMessage({type:'trava-ready'},'*');setTimeout(()=>map.invalidateSize(),80);
function esc(s){return String(s||'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]))}function emoji(c){c=String(c||'').toLowerCase();if(c.includes('food'))return'🍽';if(c.includes('café')||c.includes('cafe'))return'☕';if(c.includes('hotel'))return'🛏';if(c.includes('shop'))return'🛍';if(c.includes('transport'))return'🚉';if(c.includes('activ'))return'🌿';return'📍'}
</script></body></html>`;

const styles = StyleSheet.create({
  wrap: { width: "100%", overflow: "hidden", borderRadius: 24, borderWidth: 1, borderColor: "#DDE4EA", backgroundColor: "#EAF2F5" },
  fullBackdrop: { flex: 1, backgroundColor: "#EAF2F5" },
  full: { flex: 1, borderRadius: 0, borderWidth: 0 },
  controls: { position: "absolute", right: 12, top: 12, gap: 7 },
  control: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.96)", borderWidth: 1, borderColor: "#E3E8EE", boxShadow: "0 7px 18px rgba(35,48,68,.13)" },
});
