import { GLOBE_COUNTRIES } from "../data/globe-country-data";

const GLOBE_HTML_TEMPLATE = String.raw`<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no" />
<style>
  html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent;touch-action:none;user-select:none;-webkit-user-select:none}
  #root{position:relative;width:100%;height:100%;overflow:hidden;background:
    radial-gradient(circle at 18% 22%,rgba(191,221,255,.92),rgba(191,221,255,0) 34%),
    radial-gradient(circle at 84% 42%,rgba(255,205,229,.78),rgba(255,205,229,0) 40%),
    linear-gradient(135deg,#eaf4ff 0%,#f1efff 52%,#fdebf4 100%)}
  canvas{display:block;width:100%;height:100%;touch-action:none}
  #status{position:absolute;left:12px;bottom:10px;padding:6px 10px;border-radius:999px;background:rgba(255,255,255,.78);border:1px solid rgba(111,88,202,.13);box-shadow:0 10px 26px rgba(78,68,133,.08);color:#625a83;font:700 10px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;pointer-events:none;opacity:0;transition:opacity .2s;backdrop-filter:blur(12px)}
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
  var sparkles=[];
  var routeColors=["#ffffff","#ffb8d5","#b9a8ff","#95cfff","#d9b9ff"];
  var visitedFills=["rgba(255,174,207,.78)","rgba(203,167,255,.76)","rgba(155,204,255,.78)","rgba(246,194,225,.76)","rgba(189,183,255,.76)"];

  function clamp(value,min,max){return Math.max(min,Math.min(max,value));}
  function radians(value){return value*Math.PI/180;}
  function normalizeLon(value){while(value>180)value-=360;while(value<-180)value+=360;return value;}
  function shortestLonDelta(from,to){return normalizeLon(to-from);}
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
  function radius(){return Math.min(width,height)*0.43*zoom;}
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
  function hashCode(value){
    var hash=0;
    for(var i=0;i<value.length;i++)hash=((hash<<5)-hash)+value.charCodeAt(i);
    return Math.abs(hash);
  }

  function makeSparkles(){
    sparkles=[];
    var seed=28741;
    function random(){seed=(seed*16807)%2147483647;return (seed-1)/2147483646;}
    for(var i=0;i<54;i++)sparkles.push({x:random(),y:random(),r:.45+random()*1.3,a:.12+random()*.36});
  }

  function resize(){
    var rect=canvas.getBoundingClientRect();
    width=Math.max(1,rect.width);height=Math.max(1,rect.height);dpr=Math.min(2,window.devicePixelRatio||1);
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    makeSparkles();
  }

  function softBlob(x,y,r,color){
    var g=ctx.createRadialGradient(x,y,0,x,y,r);
    g.addColorStop(0,color);
    g.addColorStop(1,"rgba(255,255,255,0)");
    ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);
  }

  function drawAtmosphere(){
    var background=ctx.createLinearGradient(0,0,width,height);
    background.addColorStop(0,"#e8f3ff");
    background.addColorStop(.52,"#f1efff");
    background.addColorStop(1,"#fdebf4");
    ctx.fillStyle=background;ctx.fillRect(0,0,width,height);

    softBlob(width*.14,height*.26,Math.max(width,height)*.32,"rgba(164,209,255,.45)");
    softBlob(width*.86,height*.42,Math.max(width,height)*.34,"rgba(255,186,218,.38)");
    softBlob(width*.54,height*.09,Math.max(width,height)*.24,"rgba(255,255,255,.72)");

    ctx.save();
    for(var i=0;i<sparkles.length;i++){
      var s=sparkles[i];
      ctx.beginPath();ctx.arc(s.x*width,s.y*height,s.r,0,Math.PI*2);
      ctx.fillStyle="rgba(255,255,255,"+s.a+")";ctx.fill();
    }
    ctx.restore();

    ctx.save();
    var cloudY=height*.79;
    var cloudColor="rgba(255,255,255,.28)";
    ctx.fillStyle=cloudColor;
    var clouds=[[-.02,.80,.20],[.10,.83,.14],[.22,.79,.17],[.80,.82,.18],[.93,.78,.22],[1.05,.84,.17]];
    for(var c=0;c<clouds.length;c++){
      ctx.beginPath();ctx.arc(width*clouds[c][0],cloudY+(clouds[c][1]-.8)*height,width*clouds[c][2],0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
  }

  function drawOrbitRings(rad){
    ctx.save();
    ctx.translate(width/2,height/2);
    ctx.strokeStyle="rgba(255,255,255,.46)";
    ctx.lineWidth=.9;
    ctx.beginPath();ctx.ellipse(0,0,rad*1.34,rad*.52,-.16,0,Math.PI*2);ctx.stroke();
    ctx.strokeStyle="rgba(143,126,224,.12)";
    ctx.beginPath();ctx.ellipse(0,0,rad*1.46,rad*.72,.22,0,Math.PI*2);ctx.stroke();
    ctx.restore();
  }

  function drawGraticule(){
    ctx.save();ctx.strokeStyle="rgba(255,255,255,.28)";ctx.lineWidth=.65;
    for(var lat=-60;lat<=60;lat+=30){
      ctx.beginPath();var started=false;
      for(var lon=-180;lon<=180;lon+=4){
        var p=projectLatLng(lat,lon);
        if(p.z>0){if(!started){ctx.moveTo(p.x,p.y);started=true;}else ctx.lineTo(p.x,p.y);}else started=false;
      }
      ctx.stroke();
    }
    for(var lon2=-150;lon2<=180;lon2+=30){
      ctx.beginPath();var started2=false;
      for(var lat2=-88;lat2<=88;lat2+=3){
        var q=projectLatLng(lat2,lon2);
        if(q.z>0){if(!started2){ctx.moveTo(q.x,q.y);started2=true;}else ctx.lineTo(q.x,q.y);}else started2=false;
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function traceCountryPath(path){
    ctx.beginPath();
    var previous=null,started=false,points=0;
    for(var j=0;j<path.length;j++){
      var p=projectLatLng(path[j][1],path[j][0]);
      var visible=p.z>.015;
      var jump=previous&&Math.hypot(p.x-previous.x,p.y-previous.y)>radius()*.36;
      if(visible&&!jump){
        if(!started){ctx.moveTo(p.x,p.y);started=true;}else ctx.lineTo(p.x,p.y);
        points+=1;
      }else if(started){
        started=false;
      }
      previous=p;
    }
    return points;
  }

  function drawCountries(){
    ctx.save();ctx.lineJoin="round";ctx.lineCap="round";
    for(var i=0;i<COUNTRIES.length;i++){
      var country=COUNTRIES[i];
      if(!country.paths||!country.paths.length)continue;
      var active=visited.has(country.code);
      var fill=active?visitedFills[hashCode(country.code)%visitedFills.length]:"rgba(230,237,255,.22)";
      ctx.strokeStyle=active?"rgba(255,255,255,.98)":"rgba(247,250,255,.72)";
      ctx.lineWidth=active?1.15:.62;
      for(var r=0;r<country.paths.length;r++){
        var points=traceCountryPath(country.paths[r]);
        if(points>2){
          ctx.closePath();
          ctx.fillStyle=fill;
          ctx.fill();
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  }

  function drawRoute(route,index,time){
    var a=vectorFromLatLng(route.originLat,route.originLng);
    var b=vectorFromLatLng(route.destinationLat,route.destinationLng);
    var color=routeColors[index%routeColors.length];
    ctx.save();
    ctx.strokeStyle=color;ctx.lineWidth=1.75;ctx.shadowColor=color;ctx.shadowBlur=9;ctx.beginPath();
    var started=false;
    for(var i=0;i<=76;i++){
      var t=i/76;var lift=1+.17*Math.sin(Math.PI*t);var p=projectVector(slerp(a,b,t),lift);
      if(p.z>-.08){if(!started){ctx.moveTo(p.x,p.y);started=true;}else ctx.lineTo(p.x,p.y);}else started=false;
    }
    ctx.stroke();ctx.shadowBlur=0;
    var progress=((time/2700)+(index*.16))%1;
    var moving=projectVector(slerp(a,b,progress),1+.17*Math.sin(Math.PI*progress));
    if(moving.z>-.05){
      ctx.beginPath();ctx.arc(moving.x,moving.y,3.1,0,Math.PI*2);
      ctx.fillStyle="#ffffff";ctx.shadowColor=color;ctx.shadowBlur=13;ctx.fill();
    }
    ctx.restore();
  }

  function drawMarker(lat,lng,color){
    var p=projectLatLng(lat,lng,1.02);if(p.z<=0)return;
    ctx.save();
    ctx.beginPath();ctx.arc(p.x,p.y,6.3,0,Math.PI*2);ctx.fillStyle="rgba(255,255,255,.92)";ctx.shadowColor=color;ctx.shadowBlur=14;ctx.fill();
    ctx.shadowBlur=0;ctx.beginPath();ctx.arc(p.x,p.y,3.1,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();
    ctx.beginPath();ctx.arc(p.x,p.y,1.25,0,Math.PI*2);ctx.fillStyle="#ffffff";ctx.fill();
    ctx.restore();
  }

  function draw(time){
    ctx.clearRect(0,0,width,height);
    drawAtmosphere();
    var rad=radius();
    drawOrbitRings(rad);

    ctx.save();
    ctx.beginPath();ctx.arc(width/2,height/2,rad+8,0,Math.PI*2);
    ctx.shadowColor="rgba(121,112,202,.24)";ctx.shadowBlur=30;
    ctx.fillStyle="rgba(255,255,255,.10)";ctx.fill();
    ctx.restore();

    var gradient=ctx.createRadialGradient(width/2-rad*.38,height/2-rad*.40,rad*.04,width/2,height/2,rad*1.15);
    gradient.addColorStop(0,"#f9fcff");
    gradient.addColorStop(.22,"#dcecff");
    gradient.addColorStop(.55,"#b9d4f5");
    gradient.addColorStop(.82,"#9ebbe8");
    gradient.addColorStop(1,"#879fd2");

    ctx.save();
    ctx.beginPath();ctx.arc(width/2,height/2,rad,0,Math.PI*2);ctx.clip();
    ctx.fillStyle=gradient;ctx.fillRect(width/2-rad,height/2-rad,rad*2,rad*2);
    drawGraticule();
    drawCountries();

    var shine=ctx.createRadialGradient(width/2-rad*.36,height/2-rad*.42,0,width/2-rad*.22,height/2-rad*.28,rad*.78);
    shine.addColorStop(0,"rgba(255,255,255,.44)");shine.addColorStop(1,"rgba(255,255,255,0)");
    ctx.fillStyle=shine;ctx.fillRect(width/2-rad,height/2-rad,rad*2,rad*2);
    ctx.restore();

    for(var i=0;i<routes.length;i++)drawRoute(routes[i],i,time);

    var markerMap=new Map();
    routes.forEach(function(route){
      markerMap.set(route.originCode,{lat:route.originLat,lng:route.originLng});
      markerMap.set(route.destinationCode,{lat:route.destinationLat,lng:route.destinationLng});
    });
    var markerIndex=0;
    markerMap.forEach(function(point){drawMarker(point.lat,point.lng,routeColors[markerIndex++%routeColors.length]);});

    ctx.save();
    ctx.beginPath();ctx.arc(width/2,height/2,rad+1.5,0,Math.PI*2);
    ctx.strokeStyle="rgba(255,255,255,.88)";ctx.lineWidth=2;
    ctx.shadowColor="rgba(135,122,219,.34)";ctx.shadowBlur=17;ctx.stroke();
    ctx.restore();
  }

  function tick(time){
    if(focusAnimation){
      var elapsed=Date.now()-focusAnimation.started;
      var t=clamp(elapsed/focusAnimation.duration,0,1);
      var eased=1-Math.pow(1-t,3);
      viewLat=focusAnimation.fromLat+(focusAnimation.toLat-focusAnimation.fromLat)*eased;
      viewLon=normalizeLon(focusAnimation.fromLon+focusAnimation.deltaLon*eased);
      if(t>=1)focusAnimation=null;
    }else if(Date.now()-lastInteraction>4500&&pointers.size===0){
      viewLon=normalizeLon(viewLon+.014);
    }
    draw(time||0);requestAnimationFrame(tick);
  }

  function focusCountry(code){
    var country=countryByCode.get(code);if(!country)return;
    focusAnimation={fromLat:viewLat,fromLon:viewLon,toLat:clamp(country.lat,-78,78),deltaLon:shortestLonDelta(viewLon,country.lng),started:Date.now(),duration:760};
    lastInteraction=Date.now();
  }

  function setRoutes(next){
    routes=Array.isArray(next)?next.filter(function(route){
      return route&&Number.isFinite(route.originLat)&&Number.isFinite(route.originLng)&&Number.isFinite(route.destinationLat)&&Number.isFinite(route.destinationLng);
    }):[];
    visited=new Set();
    routes.forEach(function(route){visited.add(route.originCode);visited.add(route.destinationCode);});
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
    if(!pointers.has(event.pointerId))return;
    var previous=pointers.get(event.pointerId);
    pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(pointers.size===1){viewLon=normalizeLon(viewLon-(event.clientX-previous.x)*.34/zoom);viewLat=clamp(viewLat+(event.clientY-previous.y)*.24/zoom,-78,78);focusAnimation=null;}
    if(pointers.size===2){var points=Array.from(pointers.values());var distance=Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y);if(!pinchStart)pinchStart={distance:distance,zoom:zoom};else zoom=clamp(pinchStart.zoom*(distance/pinchStart.distance),.72,2.15);}
    lastInteraction=Date.now();
  });
  function releasePointer(event){pointers.delete(event.pointerId);if(pointers.size<2)pinchStart=null;if(pointers.size===0)setTimeout(function(){status.classList.remove("show");},700);lastInteraction=Date.now();}
  canvas.addEventListener("pointerup",releasePointer);
  canvas.addEventListener("pointercancel",releasePointer);
  canvas.addEventListener("wheel",function(event){event.preventDefault();zoom=clamp(zoom-event.deltaY*.0012,.72,2.15);lastInteraction=Date.now();},{passive:false});
  window.addEventListener("resize",resize);
  resize();requestAnimationFrame(tick);
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
