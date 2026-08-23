import { createElement, useEffect, useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";
import type { TripMapSurfaceProps } from "./TripMapSurface.types";

type Frame = { contentWindow?: { postMessage(message: unknown, targetOrigin: string): void } | null };
export function TripMapSurface({ activities, selectedActivityId, onSelectActivity, height = 360 }: TripMapSurfaceProps) {
  const frameRef = useRef<Frame | null>(null);
  const html = useMemo(() => makeMapHtml(activities, selectedActivityId), [activities, selectedActivityId]);
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frameRef.current?.contentWindow) return;
      const payload = event.data as { type?: string; id?: string } | null;
      if (payload?.type === "trava-select" && payload.id) onSelectActivity?.(payload.id);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onSelectActivity]);
  return <View style={[styles.wrap, { height }]}>{createElement("iframe", { ref: frameRef as never, title: "TRAVA itinerary map", srcDoc: html, sandbox: "allow-scripts allow-same-origin", style: { width: "100%", height: "100%", border: 0, display: "block", background: "#EEF6FF" } })}</View>;
}
function makeMapHtml(activities: TripMapSurfaceProps["activities"], selected: string | null | undefined) {
  const points = activities.filter((a) => a.latitude != null && a.longitude != null).map((a) => ({ ...a, selected: a.id === selected }));
  const data = JSON.stringify(points).replace(/</g, "\\u003c");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"><style>
  *{box-sizing:border-box}html,body,#map{width:100%;height:100%;margin:0}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#eff6ff}.leaflet-tile{filter:saturate(.72) brightness(1.10) contrast(.88) hue-rotate(7deg)}.leaflet-control-attribution{display:none}.leaflet-control-zoom{border:0!important;border-radius:18px!important;overflow:hidden;box-shadow:0 10px 24px rgba(67,74,110,.16)!important}.leaflet-control-zoom a{width:44px!important;height:44px!important;line-height:44px!important;border:0!important;background:rgba(255,255,255,.94)!important;color:#15203b!important;font-size:24px!important}.leaflet-control-zoom a+a{border-top:1px solid #edf0f5!important}.pin{width:38px;height:38px;border-radius:19px;background:rgba(255,255,255,.96);display:flex;align-items:center;justify-content:center;font-size:18px;border:1px solid rgba(255,255,255,.95);box-shadow:0 7px 18px rgba(74,66,111,.19)}.pin.sel{width:44px;height:44px;border-radius:22px;background:linear-gradient(135deg,#f45d96,#7757f6);box-shadow:0 9px 24px rgba(119,87,246,.30)}.leaflet-popup-content-wrapper{border-radius:18px;box-shadow:0 14px 34px rgba(66,67,102,.16)}.leaflet-popup-content{margin:12px 14px}.tt{font-weight:800;color:#101a35;font-size:13px}.pl{color:#6e7995;font-size:10px;margin-top:3px}
  </style></head><body><div id="map"></div><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script>
  const pts=${data};const map=L.map('map',{zoomControl:true,attributionControl:false,preferCanvas:true});L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);const glyph={flight:'✈️',stay:'🏨',food:'🍜',sightseeing:'🗼',transport:'🚆',shopping:'🛍️',meeting:'💼',other:'📍'};const ll=[];
  pts.forEach(p=>{const icon=L.divIcon({className:'',html:'<div class="pin '+(p.selected?'sel':'')+'">'+(glyph[p.category]||'📍')+'</div>',iconSize:[44,44],iconAnchor:[22,22]});const m=L.marker([p.latitude,p.longitude],{icon}).addTo(map);m.bindPopup('<div class="tt">'+esc(p.title)+'</div><div class="pl">'+esc(p.locationName)+'</div>');m.on('click',()=>parent.postMessage({type:'trava-select',id:p.id},'*'));ll.push([p.latitude,p.longitude]);});if(ll.length>1)L.polyline(ll,{color:'#8262f5',weight:2.5,dashArray:'7 8',opacity:.85}).addTo(map);if(ll.length)map.fitBounds(L.latLngBounds(ll).pad(.30));else map.setView([35.68,139.65],5);function esc(s){return String(s||'').replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]));}
  </script></body></html>`;
}
const styles = StyleSheet.create({ wrap: { overflow: "hidden", borderRadius: 27, borderWidth: 1, borderColor: "rgba(255,255,255,.95)", backgroundColor: "#EEF6FF", boxShadow: "0 16px 34px rgba(68,74,110,.10)" } });
