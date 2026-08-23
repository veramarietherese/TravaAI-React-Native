import { createElement, useEffect, useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";
import type { DiscoverMapProps, DiscoverPlace } from "./DiscoverMap.types";
export type { DiscoverPlace } from "./DiscoverMap.types";

type Frame = { contentWindow?: { postMessage(message: unknown, targetOrigin: string): void } | null };

export function DiscoverMap({ places, selectedId, center, onSelect, onMapPress }: DiscoverMapProps) {
  const frameRef = useRef<Frame | null>(null);
  const html = useMemo(() => makeHtml(places, selectedId, center), [center, places, selectedId]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.source !== frameRef.current?.contentWindow) return;
      const data = event.data as { type?: string; id?: string };
      if (data?.type === "trava-discover-select" && data.id) onSelect(data.id);
      if (data?.type === "trava-discover-map-press" && typeof (data as any).latitude === "number" && typeof (data as any).longitude === "number") onMapPress?.({ latitude: (data as any).latitude, longitude: (data as any).longitude });
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [onMapPress, onSelect]);

  return <View style={styles.wrap}>{createElement("iframe", {
    ref: frameRef as never,
    title: "TRAVA Discover map",
    srcDoc: html,
    sandbox: "allow-scripts allow-same-origin",
    style: { width: "100%", height: "100%", border: 0, display: "block", background: "#EAF5FF" },
  })}</View>;
}

function makeHtml(places: DiscoverPlace[], selectedId?: string | null, center?: DiscoverMapProps["center"]) {
  const data = JSON.stringify(places.map((place) => ({ ...place, selected: place.id === selectedId }))).replace(/</g, "\\u003c");
  const centerData = JSON.stringify(center ?? null);
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"><style>
*{box-sizing:border-box}html,body,#map{width:100%;height:100%;margin:0}body{overflow:hidden;background:#eaf5ff;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',sans-serif}.leaflet-container{background:#eaf5ff}.leaflet-tile{filter:saturate(.55) brightness(1.16) contrast(.76) hue-rotate(-4deg);opacity:.95}.leaflet-control-zoom,.leaflet-control-attribution{display:none}
.pin{position:relative;width:68px;height:80px;display:flex;justify-content:center;filter:drop-shadow(0 11px 14px rgba(36,63,110,.18));cursor:pointer}.tail{position:absolute;top:53px;width:19px;height:19px;background:#fff;transform:rotate(45deg);border-radius:2px}.bubble{position:relative;z-index:2;width:64px;height:64px;border-radius:32px;padding:4px;background:#fff;box-shadow:0 0 0 1px rgba(214,224,237,.95)}.bubble img{width:100%;height:100%;object-fit:cover;border-radius:28px}.pin.sel .bubble{box-shadow:0 0 0 7px rgba(81,132,255,.18);transform:scale(1.06)}
.user{width:50px;height:50px;border-radius:25px;background:rgba(69,114,255,.14);display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 12px rgba(74,119,255,.10)}.user:after{content:'';width:23px;height:23px;border-radius:50%;background:#3976ff;border:6px solid #fff;box-shadow:0 4px 13px rgba(31,88,225,.28)}
.locate{position:absolute;right:18px;bottom:18px;z-index:800;width:58px;height:58px;border:0;border-radius:29px;background:rgba(255,255,255,.97);box-shadow:0 9px 22px rgba(37,59,92,.15);cursor:pointer}.locate:after{content:"";position:absolute;left:22px;top:17px;width:14px;height:20px;border-left:4px solid #3B6CFF;border-top:4px solid #3B6CFF;transform:rotate(45deg);border-radius:2px}.hint{position:absolute;left:18px;bottom:18px;z-index:700;max-width:250px;padding:10px 13px;border-radius:16px;background:rgba(255,255,255,.94);box-shadow:0 8px 18px rgba(37,59,92,.10);color:#40516f;font-size:12px;font-weight:700}.hint.hidden{display:none}
</style></head><body><div id="map"></div><div id="hint" class="hint">Drag or zoom freely. Tap the map to drop a pin.</div><button class="locate" id="locate" aria-label="Center map on my location"></button><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script>
const pts=${data};const requestedCenter=${centerData};const fallback=requestedCenter?[requestedCenter.latitude,requestedCenter.longitude]:[10.3157,123.8854];const selected=pts.find(p=>p.selected);const map=L.map('map',{zoomControl:false,attributionControl:false,scrollWheelZoom:true,doubleClickZoom:true,dragging:true,touchZoom:true,minZoom:2});L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);const ll=[];pts.forEach(p=>{ll.push([p.latitude,p.longitude]);const html='<div class="pin '+(p.selected?'sel':'')+'"><div class="tail"></div><div class="bubble"><img src="'+esc(p.imageUrl)+'"></div></div>';const icon=L.divIcon({className:'',html,iconSize:[68,80],iconAnchor:[34,72]});const marker=L.marker([p.latitude,p.longitude],{icon,riseOnHover:true}).addTo(map);marker.bindTooltip(esc(p.name),{direction:'top',offset:[0,-60],opacity:.92});marker.on('click',()=>parent.postMessage({type:'trava-discover-select',id:p.id},'*'));});let current=fallback;const userIcon=L.divIcon({className:'',html:'<div class="user"></div>',iconSize:[50,50],iconAnchor:[25,25]});const userMarker=L.marker(current,{icon:userIcon,zIndexOffset:900}).addTo(map);
function position(){if(selected){map.setView([selected.latitude,selected.longitude],15,{animate:false});return;}if(ll.length===1){map.setView(ll[0],14);return;}if(ll.length>1){map.fitBounds(L.latLngBounds(ll).pad(.20),{maxZoom:14});return;}map.setView(fallback,13);}position();if(pts.length)document.getElementById('hint').classList.add('hidden');if(navigator.geolocation){navigator.geolocation.getCurrentPosition(pos=>{current=[pos.coords.latitude,pos.coords.longitude];userMarker.setLatLng(current);if(!selected&&!pts.length)map.setView(current,13);},()=>{}, {enableHighAccuracy:false,timeout:4500,maximumAge:300000});}map.on('click',e=>parent.postMessage({type:'trava-discover-map-press',latitude:e.latlng.lat,longitude:e.latlng.lng},'*'));document.getElementById('locate').onclick=()=>map.setView(current,15,{animate:true});setTimeout(()=>map.invalidateSize(),80);function esc(s){return String(s||'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));}
</script></body></html>`;
}

const styles = StyleSheet.create({ wrap: { width: "100%", height: 430, overflow: "hidden", borderRadius: 30, borderWidth: 1, borderColor: "#DDE5EF", backgroundColor: "#EAF5FF", boxShadow: "0 16px 36px rgba(35,58,91,.09)" } });
