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
      const data = event.data as { type?: string; id?: string; latitude?: number; longitude?: number };
      if (data.type === "trava-discover-select" && data.id) onSelect(data.id);
      if (data.type === "trava-discover-map-press" && typeof data.latitude === "number" && typeof data.longitude === "number") {
        onMapPress?.({ latitude: data.latitude, longitude: data.longitude });
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [onMapPress, onSelect]);

  return (
    <View style={s.wrap}>
      {createElement("iframe", {
        ref: frameRef as never,
        title: "TRAVA Discover map",
        srcDoc: html,
        sandbox: "allow-scripts",
        style: { width: "100%", height: "100%", border: 0, display: "block", background: "#EAF4FF" },
      })}
    </View>
  );
}

function makeHtml(places: DiscoverPlace[], selectedId?: string | null, center?: DiscoverMapProps["center"]) {
  const data = JSON.stringify(places.map((place) => ({ ...place, selected: place.id === selectedId }))).replace(/</g, "\\u003c");
  const centerData = JSON.stringify(center ?? null);
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"><style>
*{box-sizing:border-box}html,body,#map{width:100%;height:100%;margin:0}body{overflow:hidden;background:#eaf4ff;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',sans-serif}
.leaflet-container{background:#eaf4ff}.leaflet-tile{filter:saturate(.54) brightness(1.17) contrast(.72) hue-rotate(-7deg);opacity:.98}.leaflet-control-zoom,.leaflet-control-attribution{display:none}
.pin{position:relative;width:62px;height:75px;display:flex;justify-content:center;filter:drop-shadow(0 10px 12px rgba(40,63,104,.18));cursor:pointer}.tail{position:absolute;top:50px;width:18px;height:18px;background:#fff;transform:rotate(45deg);border-radius:3px}
.photo{position:relative;z-index:2;width:60px;height:60px;border-radius:30px;padding:4px;background:#fff;box-shadow:0 0 0 1px rgba(215,224,236,.95)}.photo img{width:100%;height:100%;object-fit:cover;border-radius:26px}.pin.sel .photo{box-shadow:0 0 0 7px rgba(69,116,255,.18);transform:scale(1.06)}
.userhalo{width:62px;height:62px;border-radius:31px;background:rgba(63,112,255,.12);display:flex;align-items:center;justify-content:center}.userdot{width:31px;height:31px;border-radius:50%;background:#3977ff;border:7px solid #fff;box-shadow:0 5px 16px rgba(32,84,219,.35)}
.locate{position:absolute;right:17px;bottom:17px;z-index:900;width:58px;height:58px;border:0;border-radius:29px;background:#fff;box-shadow:0 9px 22px rgba(37,59,92,.16);cursor:pointer}
.locate:before{content:'';position:absolute;left:19px;top:16px;width:18px;height:23px;border-left:4px solid #3b6cff;border-top:4px solid #3b6cff;transform:rotate(45deg);border-radius:2px}
.city{position:absolute;left:42%;top:62%;z-index:600;color:#1f2b42;font-size:25px;font-weight:800;letter-spacing:-.5px;text-shadow:0 1px 0 rgba(255,255,255,.8);pointer-events:none}
</style></head><body><div id="map"></div><div class="city" id="city"></div><button class="locate" id="locate"></button>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script>
const pts=${data};const requestedCenter=${centerData};const fallback=requestedCenter?[requestedCenter.latitude,requestedCenter.longitude]:[10.3157,123.8854];const selected=pts.find(p=>p.selected);
const map=L.map('map',{zoomControl:false,attributionControl:false,scrollWheelZoom:true,doubleClickZoom:true,dragging:true,touchZoom:true,minZoom:2});L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
const bounds=[];pts.forEach(p=>{bounds.push([p.latitude,p.longitude]);const html='<div class="pin '+(p.selected?'sel':'')+'"><div class="tail"></div><div class="photo"><img src="'+esc(p.imageUrl)+'"></div></div>';const icon=L.divIcon({className:'',html,iconSize:[62,75],iconAnchor:[31,67]});const marker=L.marker([p.latitude,p.longitude],{icon,riseOnHover:true}).addTo(map);marker.on('click',()=>parent.postMessage({type:'trava-discover-select',id:p.id},'*'));});
let current=fallback;const userIcon=L.divIcon({className:'',html:'<div class="userhalo"><div class="userdot"></div></div>',iconSize:[62,62],iconAnchor:[31,31]});const user=L.marker(current,{icon:userIcon,zIndexOffset:1000}).addTo(map);
function position(){if(selected){map.setView([selected.latitude,selected.longitude],15,{animate:false});}else if(bounds.length>1){map.fitBounds(L.latLngBounds(bounds).pad(.14),{maxZoom:14});}else if(bounds.length===1){map.setView(bounds[0],15);}else{map.setView(fallback,14);}}position();
const city=(selected&&selected.city)||(pts[0]&&pts[0].city)||'';document.getElementById('city').textContent=city;
if(navigator.geolocation){navigator.geolocation.getCurrentPosition(pos=>{current=[pos.coords.latitude,pos.coords.longitude];user.setLatLng(current);if(!selected&&!pts.length)map.setView(current,14);},()=>{}, {timeout:4500,maximumAge:300000});}
map.on('click',e=>parent.postMessage({type:'trava-discover-map-press',latitude:e.latlng.lat,longitude:e.latlng.lng},'*'));document.getElementById('locate').onclick=()=>map.setView(current,15,{animate:true});setTimeout(()=>map.invalidateSize(),90);
function esc(s){return String(s||'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));}
</script></body></html>`;
}

const s = StyleSheet.create({
  wrap: { width: "100%", height: 430, overflow: "hidden", borderRadius: 28, borderWidth: 1, borderColor: "#E0E7F0", backgroundColor: "#EAF4FF", boxShadow: "0 16px 36px rgba(35,58,91,.09)" },
});
