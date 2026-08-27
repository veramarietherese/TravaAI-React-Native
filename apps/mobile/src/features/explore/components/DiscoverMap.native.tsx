import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import type { DiscoverMapProps } from "./DiscoverMap.types";
export type { DiscoverPlace } from "./DiscoverMap.types";

export function DiscoverMap({
  places,
  selectedId,
  center,
  onSelect,
  onMapPress,
}: DiscoverMapProps) {
  const html = useMemo(
    () => makeHtml(places, selectedId, center),
    [center, places, selectedId],
  );

  return (
    <View style={styles.wrap}>
      <WebView
        originWhitelist={["*"]}
        source={{ html }}
        javaScriptEnabled
        domStorageEnabled
        geolocationEnabled
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data) as {
              type?: string;
              id?: string;
              latitude?: number;
              longitude?: number;
            };

            if (data.type === "trava-discover-select" && data.id) {
              onSelect(data.id);
            }

            if (
              data.type === "trava-discover-map-press" &&
              typeof data.latitude === "number" &&
              typeof data.longitude === "number"
            ) {
              onMapPress?.({
                latitude: data.latitude,
                longitude: data.longitude,
              });
            }
          } catch {
            // Ignore unrelated WebView messages.
          }
        }}
        style={styles.web}
      />
    </View>
  );
}

function makeHtml(
  places: DiscoverMapProps["places"],
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
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>
*{box-sizing:border-box}
html,body,#map{width:100%;height:100%;margin:0}
body{overflow:hidden;background:#dff4ff;font-family:-apple-system,BlinkMacSystemFont,sans-serif}
.leaflet-container{background:#dff4ff}
.leaflet-tile{filter:saturate(1.16) brightness(1.08) contrast(.88);opacity:.98}
.leaflet-control-zoom,.leaflet-control-attribution{display:none}

.pin{position:relative;width:58px;height:70px;display:flex;justify-content:center;filter:drop-shadow(0 9px 12px rgba(36,63,110,.18))}
.tail{position:absolute;top:45px;width:17px;height:17px;background:#fff;transform:rotate(45deg);border-radius:2px}
.bubble{position:relative;z-index:2;width:54px;height:54px;border-radius:27px;padding:4px;background:#fff}
.bubble img{width:100%;height:100%;object-fit:cover;border-radius:23px}
.pin.sel .bubble{box-shadow:0 0 0 7px rgba(118,91,234,.17);transform:scale(1.06)}

.user{width:46px;height:46px;border-radius:23px;background:rgba(77,135,255,.15);display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 11px rgba(78,136,255,.10)}
.user:after{content:'';width:21px;height:21px;border-radius:50%;background:#4d82ff;border:6px solid #fff}

.locate{position:absolute;right:14px;bottom:14px;z-index:800;width:50px;height:50px;border:0;border-radius:25px;background:#fff;box-shadow:0 8px 18px rgba(37,59,92,.15)}
.locate:before{content:'';position:absolute;left:18px;top:14px;width:14px;height:20px;border-left:4px solid #6d61e6;border-top:4px solid #6d61e6;transform:rotate(45deg);border-radius:2px}
</style>
</head>
<body>
<div id="map"></div>
<button class="locate" id="locate"></button>

<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
const pts=${data};
const requestedCenter=${centerData};
const fallback=requestedCenter?[requestedCenter.latitude,requestedCenter.longitude]:[10.3157,123.8854];
const selected=pts.find(p=>p.selected);

const map=L.map('map',{
  zoomControl:false,
  attributionControl:false,
  dragging:true,
  touchZoom:true,
  minZoom:2
});

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);

const ll=[];
pts.forEach(p=>{
  ll.push([p.latitude,p.longitude]);
  const html='<div class="pin '+(p.selected?'sel':'')+'"><div class="tail"></div><div class="bubble"><img src="'+esc(p.imageUrl)+'"></div></div>';
  const icon=L.divIcon({className:'',html,iconSize:[58,70],iconAnchor:[29,63]});
  const marker=L.marker([p.latitude,p.longitude],{icon}).addTo(map);
  marker.on('click',()=>window.ReactNativeWebView.postMessage(JSON.stringify({
    type:'trava-discover-select',
    id:p.id
  })));
});

let current=fallback;
const userMarker=L.marker(current,{
  icon:L.divIcon({
    className:'',
    html:'<div class="user"></div>',
    iconSize:[46,46],
    iconAnchor:[23,23]
  })
}).addTo(map);

function position(){
  if(selected){
    map.setView([selected.latitude,selected.longitude],14);
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
    ()=>{}
  );
}

map.on('click',e=>window.ReactNativeWebView.postMessage(JSON.stringify({
  type:'trava-discover-map-press',
  latitude:e.latlng.lat,
  longitude:e.latlng.lng
})));

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
    height: 350,
    overflow: "hidden",
    borderRadius: 23,
    borderWidth: 1,
    borderColor: "#D9E8F2",
    backgroundColor: "#DDF4FF",
  },
  web: {
    flex: 1,
    backgroundColor: "#DDF4FF",
  },
});
