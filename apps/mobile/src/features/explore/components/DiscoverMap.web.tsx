import { createElement, useEffect, useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";
import type { DiscoverMapProps, DiscoverPlace } from "./DiscoverMap.types";
export type { DiscoverPlace } from "./DiscoverMap.types";

type Frame = {
  contentWindow?: {
    postMessage(message: unknown, targetOrigin: string): void;
  } | null;
};

export function DiscoverMap({
  places,
  selectedId,
  center,
  onSelect,
  onMapPress,
}: DiscoverMapProps) {
  const frameRef = useRef<Frame | null>(null);
  const html = useMemo(
    () => makeHtml(places, selectedId, center),
    [center, places, selectedId],
  );

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.source !== frameRef.current?.contentWindow) return;

      const data = event.data as {
        type?: string;
        id?: string;
        latitude?: number;
        longitude?: number;
      };

      if (data?.type === "trava-discover-select" && data.id) onSelect(data.id);

      if (
        data?.type === "trava-discover-map-press" &&
        typeof data.latitude === "number" &&
        typeof data.longitude === "number"
      ) {
        onMapPress?.({
          latitude: data.latitude,
          longitude: data.longitude,
        });
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [onMapPress, onSelect]);

  return (
    <View style={styles.wrap}>
      {createElement("iframe", {
        ref: frameRef as never,
        title: "TRAVA Explore map",
        srcDoc: html,
        sandbox: "allow-scripts allow-same-origin",
        style: {
          width: "100%",
          height: "100%",
          border: 0,
          display: "block",
          background: "#DDF4FF",
        },
      })}
    </View>
  );
}

function makeHtml(
  places: DiscoverPlace[],
  selectedId?: string | null,
  center?: DiscoverMapProps["center"],
) {
  const data = JSON.stringify(
    places.map((place) => ({
      ...place,
      selected: place.id === selectedId,
    })),
  ).replace(/</g, "\\u003c");

  const centerData = JSON.stringify(center ?? null);

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>
*{box-sizing:border-box}
html,body,#map{width:100%;height:100%;margin:0}
body{overflow:hidden;background:#dff4ff;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',sans-serif}
.leaflet-container{background:#dff4ff}
.leaflet-tile{filter:saturate(1.18) brightness(1.08) contrast(.87);opacity:.98}
.leaflet-control-zoom,.leaflet-control-attribution{display:none}

.pin{position:relative;width:66px;height:78px;display:flex;justify-content:center;filter:drop-shadow(0 10px 13px rgba(34,67,111,.18));cursor:pointer}
.tail{position:absolute;top:52px;width:18px;height:18px;background:#fff;transform:rotate(45deg);border-radius:3px}
.bubble{position:relative;z-index:2;width:62px;height:62px;border-radius:31px;padding:4px;background:#fff;box-shadow:0 0 0 1px rgba(212,226,239,.98)}
.bubble img{width:100%;height:100%;object-fit:cover;border-radius:27px}
.pin.sel .bubble{box-shadow:0 0 0 7px rgba(118,91,234,.17),0 9px 20px rgba(45,69,110,.18);transform:scale(1.075)}

.user{width:48px;height:48px;border-radius:24px;background:rgba(77,135,255,.15);display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 12px rgba(78,136,255,.10)}
.user:after{content:'';width:23px;height:23px;border-radius:50%;background:#4d82ff;border:6px solid #fff;box-shadow:0 4px 12px rgba(39,88,208,.26)}

.locate{position:absolute;right:16px;bottom:16px;z-index:800;width:52px;height:52px;border:0;border-radius:26px;background:rgba(255,255,255,.97);box-shadow:0 9px 20px rgba(41,72,111,.16);cursor:pointer}
.locate:before{content:'';position:absolute;left:19px;top:15px;width:14px;height:20px;border-left:4px solid #6d61e6;border-top:4px solid #6d61e6;transform:rotate(45deg);border-radius:2px}

.soft-glow{position:absolute;inset:0;pointer-events:none;z-index:350;background:linear-gradient(180deg,rgba(210,244,255,.05),rgba(255,255,255,0));mix-blend-mode:screen}
</style>
</head>
<body>
<div id="map"></div>
<div class="soft-glow"></div>
<button class="locate" id="locate" aria-label="Center map on my location"></button>

<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
const pts=${data};
const requestedCenter=${centerData};
const fallback=requestedCenter?[requestedCenter.latitude,requestedCenter.longitude]:[10.3157,123.8854];
const selected=pts.find(p=>p.selected);

const map=L.map('map',{
  zoomControl:false,
  attributionControl:false,
  scrollWheelZoom:true,
  doubleClickZoom:true,
  dragging:true,
  touchZoom:true,
  minZoom:2
});

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
  maxZoom:19
}).addTo(map);

const ll=[];
pts.forEach(p=>{
  ll.push([p.latitude,p.longitude]);
  const html='<div class="pin '+(p.selected?'sel':'')+'"><div class="tail"></div><div class="bubble"><img referrerpolicy="no-referrer" src="'+esc(p.imageUrl)+'"></div></div>';
  const icon=L.divIcon({className:'',html,iconSize:[66,78],iconAnchor:[33,70]});
  const marker=L.marker([p.latitude,p.longitude],{icon,riseOnHover:true}).addTo(map);
  marker.bindTooltip(esc(p.name),{direction:'top',offset:[0,-58],opacity:.94});
  marker.on('click',()=>parent.postMessage({type:'trava-discover-select',id:p.id},'*'));
});

let current=fallback;
const userIcon=L.divIcon({
  className:'',
  html:'<div class="user"></div>',
  iconSize:[48,48],
  iconAnchor:[24,24]
});
const userMarker=L.marker(current,{icon:userIcon,zIndexOffset:900}).addTo(map);

function position(){
  if(selected){
    map.setView([selected.latitude,selected.longitude],14,{animate:false});
    return;
  }
  if(ll.length===1){
    map.setView(ll[0],14);
    return;
  }
  if(ll.length>1){
    map.fitBounds(L.latLngBounds(ll).pad(.18),{maxZoom:13});
    return;
  }
  map.setView(fallback,13);
}
position();

if(navigator.geolocation){
  navigator.geolocation.getCurrentPosition(
    pos=>{
      current=[pos.coords.latitude,pos.coords.longitude];
      userMarker.setLatLng(current);
      if(!selected&&!pts.length)map.setView(current,13);
    },
    ()=>{},
    {enableHighAccuracy:false,timeout:4500,maximumAge:300000}
  );
}

map.on('click',e=>parent.postMessage({
  type:'trava-discover-map-press',
  latitude:e.latlng.lat,
  longitude:e.latlng.lng
},'*'));

document.getElementById('locate').onclick=()=>map.setView(current,15,{animate:true});
setTimeout(()=>map.invalidateSize(),80);

function esc(s){
  return String(s||'').replace(/[&<>'"]/g,m=>({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    "'":'&#39;',
    '"':'&quot;'
  }[m]));
}
</script>
</body>
</html>`;
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    height: 356,
    overflow: "hidden",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#D9E8F2",
    backgroundColor: "#DDF4FF",
    boxShadow: "0 15px 32px rgba(42,73,112,.10)",
  },
});
