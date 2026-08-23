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

  return <View style={[styles.wrap, { height }]}>
    {createElement("iframe", {
      ref: frameRef as never,
      title: "Interactive TRAVA itinerary map",
      srcDoc: html,
      sandbox: "allow-scripts",
      style: { width: "100%", height: "100%", border: 0, display: "block", background: "#EDF7FF" },
    })}
  </View>;
}

function makeMapHtml(activities: TripMapSurfaceProps["activities"], selected: string | null | undefined) {
  const points = activities
    .filter((a) => Number.isFinite(a.latitude) && Number.isFinite(a.longitude))
    .map((a, index) => ({ ...a, order: index + 1, selected: a.id === selected }));
  const data = JSON.stringify(points).replace(/</g, "\\u003c");

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
  <style>
  *{box-sizing:border-box}html,body,#map{width:100%;height:100%;margin:0}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#edf7ff;overflow:hidden}
  .leaflet-container{background:#eaf5ff;cursor:grab}.leaflet-container:active{cursor:grabbing}.leaflet-tile{filter:saturate(.9) brightness(1.035) contrast(.94)}
  .leaflet-control-zoom{border:0!important;border-radius:15px!important;overflow:hidden;box-shadow:0 8px 22px rgba(55,78,113,.18)!important;margin:14px!important}
  .leaflet-control-zoom a{width:40px!important;height:40px!important;line-height:40px!important;border:0!important;background:rgba(255,255,255,.96)!important;color:#17223c!important;font-size:20px!important}.leaflet-control-zoom a+a{border-top:1px solid #edf1f7!important}
  .leaflet-control-attribution{font-size:8px!important;background:rgba(255,255,255,.84)!important;color:#6d7990!important;padding:2px 6px!important}.leaflet-control-attribution a{color:#567dab!important}
  .trava-pin{position:relative;width:38px;height:44px;display:flex;align-items:flex-start;justify-content:center;filter:drop-shadow(0 7px 9px rgba(63,84,122,.25))}.pin-dot{width:34px;height:34px;border-radius:17px;background:linear-gradient(135deg,#69ace9,#8d9be8 55%,#e98fb7);border:3px solid white;display:flex;align-items:center;justify-content:center;color:white;font-size:11px;font-weight:900}.pin-tail{position:absolute;top:29px;width:10px;height:10px;background:#8d9be8;transform:rotate(45deg);border-right:2px solid white;border-bottom:2px solid white}.trava-pin.sel .pin-dot{width:39px;height:39px;border-radius:20px;background:linear-gradient(135deg,#5d9fe0,#8798e7,#e784af);box-shadow:0 0 0 7px rgba(111,164,224,.19)}.trava-pin.sel .pin-tail{top:34px;background:#8798e7}
  .leaflet-popup-content-wrapper{border-radius:18px;box-shadow:0 14px 34px rgba(66,79,111,.18);border:1px solid rgba(255,255,255,.95)}.leaflet-popup-content{margin:12px 14px;min-width:155px}.tt{font-weight:850;color:#101a35;font-size:13px}.pl{color:#6e7995;font-size:10px;line-height:14px;margin-top:4px}.cat{display:inline-block;margin-top:7px;padding:4px 7px;border-radius:9px;background:#edf6ff;color:#5477a5;font-size:8px;font-weight:800;text-transform:capitalize}
  .map-badge{position:absolute;z-index:999;left:14px;bottom:16px;background:rgba(255,255,255,.94);border:1px solid rgba(255,255,255,.98);box-shadow:0 8px 22px rgba(57,74,105,.14);border-radius:14px;padding:8px 11px;color:#52617c;font-size:9px;font-weight:800;pointer-events:none}.map-badge b{color:#15213a}
  .reset{position:absolute;z-index:999;right:14px;top:14px;border:0;border-radius:13px;padding:9px 11px;background:rgba(255,255,255,.96);box-shadow:0 8px 20px rgba(57,74,105,.14);color:#476990;font:800 9px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;cursor:pointer}
  </style></head><body><div id="map"></div><button class="reset" id="reset">Fit local stops</button><div class="map-badge"><b>Live map</b> · drag · zoom · tap stops</div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script>
  const pts=${data};
  const map=L.map('map',{zoomControl:true,attributionControl:true,preferCanvas:true,scrollWheelZoom:true,doubleClickZoom:true,dragging:true,touchZoom:true,minZoom:2});
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(map);
  const local=pts.filter(p=>p.category!=='flight');
  const focus=local.length?local:pts;
  const localLL=[];
  pts.forEach(p=>{
    const icon=L.divIcon({className:'',html:'<div class="trava-pin '+(p.selected?'sel':'')+'"><div class="pin-tail"></div><div class="pin-dot">'+p.order+'</div></div>',iconSize:[40,46],iconAnchor:[20,42],popupAnchor:[0,-37]});
    const m=L.marker([p.latitude,p.longitude],{icon,riseOnHover:true}).addTo(map);
    m.bindPopup('<div class="tt">'+esc(p.title)+'</div><div class="pl">'+esc(p.locationName)+'</div><div class="cat">'+esc(p.category)+'</div>');
    m.on('click',()=>parent.postMessage({type:'trava-select',id:p.id},'*'));
    if(p.selected) setTimeout(()=>m.openPopup(),100);
    if(p.category!=='flight') localLL.push([p.latitude,p.longitude]);
  });
  if(localLL.length>1){L.polyline(localLL,{color:'#ffffff',weight:7,opacity:.9,lineCap:'round',lineJoin:'round'}).addTo(map);L.polyline(localLL,{color:'#70a8df',weight:3.5,opacity:.98,lineCap:'round',lineJoin:'round',dashArray:'8 6'}).addTo(map)}
  function fit(){const chosen=(focus.length?focus:pts).map(p=>[p.latitude,p.longitude]);if(chosen.length===1){map.setView(chosen[0],13)}else if(chosen.length>1){map.fitBounds(L.latLngBounds(chosen).pad(.22),{maxZoom:13})}else{map.setView([35.6762,139.6503],11)}}
  fit();document.getElementById('reset').onclick=fit;
  const selectedPt=pts.find(p=>p.selected&&p.category!=='flight');if(selectedPt){map.setView([selectedPt.latitude,selectedPt.longitude],Math.max(map.getZoom(),13),{animate:true})}
  setTimeout(()=>map.invalidateSize(),80);
  function esc(s){return String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
  </script></body></html>`;
}

const styles = StyleSheet.create({
  wrap: { overflow: "hidden", borderRadius: 27, borderWidth: 1, borderColor: "#DCE9F5", backgroundColor: "#EDF7FF", boxShadow: "0 16px 34px rgba(68,86,110,.11)" },
});
