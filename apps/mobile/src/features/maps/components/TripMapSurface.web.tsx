import { createElement, useEffect, useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";
import type { TripMapSurfaceProps } from "./TripMapSurface.types";

type Frame = { contentWindow?: { postMessage(message: unknown, targetOrigin: string): void } | null };

export function TripMapSurface({
  activities,
  selectedActivityId,
  onSelectActivity,
  height = 360,
  mapMode = "map",
}: TripMapSurfaceProps) {
  const frameRef = useRef<Frame | null>(null);
  const html = useMemo(
    () => makeMapHtml(activities, selectedActivityId, mapMode),
    [activities, selectedActivityId, mapMode],
  );

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frameRef.current?.contentWindow) return;
      const payload = event.data as { type?: string; id?: string };
      if (payload?.type === "trava-select" && payload.id) onSelectActivity?.(payload.id);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onSelectActivity]);

  return (
    <View style={[styles.wrap, { height }]}>
      {createElement("iframe", {
        ref: frameRef as never,
        title: "Interactive TRAVA itinerary map",
        srcDoc: html,
        sandbox: "allow-scripts allow-same-origin",
        allow: "geolocation",
        style: {
          width: "100%",
          height: "100%",
          border: 0,
          display: "block",
          background: "#EEF4F8",
        },
      })}
    </View>
  );
}

function makeMapHtml(
  activities: TripMapSurfaceProps["activities"],
  selected: string | null | undefined,
  mapMode: "map" | "satellite",
) {
  const points = activities
    .filter((activity) => activity.latitude != null && activity.longitude != null)
    .map((activity, index) => ({
      ...activity,
      index: index + 1,
      selected: activity.id === selected,
      color: colorFor(activity.category),
    }));
  const data = JSON.stringify(points).replace(/</g, "\\u003c");
  const satellite = mapMode === "satellite";
  const tileUrl = satellite
    ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
    : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
  const attribution = satellite
    ? "Tiles © Esri"
    : "© OpenStreetMap contributors";

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>
*{box-sizing:border-box}html,body,#map{width:100%;height:100%;margin:0}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#eef4f8;overflow:hidden}.leaflet-container{background:#eef4f8}.leaflet-tile{filter:${satellite ? "saturate(.92) brightness(1.01)" : "saturate(.78) brightness(1.08) contrast(.91)"}}.leaflet-control-zoom{border:0!important;border-radius:15px!important;overflow:hidden;box-shadow:0 10px 26px rgba(45,62,90,.15)!important}.leaflet-control-zoom a{border:0!important;background:rgba(255,255,255,.96)!important;color:#1d2d49!important}.leaflet-control-attribution{font-size:8px!important;background:rgba(255,255,255,.8)!important}.trava-marker{position:relative;width:132px;height:54px}.pin{position:absolute;left:0;top:0;width:34px;height:34px;border-radius:17px;border:3px solid #fff;background:var(--c);display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;font-weight:900;box-shadow:0 8px 20px rgba(39,55,84,.24)}.label{position:absolute;left:21px;top:28px;max-width:110px;padding:5px 10px;border-radius:11px;background:rgba(255,255,255,.97);color:#17243a;font-size:9px;font-weight:850;line-height:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-shadow:0 7px 18px rgba(42,56,82,.13);border:1px solid rgba(229,235,243,.95)}.trava-marker.sel .pin{transform:scale(1.12);box-shadow:0 0 0 6px rgba(52,126,255,.16),0 8px 20px rgba(39,55,84,.24)}.trava-marker.sel .label{color:#176ee7;border-color:#cfe2ff}.fit,.locate{position:absolute;z-index:900;border:0;background:rgba(255,255,255,.96);box-shadow:0 9px 22px rgba(40,55,82,.15);cursor:pointer;color:#20334f}.fit{right:14px;top:76px;height:38px;border-radius:19px;padding:0 13px;font-size:10px;font-weight:900}.locate{right:14px;bottom:14px;width:44px;height:44px;border-radius:22px;font-size:20px}.leaflet-popup-content-wrapper{border-radius:15px;box-shadow:0 10px 28px rgba(40,55,82,.18)}.popupTitle{font-size:12px;font-weight:900;color:#15243b}.popupPlace{margin-top:3px;font-size:9px;color:#687a92}
</style>
</head>
<body>
<div id="map"></div>
<button class="fit" id="fit">Fit route</button>
<button class="locate" id="locate">⌖</button>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
const pts=${data};
const map=L.map('map',{zoomControl:true,attributionControl:true,scrollWheelZoom:true,doubleClickZoom:true,dragging:true,touchZoom:true,minZoom:2});
L.tileLayer('${tileUrl}',{maxZoom:19,attribution:'${attribution}'}).addTo(map);
const ll=[];
pts.forEach(p=>{
  ll.push([p.latitude,p.longitude]);
  const html='<div class="trava-marker '+(p.selected?'sel':'')+'" style="--c:'+p.color+'"><div class="pin">'+p.index+'</div><div class="label">'+esc(shortName(p.locationName||p.title))+'</div></div>';
  const icon=L.divIcon({className:'',html,iconSize:[132,54],iconAnchor:[17,17],popupAnchor:[0,-20]});
  const marker=L.marker([p.latitude,p.longitude],{icon,riseOnHover:true}).addTo(map);
  marker.bindPopup('<div class="popupTitle">'+esc(p.title)+'</div><div class="popupPlace">'+esc(p.locationName)+'</div>');
  marker.on('click',()=>parent.postMessage({type:'trava-select',id:p.id},'*'));
  if(p.selected)setTimeout(()=>marker.openPopup(),90);
});
if(ll.length>1){L.polyline(ll,{color:'#fff',weight:7,opacity:.9,lineCap:'round',lineJoin:'round'}).addTo(map);L.polyline(ll,{color:'#2779F5',weight:3.6,opacity:.96,lineCap:'round',lineJoin:'round'}).addTo(map)}
function fit(){if(ll.length===1)map.setView(ll[0],14);else if(ll.length>1)map.fitBounds(L.latLngBounds(ll).pad(.22),{maxZoom:14});else map.setView([34.6937,135.5023],11)}
fit();document.getElementById('fit').onclick=fit;
let user=null;
if(navigator.geolocation){navigator.geolocation.getCurrentPosition(pos=>{const c=[pos.coords.latitude,pos.coords.longitude];user=L.circleMarker(c,{radius:8,color:'#fff',weight:4,fillColor:'#2f6df4',fillOpacity:1}).addTo(map)},()=>{}, {enableHighAccuracy:false,timeout:5000,maximumAge:300000})}
document.getElementById('locate').onclick=()=>{if(user)map.setView(user.getLatLng(),15);else fit()};
setTimeout(()=>map.invalidateSize(),80);
function shortName(s){return String(s||'').split(',')[0].trim()||'Stop'}
function esc(s){return String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
</script>
</body>
</html>`;
}

function colorFor(category: string) {
  const value = String(category || "").toLowerCase();
  if (value.includes("food")) return "#FF5A94";
  if (value.includes("stay") || value.includes("hotel")) return "#E653A4";
  if (value.includes("flight") || value.includes("airport")) return "#2788F6";
  if (value.includes("transport")) return "#7654F5";
  if (value.includes("shop")) return "#3BAE6F";
  if (value.includes("meeting") || value.includes("work")) return "#596FD3";
  if (value.includes("sight")) return "#8357F0";
  return "#EF8A2C";
}

const styles = StyleSheet.create({
  wrap: {
    overflow: "hidden",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#DEE6F0",
    backgroundColor: "#EEF4F8",
    boxShadow: "0 18px 38px rgba(46,63,91,.10)",
  },
});
