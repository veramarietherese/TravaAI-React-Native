import { createElement, useEffect, useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";

import type { TripMapSurfaceProps } from "./TripMapSurface.types";

type GlobeFrame = { contentWindow?: { postMessage(message: unknown, targetOrigin: string): void } | null };

export function TripMapSurface({ activities, selectedActivityId, onSelectActivity, height = 320 }: TripMapSurfaceProps) {
  const frameRef = useRef<GlobeFrame | null>(null);
  const html = useMemo(() => mapHtml(activities, selectedActivityId), [activities, selectedActivityId]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.source !== frameRef.current?.contentWindow) return;
      const payload = event.data as { type?: string; id?: string } | null;
      if (payload?.type === "trava-map-select" && payload.id) onSelectActivity?.(payload.id);
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [onSelectActivity]);

  return (
    <View style={[styles.wrap, { height }]}>
      {createElement("iframe", {
        ref: frameRef as never,
        title: "TRAVA OpenStreetMap itinerary",
        srcDoc: html,
        sandbox: "allow-scripts allow-same-origin",
        style: { display: "block", width: "100%", height: "100%", border: 0, background: "#edf5ff" },
      })}
    </View>
  );
}

function mapHtml(activities: TripMapSurfaceProps["activities"], selectedId: string | null | undefined) {
  const points = activities.filter((item) => item.latitude !== null && item.longitude !== null).map((item, index) => ({ id: item.id, lat: item.latitude, lng: item.longitude, title: item.title, place: item.locationName, category: item.category, selected: item.id === selectedId, index: index + 1 }));
  const payload = JSON.stringify(points).replace(/</g, "\\u003c");
  return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/><style>
  html,body,#map{height:100%;margin:0}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#edf5ff}.leaflet-control-zoom{border:0!important;box-shadow:0 12px 28px rgba(52,57,92,.14)!important}.leaflet-control-zoom a{width:42px!important;height:42px!important;line-height:42px!important;border:0!important;color:#17213b!important}.leaflet-control-attribution{font-size:8px;background:rgba(255,255,255,.68)!important}.pin{width:36px;height:36px;border-radius:18px;background:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 20px rgba(44,39,83,.20);border:1px solid rgba(255,255,255,.92);font-size:17px;transform:translate(-2px,-2px)}.pin.sel{width:42px;height:42px;border-radius:21px;background:linear-gradient(135deg,#ec4899,#7c3aed);color:#fff}.leaflet-popup-content-wrapper{border-radius:18px;box-shadow:0 16px 42px rgba(50,43,82,.18)}.leaflet-popup-content{margin:12px 14px}.title{font-weight:800;color:#121b34;font-size:13px}.place{margin-top:3px;color:#6e7890;font-size:10px}.route{margin-top:7px;color:#7c3aed;font-size:9px;font-weight:800}
  </style></head><body><div id="map"></div><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script>
  const points=${payload};
  const map=L.map('map',{zoomControl:true,attributionControl:true});
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(map);
  const glyph={flight:'✈️',stay:'🏨',food:'🍜',sightseeing:'⭐',transport:'🚆',shopping:'🛍️',meeting:'💼',other:'📍'};
  const latlngs=[];
  points.forEach((p)=>{ if(p.lat==null||p.lng==null)return; const icon=L.divIcon({className:'',html:'<div class="pin '+(p.selected?'sel':'')+'">'+(glyph[p.category]||'📍')+'</div>',iconSize:[42,42],iconAnchor:[21,21]}); const marker=L.marker([p.lat,p.lng],{icon}).addTo(map); marker.bindPopup('<div class="title">'+escapeHtml(p.title)+'</div><div class="place">'+escapeHtml(p.place)+'</div><div class="route">Tap marker to preview directions</div>'); marker.on('click',()=>parent.postMessage({type:'trava-map-select',id:p.id},'*')); latlngs.push([p.lat,p.lng]); });
  if(latlngs.length>1)L.polyline(latlngs,{color:'#8b5cf6',weight:3,dashArray:'8 7',opacity:.9}).addTo(map);
  if(latlngs.length)map.fitBounds(L.latLngBounds(latlngs).pad(.22));else map.setView([35.6762,139.6503],5);
  function escapeHtml(x){return String(x||'').replace(/[&<>'"]/g,(m)=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));}
  </script></body></html>`;
}

const styles = StyleSheet.create({ wrap: { width: "100%", overflow: "hidden", borderRadius: 28, backgroundColor: "#EAF4FF", borderWidth: 1, borderColor: "rgba(255,255,255,.92)", boxShadow: "0 16px 38px rgba(76,70,112,.10)" } });
