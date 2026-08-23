import { GLOBE_COUNTRIES } from "../data/globe-country-data";

const GLOBE_HTML_TEMPLATE = String.raw`<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no" />
<style>
  html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent;touch-action:none;user-select:none;-webkit-user-select:none}
  #root{position:relative;width:100%;height:100%;overflow:hidden;background:radial-gradient(circle at 50% 48%,rgba(125,105,244,.22),rgba(14,18,48,.03) 48%,rgba(7,10,31,.18) 100%)}
  canvas{display:block;width:100%;height:100%;touch-action:none}
  #status{position:absolute;left:12px;bottom:10px;padding:5px 9px;border-radius:999px;background:rgba(10,14,39,.48);border:1px solid rgba(255,255,255,.16);color:rgba(255,255,255,.86);font:600 11px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;pointer-events:none;opacity:0;transition:opacity .2s}
  #status.show{opacity:1}
</style>
</head>
<body>
<div id="root"><canvas id="globe" aria-label="Interactive three-dimensional travel globe"></canvas><div id="status">Drag to rotate • Pinch or scroll to zoom</div></div>
<script>
(function(){
  "use strict";
  var COUNTRIES=__COUNTRY_DATA__;
  var countryByCode=new Map(COUNTRIES.map(function(c){return [c.code,c];}));
  var canvas=document.getElementById("globe");
  var ctx=canvas.getContext("2d",{alpha:true});
  var status=document.getElementById("status");
  var routes=[];
  var visited=new Set();
  var viewLat=18;
  var viewLon=20;
  var zoom=1;
  var width=1;
  var height=1;
  var dpr=1;
  var lastInteraction=Date.now();
  var focusAnimation=null;
  var pointers=new Map();
  var pinchStart=null;
  var stars=[];
  var routeColors=["#ffffff","#ffd6f1","#d5d0ff","#c4f1ff","#f7e3ff"];

  function clamp(value,min,max){return Math.max(min,Math.min(max,value));}
  function radians(value){return value*Math.PI/180;}
  function normalizeLon(value){while(value>180)value-=360;while(value<-180)value+=360;return value;}
  function shortestLonDelta(from,to){var delta=normalizeLon(to-from);return delta;}
  function vectorFromLatLng(lat,lng){
    var p=radians(lat),l=radians(lng),cp=Math.cos(p);
    return [cp*Math.sin(l),Math.sin(p),cp*Math.cos(l)];
  }
  function rotateVector(v){
    var yaw=radians(-viewLon),cy=Math.cos(yaw),sy=Math.sin(yaw);
    var x1=v[0]*cy+v[2]*sy;
    var y1=v[1];
    var z1=-v[0]*sy+v[2]*cy;
    var pitch=radians(viewLat),cp=Math.cos(pitch),sp=Math.sin(pitch);
    return [x1,y1*cp-z1*sp,y1*sp+z1*cp];
  }
  function radius(){return Math.min(width,height)*0.365*zoom;}
  function projectVector(v,scale){
    var r=rotateVector(v),rad=radius()*(scale||1);
    return {x:width/2+r[0]*rad,y:height/2-r[1]*rad,z:r[2]};
  }
  function projectLatLng(lat,lng,scale){return projectVector(vectorFromLatLng(lat,lng),scale);}
  function slerp(a,b,t){
    var dot=clamp(a[0]*b[0]+a[1]*b[1]+a[2]*b[2],-1,1);
    var omega=Math.acos(dot);
    if(omega<0.00001){return [a[0],a[1],a[2]];}
    var sinOmega=Math.sin(omega);
    var s1=Math.sin((1-t)*omega)/sinOmega;
    var s2=Math.sin(t*omega)/sinOmega;
    return [a[0]*s1+b[0]*s2,a[1]*s1+b[1]*s2,a[2]*s1+b[2]*s2];
  }
  function makeStars(){
    stars=[];
    var seed=28741;
    function random(){seed=(seed*16807)%2147483647;return (seed-1)/2147483646;}
    for(var i=0;i<85;i++)stars.push({x:random(),y:random(),r:.4+random()*1.3,a:.12+random()*.45});
  }
  function resize(){
    var rect=canvas.getBoundingClientRect();
    width=Math.max(1,rect.width);height=Math.max(1,rect.height);dpr=Math.min(2,window.devicePixelRatio||1);
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    makeStars();
  }
  function drawStars(){
    ctx.save();
    for(var i=0;i<stars.length;i++){
      var s=stars[i];ctx.beginPath();ctx.arc(s.x*width,s.y*height,s.r,0,Math.PI*2);ctx.fillStyle="rgba(255,255,255,"+s.a+")";ctx.fill();
    }
    ctx.restore();
  }
  function drawGraticule(rad){
    ctx.save();ctx.strokeStyle="rgba(255,255,255,.11)";ctx.lineWidth=.7;
    for(var lat=-60;lat<=60;lat+=30){
      ctx.beginPath();var started=false;
      for(var lon=-180;lon<=180;lon+=4){var p=projectLatLng(lat,lon);if(p.z>0){if(!started){ctx.moveTo(p.x,p.y);started=true;}else ctx.lineTo(p.x,p.y);}else started=false;}ctx.stroke();
    }
    for(var lon2=-150;lon2<=180;lon2+=30){
      ctx.beginPath();var started2=false;
      for(var lat2=-88;lat2<=88;lat2+=3){var q=projectLatLng(lat2,lon2);if(q.z>0){if(!started2){ctx.moveTo(q.x,q.y);started2=true;}else ctx.lineTo(q.x,q.y);}else started2=false;}ctx.stroke();
    }
    ctx.restore();
  }
  function drawCountries(){
    ctx.save();ctx.lineJoin="round";ctx.lineCap="round";
    for(var i=0;i<COUNTRIES.length;i++){
      var country=COUNTRIES[i];
      if(!country.paths||!country.paths.length)continue;
      var active=visited.has(country.code);
      ctx.strokeStyle=active?"rgba(255,255,255,.96)":"rgba(245,246,255,.58)";
      ctx.lineWidth=active?1.55:.65;
      for(var r=0;r<country.paths.length;r++){
        var path=country.paths[r];ctx.beginPath();var previous=null;var started=false;
        for(var j=0;j<path.length;j++){
          var p=projectLatLng(path[j][1],path[j][0]);
          var visible=p.z>.015;
          var jump=previous&&Math.hypot(p.x-previous.x,p.y-previous.y)>radius()*.36;
          if(visible&&!jump){if(!started){ctx.moveTo(p.x,p.y);started=true;}else ctx.lineTo(p.x,p.y);}else started=false;
          previous=p;
        }
        ctx.stroke();
      }
    }
    ctx.restore();
  }
  function drawRoute(route,index,time){
    var a=vectorFromLatLng(route.originLat,route.originLng);
    var b=vectorFromLatLng(route.destinationLat,route.destinationLng);
    var color=routeColors[index%routeColors.length];
    ctx.save();ctx.strokeStyle=color;ctx.lineWidth=1.6;ctx.shadowColor=color;ctx.shadowBlur=7;ctx.beginPath();
    var started=false;
    for(var i=0;i<=72;i++){
      var t=i/72;var lift=1+.19*Math.sin(Math.PI*t);var p=projectVector(slerp(a,b,t),lift);
      if(p.z>-.08){if(!started){ctx.moveTo(p.x,p.y);started=true;}else ctx.lineTo(p.x,p.y);}else started=false;
    }
    ctx.stroke();ctx.shadowBlur=0;
    var progress=((time/2600)+(index*.19))%1;var moving=projectVector(slerp(a,b,progress),1+.19*Math.sin(Math.PI*progress));
    if(moving.z>-.05){ctx.beginPath();ctx.arc(moving.x,moving.y,3.2,0,Math.PI*2);ctx.fillStyle="#ffffff";ctx.shadowColor=color;ctx.shadowBlur=12;ctx.fill();}
    ctx.restore();
  }
  function drawMarker(lat,lng,label,color){
    var p=projectLatLng(lat,lng,1.025);if(p.z<=0)return;
    ctx.save();ctx.beginPath();ctx.arc(p.x,p.y,5.1,0,Math.PI*2);ctx.fillStyle=color;ctx.shadowColor=color;ctx.shadowBlur=11;ctx.fill();ctx.beginPath();ctx.arc(p.x,p.y,2.1,0,Math.PI*2);ctx.fillStyle="#ffffff";ctx.fill();ctx.restore();
  }
  function draw(time){
    ctx.clearRect(0,0,width,height);drawStars();
    var rad=radius();var gradient=ctx.createRadialGradient(width/2-rad*.34,height/2-rad*.38,rad*.06,width/2,height/2,rad*1.15);
    gradient.addColorStop(0,"#c6c7ff");gradient.addColorStop(.3,"#918af8");gradient.addColorStop(.72,"#665bdd");gradient.addColorStop(1,"#30277f");
    ctx.save();ctx.beginPath();ctx.arc(width/2,height/2,rad,0,Math.PI*2);ctx.clip();ctx.fillStyle=gradient;ctx.fillRect(width/2-rad,height/2-rad,rad*2,rad*2);drawGraticule(rad);drawCountries();ctx.restore();
    for(var i=0;i<routes.length;i++)drawRoute(routes[i],i,time);
    var markerMap=new Map();
    routes.forEach(function(route){markerMap.set(route.originCode,{lat:route.originLat,lng:route.originLng,label:route.originName});markerMap.set(route.destinationCode,{lat:route.destinationLat,lng:route.destinationLng,label:route.destinationName});});
    var markerIndex=0;markerMap.forEach(function(point){drawMarker(point.lat,point.lng,point.label,routeColors[markerIndex++%routeColors.length]);});
    ctx.save();ctx.beginPath();ctx.arc(width/2,height/2,rad+2,0,Math.PI*2);ctx.strokeStyle="rgba(255,255,255,.55)";ctx.lineWidth=2;ctx.shadowColor="rgba(203,198,255,.8)";ctx.shadowBlur=18;ctx.stroke();ctx.restore();
  }
  function tick(time){
    if(focusAnimation){
      var elapsed=Date.now()-focusAnimation.started;var t=clamp(elapsed/focusAnimation.duration,0,1);var eased=1-Math.pow(1-t,3);
      viewLat=focusAnimation.fromLat+(focusAnimation.toLat-focusAnimation.fromLat)*eased;
      viewLon=normalizeLon(focusAnimation.fromLon+focusAnimation.deltaLon*eased);
      if(t>=1)focusAnimation=null;
    }else if(Date.now()-lastInteraction>4500&&pointers.size===0){viewLon=normalizeLon(viewLon+.018);}
    draw(time||0);requestAnimationFrame(tick);
  }
  function focusCountry(code){
    var country=countryByCode.get(code);if(!country)return;
    focusAnimation={fromLat:viewLat,fromLon:viewLon,toLat:clamp(country.lat,-78,78),deltaLon:shortestLonDelta(viewLon,country.lng),started:Date.now(),duration:760};
    lastInteraction=Date.now();
  }
  function setRoutes(next){
    routes=Array.isArray(next)?next.filter(function(route){return route&&Number.isFinite(route.originLat)&&Number.isFinite(route.originLng)&&Number.isFinite(route.destinationLat)&&Number.isFinite(route.destinationLng);}):[];
    visited=new Set();routes.forEach(function(route){visited.add(route.originCode);visited.add(route.destinationCode);});
  }
  function receive(message){
    if(!message||typeof message!=="object")return;
    if(message.type==="state"){setRoutes(message.routes);if(message.focusCode)focusCountry(message.focusCode);return;}
    if(message.type==="zoom-in"){zoom=clamp(zoom+.14,.72,2.15);lastInteraction=Date.now();return;}
    if(message.type==="zoom-out"){zoom=clamp(zoom-.14,.72,2.15);lastInteraction=Date.now();return;}
    if(message.type==="reset"){viewLat=18;viewLon=20;zoom=1;focusAnimation=null;lastInteraction=Date.now();return;}
    if(message.type==="focus"&&message.countryCode)focusCountry(message.countryCode);
  }
  window.TRAVA_GLOBE={receive:receive};
  window.addEventListener("message",function(event){var data=event.data;try{if(typeof data==="string")data=JSON.parse(data);}catch(_error){}receive(data);});
  document.addEventListener("message",function(event){var data=event.data;try{if(typeof data==="string")data=JSON.parse(data);}catch(_error){}receive(data);});
  canvas.addEventListener("pointerdown",function(event){canvas.setPointerCapture(event.pointerId);pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});lastInteraction=Date.now();status.classList.add("show");});
  canvas.addEventListener("pointermove",function(event){
    if(!pointers.has(event.pointerId))return;var previous=pointers.get(event.pointerId);pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(pointers.size===1){viewLon=normalizeLon(viewLon-(event.clientX-previous.x)*.34/zoom);viewLat=clamp(viewLat+(event.clientY-previous.y)*.24/zoom,-78,78);focusAnimation=null;}
    if(pointers.size===2){var points=Array.from(pointers.values());var distance=Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y);if(!pinchStart)pinchStart={distance:distance,zoom:zoom};else zoom=clamp(pinchStart.zoom*(distance/pinchStart.distance),.72,2.15);}
    lastInteraction=Date.now();
  });
  function releasePointer(event){pointers.delete(event.pointerId);if(pointers.size<2)pinchStart=null;if(pointers.size===0)setTimeout(function(){status.classList.remove("show");},700);lastInteraction=Date.now();}
  canvas.addEventListener("pointerup",releasePointer);canvas.addEventListener("pointercancel",releasePointer);
  canvas.addEventListener("wheel",function(event){event.preventDefault();zoom=clamp(zoom-event.deltaY*.0012,.72,2.15);lastInteraction=Date.now();},{passive:false});
  window.addEventListener("resize",resize);resize();requestAnimationFrame(tick);
  var ready={type:"ready"};
  try{if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify(ready));}catch(_error){}
  try{if(window.parent&&window.parent!==window)window.parent.postMessage(ready,"*");}catch(_error){}
})();
</script>
</body>
</html>`;

export function createTravelGlobeHtml(): string {
  return GLOBE_HTML_TEMPLATE.replace(
    "__COUNTRY_DATA__",
    JSON.stringify(GLOBE_COUNTRIES),
  );
}
