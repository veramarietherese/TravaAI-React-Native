import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import type { DiscoverMapProps } from "./DiscoverMap.types";
export type { DiscoverPlace } from "./DiscoverMap.types";

export function DiscoverMap({ places, selectedId, center, onSelect, onMapPress }: DiscoverMapProps) {
  const html = useMemo(() => makeHtml(places, selectedId, center), [center, places, selectedId]);
  const focusKey = `${selectedId ?? "none"}:${center?.latitude?.toFixed(5) ?? "x"}:${center?.longitude?.toFixed(5) ?? "x"}`;
  return <View style={styles.wrap}><WebView
    key={focusKey}
    originWhitelist={["*"]}
    source={{ html }}
    javaScriptEnabled
    domStorageEnabled
    geolocationEnabled
    onMessage={(event) => {
      try {
        const data = JSON.parse(event.nativeEvent.data) as { type?: string; id?: string };
        if (data.type === "trava-discover-select" && data.id) onSelect(data.id);
        if (data.type === "trava-discover-map-press" && typeof (data as any).latitude === "number" && typeof (data as any).longitude === "number") onMapPress?.({ latitude: (data as any).latitude, longitude: (data as any).longitude });
      } catch {}
    }}
    style={styles.web}
  /></View>;
}

function makeHtml(places: DiscoverMapProps["places"], selectedId?: string | null, center?: DiscoverMapProps["center"]) {
  const data = JSON.stringify(places.map((place) => ({ ...place, selected: place.id === selectedId }))).replace(/</g, "\\u003c");
  const centerData = JSON.stringify(center ?? null);
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no"><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"><style>*{box-sizing:border-box}html,body,#map{width:100%;height:100%;margin:0}body{overflow:hidden;background:#eaf5ff;font-family:-apple-system,BlinkMacSystemFont,sans-serif}.leaflet-container{background:#eaf5ff}.leaflet-tile{filter:saturate(.72) brightness(1.08) contrast(.87);opacity:.96}.leaflet-control-zoom,.leaflet-control-attribution{display:none}.pin{position:relative;width:58px;height:70px;display:flex;justify-content:center;filter:drop-shadow(0 9px 12px rgba(36,63,110,.20))}.tail{position:absolute;top:45px;width:17px;height:17px;background:#fff;transform:rotate(45deg)}.bubble{position:relative;z-index:2;width:54px;height:54px;border-radius:27px;padding:4px;background:#fff}.bubble img{width:100%;height:100%;object-fit:cover;border-radius:23px}.pin.sel .bubble{box-shadow:0 0 0 7px rgba(81,132,255,.18);transform:scale(1.06)}.user{width:48px;height:48px;border-radius:24px;background:rgba(69,114,255,.14);display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 11px rgba(74,119,255,.10)}.user:after{content:'';width:22px;height:22px;border-radius:50%;background:#3976ff;border:6px solid #fff}.locate{position:absolute;right:16px;bottom:16px;z-index:800;width:56px;height:56px;border:0;border-radius:28px;background:#fff;box-shadow:0 8px 18px rgba(37,59,92,.15);color:#3b6cff;font-size:24px}.hint{position:absolute;left:16px;bottom:16px;z-index:700;max-width:220px;padding:9px 11px;border-radius:15px;background:rgba(255,255,255,.94);color:#40516f;font-size:11px;font-weight:700}.hint.hidden{display:none}</style></head><body><div id="map"></div><div id="hint" class="hint">Drag or zoom freely. Tap the map to drop a pin.</div><button class="locate" id="locate">➤</button><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script>const pts=${data};const requestedCenter=${centerData};const fallback=requestedCenter?[requestedCenter.latitude,requestedCenter.longitude]:[10.3157,123.8854];const selected=pts.find(p=>p.selected);const map=L.map('map',{zoomControl:false,attributionControl:false,dragging:true,touchZoom:true,minZoom:2});L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);const ll=[];pts.forEach(p=>{ll.push([p.latitude,p.longitude]);const html='<div class="pin '+(p.selected?'sel':'')+'"><div class="tail"></div><div class="bubble"><img src="'+esc(p.imageUrl)+'"></div></div>';const icon=L.divIcon({className:'',html,iconSize:[58,70],iconAnchor:[29,63]});const m=L.marker([p.latitude,p.longitude],{icon}).addTo(map);m.on('click',()=>window.ReactNativeWebView.postMessage(JSON.stringify({type:'trava-discover-select',id:p.id})));});let current=fallback;const userMarker=L.marker(current,{icon:L.divIcon({className:'',html:'<div class="user"></div>',iconSize:[48,48],iconAnchor:[24,24]})}).addTo(map);function position(){if(selected){map.setView([selected.latitude,selected.longitude],15);return;}if(ll.length===1){map.setView(ll[0],14);return;}if(ll.length>1){map.fitBounds(L.latLngBounds(ll).pad(.20),{maxZoom:14});return;}map.setView(fallback,13)}position();if(pts.length)document.getElementById('hint').classList.add('hidden');if(navigator.geolocation){navigator.geolocation.getCurrentPosition(pos=>{current=[pos.coords.latitude,pos.coords.longitude];userMarker.setLatLng(current);if(!selected&&!pts.length)map.setView(current,13);},()=>{});}map.on('click',e=>window.ReactNativeWebView.postMessage(JSON.stringify({type:'trava-discover-map-press',latitude:e.latlng.lat,longitude:e.latlng.lng})));document.getElementById('locate').onclick=()=>map.setView(current,15,{animate:true});setTimeout(()=>map.invalidateSize(),80);function esc(s){return String(s||'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));}</script></body></html>`;
}

const styles = StyleSheet.create({ wrap: { width: "100%", height: 420, overflow: "hidden", borderRadius: 28, borderWidth: 1, borderColor: "#DDE5EF", backgroundColor: "#EAF5FF" }, web: { flex: 1, backgroundColor: "#EAF5FF" } });
