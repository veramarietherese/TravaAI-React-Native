import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

import type { DiscoverMapProps } from "./DiscoverMap.types";

export function DiscoverMap({ places, selectedId, onSelect }: DiscoverMapProps) {
  const html = useMemo(() => makeHtml(places, selectedId), [places, selectedId]);
  return <View style={styles.wrap}><WebView
    originWhitelist={["*"]}
    source={{ html }}
    javaScriptEnabled
    domStorageEnabled
    onMessage={(event) => {
      try { const data = JSON.parse(event.nativeEvent.data) as { type?: string; id?: string }; if (data.type === "trava-discover-select" && data.id) onSelect(data.id); } catch { /* ignore non-TRAVA messages */ }
    }}
    style={styles.web}
  /></View>;
}

function makeHtml(places: DiscoverMapProps["places"], selectedId?: string | null) {
  const data = JSON.stringify(places.map((p) => ({ ...p, selected: p.id === selectedId }))).replace(/</g, "\\u003c");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no"><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"><style>*{box-sizing:border-box}html,body,#map{width:100%;height:100%;margin:0}body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#f4f5f6;overflow:hidden}.leaflet-container{background:#eef0f2}.leaflet-tile{filter:grayscale(.18) saturate(.65) brightness(1.09) contrast(.9)}.leaflet-control-zoom{display:none}.pin{position:relative;width:48px;height:57px;display:flex;justify-content:center;filter:drop-shadow(0 9px 12px rgba(34,36,41,.18))}.bubble{width:44px;height:44px;border-radius:22px;border:3px solid white;background:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden}.bubble img{width:100%;height:100%;object-fit:cover}.tail{position:absolute;top:36px;width:14px;height:14px;background:#fff;transform:rotate(45deg);border-right:1px solid #ddd;border-bottom:1px solid #ddd}.pin.sel .bubble{box-shadow:0 0 0 7px rgba(55,58,64,.12);transform:scale(1.07)}.fit{position:absolute;z-index:999;right:16px;top:16px;width:48px;height:48px;border:1px solid #dedfe2;border-radius:24px;background:rgba(255,255,255,.94);font-size:20px;color:#26292f}.near,.radius{position:absolute;z-index:999;bottom:16px;border:1px solid #e0e1e4;border-radius:18px;background:rgba(255,255,255,.94);padding:10px 13px;font-weight:800;font-size:11px;color:#4b4f55}.near{left:16px}.radius{right:16px;color:#73777d}</style></head><body><div id="map"></div><button class="fit" id="fit">◎</button><div class="near">Places nearby⌄</div><div class="radius">Within 5 km &nbsp;☷</div><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script>const pts=${data};const map=L.map('map',{zoomControl:false,scrollWheelZoom:true,doubleClickZoom:true,dragging:true,touchZoom:true,minZoom:2});L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);const ll=[];pts.forEach(p=>{ll.push([p.latitude,p.longitude]);const h='<div class="pin '+(p.selected?'sel':'')+'"><div class="tail"></div><div class="bubble"><img src="'+esc(p.imageUrl)+'"></div></div>';const icon=L.divIcon({className:'',html:h,iconSize:[48,58],iconAnchor:[24,52]});const m=L.marker([p.latitude,p.longitude],{icon}).addTo(map);m.on('click',()=>window.ReactNativeWebView.postMessage(JSON.stringify({type:'trava-discover-select',id:p.id})));});function fit(){if(ll.length>1)map.fitBounds(L.latLngBounds(ll).pad(.16),{maxZoom:13});else if(ll.length===1)map.setView(ll[0],13);else map.setView([56.9496,24.1052],12)}fit();document.getElementById('fit').onclick=fit;setTimeout(()=>map.invalidateSize(),80);function esc(s){return String(s||'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));}</script></body></html>`;
}

const styles = StyleSheet.create({ wrap:{width:"100%",height:520,overflow:"hidden",borderRadius:30,borderWidth:1,borderColor:"#E0E1E4",backgroundColor:"#F4F5F6"}, web:{flex:1,backgroundColor:"#F4F5F6"} });
