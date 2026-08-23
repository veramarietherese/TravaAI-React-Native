import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

import type { TripMapSurfaceProps } from "./TripMapSurface.types";

export function TripMapSurface({ activities, selectedActivityId, onSelectActivity, height = 320 }: TripMapSurfaceProps) {
  const html = mapHtml(activities, selectedActivityId);
  return (
    <View style={[styles.wrap, { height }]}>
      <WebView
        originWhitelist={["*"]}
        source={{ html }}
        javaScriptEnabled
        domStorageEnabled
        onMessage={(event) => {
          try {
            const payload = JSON.parse(event.nativeEvent.data) as { type?: string; id?: string };
            if (payload.type === "trava-map-select" && payload.id) onSelectActivity?.(payload.id);
          } catch { /* ignore map bridge noise */ }
        }}
        style={styles.webview}
      />
    </View>
  );
}

function mapHtml(activities: TripMapSurfaceProps["activities"], selectedId: string | null | undefined) {
  const points = activities.filter((item) => item.latitude !== null && item.longitude !== null).map((item, index) => ({ id: item.id, lat: item.latitude, lng: item.longitude, title: item.title, place: item.locationName, category: item.category, selected: item.id === selectedId, index: index + 1 }));
  const payload = JSON.stringify(points).replace(/</g, "\\u003c");
  return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/><style>
  html,body,#map{height:100%;margin:0}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#edf5ff}.leaflet-control-zoom{border:0!important;box-shadow:0 12px 28px rgba(52,57,92,.14)!important}.leaflet-control-zoom a{width:42px!important;height:42px!important;line-height:42px!important;border:0!important;color:#17213b!important}.leaflet-control-attribution{font-size:7px;background:rgba(255,255,255,.65)!important}.pin{width:36px;height:36px;border-radius:18px;background:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 20px rgba(44,39,83,.20);border:1px solid rgba(255,255,255,.92);font-size:17px}.pin.sel{width:42px;height:42px;border-radius:21px;background:linear-gradient(135deg,#ec4899,#7c3aed);color:#fff}.leaflet-popup-content-wrapper{border-radius:18px;box-shadow:0 16px 42px rgba(50,43,82,.18)}.leaflet-popup-content{margin:12px 14px}.title{font-weight:800;color:#121b34;font-size:13px}.place{margin-top:3px;color:#6e7890;font-size:10px}
  </style></head><body><div id="map"></div><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script>
  const points=${payload}; const map=L.map('map',{zoomControl:true,attributionControl:true}); L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(map); const glyph={flight:'✈️',stay:'🏨',food:'🍜',sightseeing:'⭐',transport:'🚆',shopping:'🛍️',meeting:'💼',other:'📍'}; const latlngs=[];
  points.forEach((p)=>{if(p.lat==null||p.lng==null)return;const icon=L.divIcon({className:'',html:'<div class="pin '+(p.selected?'sel':'')+'">'+(glyph[p.category]||'📍')+'</div>',iconSize:[42,42],iconAnchor:[21,21]});const marker=L.marker([p.lat,p.lng],{icon}).addTo(map);marker.bindPopup('<div class="title">'+esc(p.title)+'</div><div class="place">'+esc(p.place)+'</div>');marker.on('click',()=>{const msg=JSON.stringify({type:'trava-map-select',id:p.id});if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(msg)});latlngs.push([p.lat,p.lng]);}); if(latlngs.length>1)L.polyline(latlngs,{color:'#8b5cf6',weight:3,dashArray:'8 7',opacity:.9}).addTo(map); if(latlngs.length)map.fitBounds(L.latLngBounds(latlngs).pad(.22));else map.setView([35.6762,139.6503],5); function esc(x){return String(x||'').replace(/[&<>'"]/g,(m)=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));}
  </script></body></html>`;
}

const styles = StyleSheet.create({ wrap: { width: "100%", overflow: "hidden", borderRadius: 28, backgroundColor: "#EAF4FF", borderWidth: 1, borderColor: "rgba(255,255,255,.92)", shadowColor: "#554E78", shadowOpacity: .10, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } }, webview: { flex: 1, backgroundColor: "transparent" } });
