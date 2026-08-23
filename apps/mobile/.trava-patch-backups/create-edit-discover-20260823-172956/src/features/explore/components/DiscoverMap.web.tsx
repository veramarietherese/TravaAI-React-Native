import { createElement, useEffect, useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";

import type { DiscoverMapProps, DiscoverPlace } from "./DiscoverMap.types";

type Frame = { contentWindow?: { postMessage(message: unknown, targetOrigin: string): void } | null };

export function DiscoverMap({ places, selectedId, onSelect }: DiscoverMapProps) {
  const frameRef = useRef<Frame | null>(null);
  const html = useMemo(() => makeHtml(places, selectedId), [places, selectedId]);
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.source !== frameRef.current?.contentWindow) return;
      const data = event.data as { type?: string; id?: string };
      if (data?.type === "trava-discover-select" && data.id) onSelect(data.id);
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [onSelect]);
  return <View style={styles.wrap}>{createElement("iframe", {
    ref: frameRef as never,
    title: "TRAVA Discover map",
    srcDoc: html,
    sandbox: "allow-scripts",
    style: { width: "100%", height: "100%", border: 0, display: "block", background: "#F4F5F6" },
  })}</View>;
}

function makeHtml(places: DiscoverPlace[], selectedId?: string | null) {
  const data = JSON.stringify(places.map((p) => ({ ...p, selected: p.id === selectedId }))).replace(/</g, "\\u003c");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"><style>
  *{box-sizing:border-box}html,body,#map{width:100%;height:100%;margin:0}body{font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',sans-serif;background:#f4f5f6;overflow:hidden}.leaflet-container{background:#eef0f2}.leaflet-tile{filter:grayscale(.18) saturate(.65) brightness(1.09) contrast(.9)}
  .leaflet-control-zoom{display:none}.leaflet-control-attribution{font-size:7px!important;background:rgba(255,255,255,.78)!important;color:#85898f!important}.leaflet-control-attribution a{color:#73777d!important}
  .pin{position:relative;width:48px;height:57px;display:flex;justify-content:center;filter:drop-shadow(0 9px 12px rgba(34,36,41,.18));cursor:pointer}.bubble{width:44px;height:44px;border-radius:22px;border:3px solid white;background:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden}.bubble img{width:100%;height:100%;object-fit:cover}.tail{position:absolute;top:36px;width:14px;height:14px;background:#fff;transform:rotate(45deg);border-right:1px solid #ddd;border-bottom:1px solid #ddd}.pin.sel .bubble{box-shadow:0 0 0 7px rgba(55,58,64,.12);transform:scale(1.07)}.pin.sel .tail{transform:rotate(45deg) scale(1.07)}
  .spark{width:44px;height:44px;border-radius:22px;background:linear-gradient(135deg,#f6f6f7,#d9dce0);border:3px solid #fff;display:flex;align-items:center;justify-content:center;color:#31343a;font-size:19px}.loc{width:44px;height:44px;border-radius:22px;background:#fff;border:3px solid #fff;box-shadow:0 0 0 7px rgba(30,31,35,.08);display:flex;align-items:center;justify-content:center}.loc:before{content:'';width:13px;height:13px;border-radius:50%;border:4px solid #202328}.fit{position:absolute;z-index:999;right:16px;top:16px;width:48px;height:48px;border:1px solid #dedfe2;border-radius:24px;background:rgba(255,255,255,.94);box-shadow:0 8px 20px rgba(24,26,30,.11);font-size:20px;cursor:pointer;color:#26292f}.near{position:absolute;z-index:999;left:16px;bottom:16px;border:1px solid #e0e1e4;border-radius:18px;background:rgba(255,255,255,.94);box-shadow:0 8px 20px rgba(24,26,30,.08);padding:10px 13px;font-weight:800;font-size:11px;color:#292c31}.radius{position:absolute;z-index:999;right:16px;bottom:16px;border:1px solid #e0e1e4;border-radius:18px;background:rgba(255,255,255,.94);box-shadow:0 8px 20px rgba(24,26,30,.08);padding:10px 13px;font-weight:700;font-size:11px;color:#73777d}
  </style></head><body><div id="map"></div><button class="fit" id="fit">◎</button><div class="near">Places nearby⌄</div><div class="radius">Within 5 km &nbsp;☷</div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script>
  const pts=${data};const map=L.map('map',{zoomControl:false,attributionControl:true,scrollWheelZoom:true,doubleClickZoom:true,dragging:true,touchZoom:true,minZoom:2});
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);
  const ll=[];pts.forEach((p,i)=>{ll.push([p.latitude,p.longitude]);const html='<div class="pin '+(p.selected?'sel':'')+'"><div class="tail"></div><div class="bubble"><img src="'+esc(p.imageUrl)+'" alt=""></div></div>';const icon=L.divIcon({className:'',html,iconSize:[48,58],iconAnchor:[24,52]});const m=L.marker([p.latitude,p.longitude],{icon,riseOnHover:true}).addTo(map);m.on('click',()=>parent.postMessage({type:'trava-discover-select',id:p.id},'*'));});
  const user=[56.9496,24.1052];L.marker(user,{icon:L.divIcon({className:'',html:'<div class="loc"></div>',iconSize:[44,44],iconAnchor:[22,22]})}).addTo(map);
  function fit(){if(ll.length>1)map.fitBounds(L.latLngBounds(ll).pad(.16),{maxZoom:13});else if(ll.length===1)map.setView(ll[0],13);else map.setView(user,12)}fit();document.getElementById('fit').onclick=fit;setTimeout(()=>map.invalidateSize(),80);function esc(s){return String(s||'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));}
  </script></body></html>`;
}

const styles = StyleSheet.create({ wrap: { width: "100%", height: 520, overflow: "hidden", borderRadius: 30, borderWidth: 1, borderColor: "#E0E1E4", backgroundColor: "#F4F5F6", boxShadow: "0 16px 36px rgba(22,24,29,.07)" } });
