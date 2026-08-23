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

  return (
    <View style={[styles.wrap, { height }]}> 
      {createElement("iframe", {
        ref: frameRef as never,
        title: "Interactive TRAVA itinerary map",
        srcDoc: html,
        sandbox: "allow-scripts",
        style: { width: "100%", height: "100%", border: 0, display: "block", background: "#EEF7FF" },
      })}
    </View>
  );
}

function makeMapHtml(activities: TripMapSurfaceProps["activities"], selected: string | null | undefined) {
  const points = activities
    .filter((a) => a.latitude != null && a.longitude != null)
    .map((a, index) => ({ ...a, order: index + 1, selected: a.id === selected }));
  const data = JSON.stringify(points).replace(/</g, "\\u003c");

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
  <style>
  *{box-sizing:border-box}html,body,#map{width:100%;height:100%;margin:0}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#eef7ff;overflow:hidden}
  .leaflet-container{background:#eaf5ff;cursor:grab}.leaflet-container:active{cursor:grabbing}.leaflet-tile{filter:saturate(.72) brightness(1.07) contrast(.91) hue-rotate(3deg)}
  .leaflet-control-zoom{border:0!important;border-radius:16px!important;overflow:hidden;box-shadow:0 8px 24px rgba(48,76,112,.18)!important;margin:14px!important}
  .leaflet-control-zoom a{width:40px!important;height:40px!important;line-height:40px!important;border:0!important;background:rgba(255,255,255,.96)!important;color:#17223c!important;font-size:20px!important}.leaflet-control-zoom a+a{border-top:1px solid #edf1f7!important}
  .leaflet-control-attribution{font-size:8px!important;background:rgba(255,255,255,.82)!important;color:#6d7990!important;padding:2px 6px!important}.leaflet-control-attribution a{color:#5b84b9!important}
  .trava-pin{position:relative;width:38px;height:44px;display:flex;align-items:flex-start;justify-content:center;filter:drop-shadow(0 7px 9px rgba(63,84,122,.22))}.pin-dot{width:34px;height:34px;border-radius:17px;background:linear-gradient(135deg,#8ec7ff,#b7b5ff 55%,#ffafd0);border:3px solid white;display:flex;align-items:center;justify-content:center;color:#14213c;font-size:11px;font-weight:900}.pin-tail{position:absolute;top:29px;width:10px;height:10px;background:#b7b5ff;transform:rotate(45deg);border-right:2px solid white;border-bottom:2px solid white}.trava-pin.sel .pin-dot{width:38px;height:38px;border-radius:19px;background:linear-gradient(135deg,#75b9f8,#a8aef6,#f59fc7);box-shadow:0 0 0 6px rgba(139,190,245,.18)}.trava-pin.sel .pin-tail{top:33px;background:#a8aef6}
  .leaflet-popup-content-wrapper{border-radius:18px;box-shadow:0 14px 34px rgba(66,79,111,.18);border:1px solid rgba(255,255,255,.95)}.leaflet-popup-content{margin:12px 14px;min-width:145px}.tt{font-weight:850;color:#101a35;font-size:13px}.pl{color:#6e7995;font-size:10px;line-height:14px;margin-top:4px}.cat{display:inline-block;margin-top:7px;padding:4px 7px;border-radius:9px;background:#eef6ff;color:#5e7ea8;font-size:8px;font-weight:800;text-transform:capitalize}
  .route-halo{stroke:#ffffff;stroke-width:7;stroke-linecap:round;stroke-linejoin:round;opacity:.85}.map-badge{position:absolute;z-index:999;left:14px;bottom:23px;background:rgba(255,255,255,.93);border:1px solid rgba(255,255,255,.98);box-shadow:0 8px 22px rgba(57,74,105,.14);border-radius:14px;padding:8px 11px;color:#52617c;font-size:9px;font-weight:800;pointer-events:none}.map-badge b{color:#15213a}
  </style></head><body><div id="map"></div><div class="map-badge"><b>Interactive map</b> · drag · zoom · tap stops</div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script>
  const pts=${data};
  const map=L.map('map',{zoomControl:true,attributionControl:true,preferCanvas:true,scrollWheelZoom:true,doubleClickZoom:true,dragging:true,touchZoom:true});
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(map);
  const ll=[];
  pts.forEach(p=>{
    const icon=L.divIcon({className:'',html:'<div class="trava-pin '+(p.selected?'sel':'')+'"><div class="pin-tail"></div><div class="pin-dot">'+p.order+'</div></div>',iconSize:[40,46],iconAnchor:[20,42],popupAnchor:[0,-37]});
    const m=L.marker([p.latitude,p.longitude],{icon,riseOnHover:true}).addTo(map);
    m.bindPopup('<div class="tt">'+esc(p.title)+'</div><div class="pl">'+esc(p.locationName)+'</div><div class="cat">'+esc(p.category)+'</div>');
    m.on('click',()=>parent.postMessage({type:'trava-select',id:p.id},'*'));
    if(p.selected) setTimeout(()=>m.openPopup(),80);
    ll.push([p.latitude,p.longitude]);
  });
  if(ll.length>1){L.polyline(ll,{color:'#ffffff',weight:7,opacity:.88,lineCap:'round',lineJoin:'round'}).addTo(map);L.polyline(ll,{color:'#75afea',weight:3.5,opacity:.95,lineCap:'round',lineJoin:'round'}).addTo(map)}
  if(ll.length===1) map.setView(ll[0],13); else if(ll.length>1) map.fitBounds(L.latLngBounds(ll).pad(.23),{maxZoom:13}); else map.setView([35.6812,139.7671],11);
  function esc(s){return String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
  </script></body></html>`;
}

const styles = StyleSheet.create({
  wrap: { overflow: "hidden", borderRadius: 27, borderWidth: 1, borderColor: "#E6EEF8", backgroundColor: "#EEF7FF", boxShadow: "0 16px 34px rgba(68,86,110,.10)" },
});
