import { type PropsWithChildren } from "react";
import { ScrollViewStyleReset } from "expo-router/html";

const TRAVA_LOADER_CSS = String.raw`:root {
  --trava-ink: #11162d;
  --trava-muted: #8587ad;
  --trava-violet: #7555f5;
  --trava-pink: #ef72b0;
  --trava-coral: #ff9c6a;
  --trava-loader-progress: 0%;
}

html.trava-loader-active,
html.trava-loader-active body {
  overflow: hidden !important;
}

#trava-initial-loader {
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  display: grid;
  place-items: center;
  width: 100vw;
  min-height: 100dvh;
  overflow: hidden;
  background:
    radial-gradient(circle at 50% 12%, rgba(255, 224, 211, .82) 0, rgba(255, 224, 211, 0) 35%),
    radial-gradient(circle at 18% 62%, rgba(253, 225, 247, .68) 0, rgba(253, 225, 247, 0) 36%),
    radial-gradient(circle at 82% 68%, rgba(225, 230, 255, .72) 0, rgba(225, 230, 255, 0) 40%),
    linear-gradient(180deg, #fff8ee 0%, #fff4f2 22%, #faf0ff 57%, #eff5ff 100%);
  font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif;
  color: var(--trava-ink);
  opacity: 1;
  visibility: visible;
  transition: opacity .58s cubic-bezier(.22,.61,.36,1), visibility .58s linear;
  animation: travaLoaderFailsafe .5s ease 5s forwards;
}

#trava-initial-loader::before {
  content: "";
  position: absolute;
  inset: -14%;
  pointer-events: none;
  background:
    radial-gradient(circle at 50% 44%, rgba(255,255,255,.56), transparent 32%),
    radial-gradient(circle at 52% 54%, rgba(220,200,255,.18), transparent 46%);
  filter: blur(22px);
}

#trava-initial-loader.trava-loader--leaving {
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
}

.trava-loader-shell {
  position: relative;
  z-index: 2;
  width: min(94vw, 620px);
  max-height: 100dvh;
  padding: clamp(12px, 2.1vh, 22px) 0 clamp(18px, 3vh, 30px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.trava-loader-stage {
  position: relative;
  width: min(91vw, 585px);
  height: min(59vh, 590px);
  min-height: 360px;
  isolation: isolate;
  transform: translateZ(0);
}

.trava-loader-orbit-center {
  position: absolute;
  left: 50%;
  top: 48%;
  width: 1px;
  height: 1px;
  transform: translate(-50%, -50%);
}

.trava-loader-orbit,
.trava-loader-ripple {
  position: absolute;
  left: 50%;
  top: 48%;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  pointer-events: none;
}

.trava-loader-orbit {
  border: 1.5px dashed rgba(255,255,255,.92);
  filter: drop-shadow(0 0 4px rgba(255,255,255,.22));
  opacity: .88;
}

.trava-loader-orbit--1 { width: 34%; aspect-ratio: 1; border-style: solid; opacity: .95; }
.trava-loader-orbit--2 { width: 58%; aspect-ratio: 1; }
.trava-loader-orbit--3 { width: 79%; aspect-ratio: 1; }
.trava-loader-orbit--4 { width: 96%; aspect-ratio: 1; opacity: .72; }

.trava-loader-ripple {
  width: 42%;
  aspect-ratio: 1;
  border: 1.25px solid rgba(255,255,255,.72);
  opacity: 0;
  animation: travaRipple 2.8s cubic-bezier(.2,.65,.2,1) infinite;
}
.trava-loader-ripple--2 { animation-delay: .92s; }
.trava-loader-ripple--3 { animation-delay: 1.84s; }

.trava-loader-star-glow {
  position: absolute;
  left: 50%;
  top: 48%;
  width: 31%;
  aspect-ratio: 1;
  transform: translate(-50%, -50%) scale(.35);
  border-radius: 50%;
  background: rgba(255,255,255,.56);
  box-shadow:
    0 0 0 2px rgba(255,255,255,.68) inset,
    0 0 48px rgba(208,124,255,.23),
    0 0 74px rgba(255,169,129,.18);
  opacity: 0;
  animation: travaStarGlowIn .72s .06s cubic-bezier(.21,.95,.34,1.28) forwards,
             travaGlowBreath 2.9s 1s ease-in-out infinite;
}

.trava-loader-asset {
  position: absolute;
  display: block;
  max-width: none;
  user-select: none;
  -webkit-user-drag: none;
  pointer-events: none;
  opacity: 0;
  transform-origin: 50% 50%;
  filter: drop-shadow(0 13px 16px rgba(111,81,184,.13));
  will-change: transform, opacity, filter;
}

.trava-loader-asset--star {
  left: 40.2%;
  top: 38.5%;
  width: 20%;
  z-index: 8;
  filter: drop-shadow(0 0 16px rgba(237,107,204,.28));
  animation: travaPopStar .72s .08s cubic-bezier(.21,.95,.34,1.32) forwards,
             travaFloatSoft 3.1s .95s ease-in-out infinite;
}

.trava-loader-asset--airplane {
  left: 8%; top: 12%; width: 31%; z-index: 6;
  animation: travaPop .64s .28s cubic-bezier(.2,.95,.36,1.22) forwards,
             travaFloatA 4.2s .95s ease-in-out infinite;
}
.trava-loader-asset--pin {
  left: 42%; top: 1.5%; width: 16%; z-index: 7;
  animation: travaPop .64s .40s cubic-bezier(.2,.95,.36,1.22) forwards,
             travaFloatB 3.7s 1.05s ease-in-out infinite;
}
.trava-loader-asset--calendar {
  right: 6%; top: 15%; width: 20%; z-index: 6;
  animation: travaPop .64s .52s cubic-bezier(.2,.95,.36,1.22) forwards,
             travaFloatA 4s 1.18s ease-in-out infinite;
}
.trava-loader-asset--avatar-female {
  right: -1%; top: 41%; width: 18%; z-index: 8;
  animation: travaPop .64s .64s cubic-bezier(.2,.95,.36,1.22) forwards,
             travaFloatB 3.6s 1.32s ease-in-out infinite;
}
.trava-loader-asset--suitcase {
  right: 4%; bottom: 14%; width: 21%; z-index: 7;
  animation: travaPop .64s .76s cubic-bezier(.2,.95,.36,1.22) forwards,
             travaFloatA 4.1s 1.46s ease-in-out infinite;
}
.trava-loader-avatar-bottom {
  position: absolute;
  left: 50%; bottom: -1.5%;
  width: 17.5%; aspect-ratio: 1;
  transform: translateX(-50%) scale(.58);
  z-index: 10;
  display: grid;
  place-items: center;
  border-radius: 50%;
  opacity: 0;
  background: linear-gradient(145deg, #b8efff, #61bfff);
  border: 2px solid rgba(255,255,255,.94);
  box-shadow: 0 12px 24px rgba(80,150,225,.19), inset 0 0 0 3px rgba(255,255,255,.18);
  animation: travaBottomAvatarIn .64s .88s cubic-bezier(.2,.95,.36,1.22) forwards,
             travaFloatBottom 3.8s 1.55s ease-in-out infinite;
}
.trava-loader-avatar-bottom img {
  width: 92%; height: 92%; object-fit: contain; display: block; transform: translateY(3%);
}
.trava-loader-asset--globe {
  left: 37.3%; bottom: 8%; width: 25%; z-index: 6;
  animation: travaPop .64s 1s cubic-bezier(.2,.95,.36,1.22) forwards,
             travaFloatB 4.5s 1.68s ease-in-out infinite;
}
.trava-loader-asset--ticket {
  left: 5%; bottom: 20%; width: 30%; z-index: 5;
  animation: travaPop .64s 1.12s cubic-bezier(.2,.95,.36,1.22) forwards,
             travaFloatA 4.35s 1.82s ease-in-out infinite;
}
.trava-loader-asset--avatar-male {
  left: -1%; top: 41%; width: 18%; z-index: 8;
  animation: travaPop .64s 1.24s cubic-bezier(.2,.95,.36,1.22) forwards,
             travaFloatB 3.9s 1.96s ease-in-out infinite;
}
.trava-loader-cloud {
  position: absolute;
  pointer-events: none;
  opacity: 0;
  filter: drop-shadow(0 8px 14px rgba(226,187,237,.12));
  animation: travaCloudIn .75s .2s ease forwards, travaCloudDrift 5.8s 1.2s ease-in-out infinite;
}
.trava-loader-cloud--left { width: 10%; left: -1.5%; top: 18%; }
.trava-loader-cloud--right { width: 10%; right: -1%; bottom: 23%; animation-delay: .58s, 1.4s; }

.trava-loader-twinkle {
  position: absolute;
  width: 14px;
  aspect-ratio: 1;
  background: linear-gradient(145deg,#ffb45e,#ff7bae 46%,#765eff 100%);
  clip-path: polygon(50% 0,61% 38%,100% 50%,61% 62%,50% 100%,39% 62%,0 50%,39% 38%);
  opacity: 0;
  animation: travaTwinkleIn .55s 1.05s ease forwards, travaTwinkle 1.8s 1.6s ease-in-out infinite;
}
.trava-loader-twinkle--1 { left: 22%; top: 35%; }
.trava-loader-twinkle--2 { right: 16%; top: 21%; animation-delay: 1.18s, 1.7s; }
.trava-loader-twinkle--3 { left: 32%; bottom: 18%; animation-delay: 1.31s, 1.85s; }
.trava-loader-twinkle--4 { right: 23%; bottom: 38%; width: 9px; animation-delay: 1.42s, 2s; }

.trava-loader-copy {
  position: relative;
  z-index: 20;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  margin-top: clamp(-7px, -1vh, -2px);
  text-align: center;
  opacity: 0;
  transform: translateY(24px);
  animation: travaFadeUp .72s 1.25s cubic-bezier(.21,.76,.35,1) forwards;
}

.trava-loader-brand {
  margin: 0 0 clamp(10px, 1.5vh, 16px);
  padding-left: .46em;
  font-size: clamp(16px, 2.55vw, 24px);
  line-height: 1;
  font-weight: 800;
  letter-spacing: .46em;
  background: linear-gradient(90deg,#7355f6 0%,#765df6 35%,#ed6eaf 72%,#ff996b 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.trava-loader-title {
  margin: 0;
  color: #111528;
  font-size: clamp(34px, 6.4vw, 60px);
  line-height: .99;
  letter-spacing: -.045em;
  font-weight: 900;
}

.trava-loader-title-gradient {
  display: block;
  margin-top: .08em;
  padding: 0 .08em .07em;
  font-size: 1.08em;
  line-height: 1;
  background: linear-gradient(90deg,#6098ff 0%,#9b74ff 35%,#ed72bc 66%,#ff9c5d 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.trava-loader-subtitle {
  margin: clamp(12px, 2vh, 20px) 0 0;
  color: #8d8bb2;
  font-size: clamp(14px, 2.35vw, 21px);
  line-height: 1.35;
  font-weight: 600;
  letter-spacing: -.02em;
}

.trava-loader-progress-wrap {
  position: relative;
  z-index: 20;
  width: min(78vw, 500px);
  height: clamp(58px, 8.5vh, 76px);
  margin-top: clamp(22px, 3.6vh, 36px);
  display: flex;
  align-items: center;
  padding: 0 clamp(19px, 3vw, 28px);
  border-radius: 999px;
  background: #0c0e1a;
  box-shadow: 0 18px 35px rgba(35,25,77,.16), inset 0 1px 0 rgba(255,255,255,.035);
  opacity: 0;
  transform: translateY(22px);
  animation: travaFadeUp .72s 1.48s cubic-bezier(.21,.76,.35,1) forwards;
}

.trava-loader-progress-track {
  position: relative;
  flex: 1;
  height: clamp(11px, 1.7vh, 15px);
  margin-right: clamp(45px, 7vw, 58px);
  overflow: hidden;
  border-radius: 999px;
  background: #1d2032;
  box-shadow: inset 0 1px 3px rgba(0,0,0,.24);
}

.trava-loader-progress-fill {
  width: var(--trava-loader-progress);
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg,#55abff 0%,#876fff 35%,#db6ce2 64%,#ff9d78 100%);
  box-shadow: 0 0 17px rgba(188,105,255,.55), 0 0 11px rgba(255,137,137,.38);
  transition: width 2.5s linear;
  will-change: width;
}

.trava-loader-progress-star {
  position: absolute;
  right: clamp(15px, 2.5vw, 24px);
  width: clamp(28px, 4vw, 38px);
  aspect-ratio: 1;
  background: linear-gradient(145deg,#f258ca,#ff8aa0 55%,#ffb56f);
  clip-path: polygon(50% 0,61% 38%,100% 50%,61% 62%,50% 100%,39% 62%,0 50%,39% 38%);
  filter: drop-shadow(0 0 13px rgba(242,88,202,.48));
  animation: travaProgressStar 1.8s 1.5s ease-in-out infinite;
}

.trava-loader-sr-only {
  position: absolute !important;
  width: 1px !important;
  height: 1px !important;
  padding: 0 !important;
  margin: -1px !important;
  overflow: hidden !important;
  clip: rect(0,0,0,0) !important;
  white-space: nowrap !important;
  border: 0 !important;
}

@keyframes travaPopStar {
  0% { opacity:0; transform:scale(.28); filter:blur(12px) drop-shadow(0 0 0 rgba(237,107,204,0)); }
  66% { opacity:1; transform:scale(1.08); filter:blur(0) drop-shadow(0 0 20px rgba(237,107,204,.35)); }
  100% { opacity:1; transform:scale(1); filter:blur(0) drop-shadow(0 0 16px rgba(237,107,204,.28)); }
}
@keyframes travaStarGlowIn {
  0% { opacity:0; transform:translate(-50%,-50%) scale(.35); filter:blur(16px); }
  70% { opacity:1; transform:translate(-50%,-50%) scale(1.06); filter:blur(0); }
  100% { opacity:1; transform:translate(-50%,-50%) scale(1); filter:blur(0); }
}
@keyframes travaPop {
  0% { opacity:0; transform:translateY(12px) scale(.48); filter:blur(10px) drop-shadow(0 0 0 rgba(111,81,184,0)); }
  70% { opacity:1; transform:translateY(-2px) scale(1.08); filter:blur(0) drop-shadow(0 13px 16px rgba(111,81,184,.13)); }
  100% { opacity:1; transform:translateY(0) scale(1); filter:blur(0) drop-shadow(0 13px 16px rgba(111,81,184,.13)); }
}
@keyframes travaBottomAvatarIn {
  0% { opacity:0; transform:translateX(-50%) translateY(12px) scale(.48); filter:blur(9px); }
  70% { opacity:1; transform:translateX(-50%) translateY(-2px) scale(1.08); filter:blur(0); }
  100% { opacity:1; transform:translateX(-50%) translateY(0) scale(1); filter:blur(0); }
}
@keyframes travaFadeUp {
  from { opacity:0; transform:translateY(24px); filter:blur(7px); }
  to { opacity:1; transform:translateY(0); filter:blur(0); }
}
@keyframes travaRipple {
  0% { opacity:0; transform:translate(-50%,-50%) scale(.72); }
  18% { opacity:.55; }
  100% { opacity:0; transform:translate(-50%,-50%) scale(2.18); }
}
@keyframes travaGlowBreath {
  0%,100% { box-shadow:0 0 0 2px rgba(255,255,255,.68) inset,0 0 42px rgba(208,124,255,.18),0 0 64px rgba(255,169,129,.13); }
  50% { box-shadow:0 0 0 2px rgba(255,255,255,.88) inset,0 0 60px rgba(208,124,255,.29),0 0 82px rgba(255,169,129,.19); }
}
@keyframes travaFloatA { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-7px)} }
@keyframes travaFloatB { 0%,100%{transform:translateY(0)} 50%{transform:translateY(6px)} }
@keyframes travaFloatSoft { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-4px) scale(1.015)} }
@keyframes travaFloatBottom { 0%,100%{transform:translateX(-50%) translateY(0)} 50%{transform:translateX(-50%) translateY(-6px)} }
@keyframes travaCloudIn { from{opacity:0; transform:scale(.72)} to{opacity:.78; transform:scale(1)} }
@keyframes travaCloudDrift { 0%,100%{transform:translateX(0)} 50%{transform:translateX(8px)} }
@keyframes travaTwinkleIn { from{opacity:0; transform:scale(.25) rotate(-30deg)} to{opacity:1; transform:scale(1) rotate(0)} }
@keyframes travaTwinkle { 0%,100%{transform:scale(.72); opacity:.45} 50%{transform:scale(1.28); opacity:1} }
@keyframes travaProgressStar { 0%,100%{transform:scale(.84) rotate(-6deg); opacity:.82} 50%{transform:scale(1.12) rotate(6deg); opacity:1} }
@keyframes travaLoaderFailsafe { to { opacity:0; visibility:hidden; pointer-events:none; } }

@media (max-height: 780px) {
  .trava-loader-shell { transform: scale(.88); transform-origin: center center; }
  .trava-loader-stage { height: min(55vh, 500px); }
  .trava-loader-copy { margin-top: -12px; }
}

@media (max-height: 650px) and (min-width: 760px) {
  .trava-loader-shell {
    width: min(96vw, 980px);
    display: grid;
    grid-template-columns: minmax(420px, 1fr) minmax(340px, .78fr);
    grid-template-areas: "art copy" "art progress";
    column-gap: 34px;
    transform: none;
  }
  .trava-loader-stage { grid-area: art; width: min(58vw, 560px); height: min(88vh, 590px); }
  .trava-loader-copy { grid-area: copy; align-self:end; margin-top:0; }
  .trava-loader-progress-wrap { grid-area:progress; align-self:start; width:min(38vw,420px); }
}

@media (max-width: 430px) {
  .trava-loader-shell { width: 96vw; padding-top: 7px; }
  .trava-loader-stage { width: 96vw; height: min(58vh, 510px); min-height: 330px; }
  .trava-loader-title { font-size: clamp(34px, 11vw, 49px); }
  .trava-loader-subtitle { font-size: clamp(14px, 4.6vw, 18px); }
  .trava-loader-progress-wrap { width: 86vw; height: 62px; }
}

@media (prefers-reduced-motion: reduce) {
  #trava-initial-loader *, #trava-initial-loader *::before, #trava-initial-loader *::after {
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
  }
  .trava-loader-asset,
  .trava-loader-avatar-bottom,
  .trava-loader-copy,
  .trava-loader-progress-wrap,
  .trava-loader-star-glow,
  .trava-loader-cloud,
  .trava-loader-twinkle { opacity: 1; }
}`;

const TRAVA_LOADER_SCRIPT = String.raw`(function () {
  var loader = document.getElementById('trava-initial-loader');
  if (!loader) return;

  var root = document.documentElement;
  var fill = loader.querySelector('.trava-loader-progress-fill');
  var track = loader.querySelector('.trava-loader-progress-track');
  var startedAt = performance.now();
  var dismissed = false;
  var MIN_VISIBLE_MS = 2050;
  var NORMAL_PROGRESS_MS = 2500;

  root.classList.add('trava-loader-active');

  function setProgressTransition(duration) {
    if (!fill) return;
    fill.style.transition = 'width ' + duration + 'ms cubic-bezier(.22,.61,.36,1)';
  }

  function startProgress() {
    if (!fill) return;
    setProgressTransition(NORMAL_PROGRESS_MS);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        fill.style.width = '100%';
      });
    });
  }

  function fadeOut() {
    if (dismissed) return;
    dismissed = true;
    loader.classList.add('trava-loader--leaving');
    root.classList.remove('trava-loader-active');
    window.setTimeout(function () {
      if (loader && loader.parentNode) loader.parentNode.removeChild(loader);
    }, 620);
  }

  function finishSoon() {
    if (dismissed) return;
    var elapsed = performance.now() - startedAt;
    var wait = Math.max(0, MIN_VISIBLE_MS - elapsed);

    window.setTimeout(function () {
      if (!fill || !track) {
        fadeOut();
        return;
      }

      var trackWidth = Math.max(1, track.getBoundingClientRect().width);
      var fillWidth = fill.getBoundingClientRect().width;
      var current = Math.max(0, Math.min(100, fillWidth / trackWidth * 100));
      fill.style.transition = 'none';
      fill.style.width = current + '%';

      requestAnimationFrame(function () {
        setProgressTransition(420);
        fill.style.width = '100%';
        window.setTimeout(fadeOut, 470);
      });
    }, wait);
  }

  startProgress();

  if (fill) {
    fill.addEventListener('transitionend', function (event) {
      if (event.propertyName === 'width' && fill.getBoundingClientRect().width >= (track ? track.getBoundingClientRect().width - 2 : 0)) {
        fadeOut();
      }
    });
  }

  if (document.readyState === 'complete') {
    finishSoon();
  } else {
    window.addEventListener('load', finishSoon, { once: true });
  }

  window.setTimeout(fadeOut, 3200);

  window.TRAVALoader = {
    dismiss: fadeOut,
    finish: finishSoon
  };
})();`;

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover"
        />
        <meta name="theme-color" content="#FFF8EE" />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: TRAVA_LOADER_CSS }} />
      </head>
      <body>
      <div id="trava-initial-loader" role="status" aria-live="polite" aria-label="Preparing your journey">
        <div className="trava-loader-shell">
          <div className="trava-loader-stage" aria-hidden="true">
            <div className="trava-loader-orbit trava-loader-orbit--1" />
            <div className="trava-loader-orbit trava-loader-orbit--2" />
            <div className="trava-loader-orbit trava-loader-orbit--3" />
            <div className="trava-loader-orbit trava-loader-orbit--4" />
            <div className="trava-loader-ripple" />
            <div className="trava-loader-ripple trava-loader-ripple--2" />
            <div className="trava-loader-ripple trava-loader-ripple--3" />
            <div className="trava-loader-star-glow" />

            <img className="trava-loader-cloud trava-loader-cloud--left" src="/trava-loader/cloud_left.png" alt="" />
            <img className="trava-loader-cloud trava-loader-cloud--right" src="/trava-loader/cloud_right.png" alt="" />
            <img className="trava-loader-asset trava-loader-asset--star" src="/trava-loader/center_star.png" alt="" />
            <img className="trava-loader-asset trava-loader-asset--airplane" src="/trava-loader/airplane.png" alt="" />
            <img className="trava-loader-asset trava-loader-asset--pin" src="/trava-loader/pin.png" alt="" />
            <img className="trava-loader-asset trava-loader-asset--calendar" src="/trava-loader/calendar.png" alt="" />
            <img className="trava-loader-asset trava-loader-asset--avatar-female" src="/trava-loader/avatar_female.png" alt="" />
            <img className="trava-loader-asset trava-loader-asset--suitcase" src="/trava-loader/suitcase.png" alt="" />
            <img className="trava-loader-asset trava-loader-asset--globe" src="/trava-loader/globe.png" alt="" />
            <img className="trava-loader-asset trava-loader-asset--ticket" src="/trava-loader/ticket.png" alt="" />
            <img className="trava-loader-asset trava-loader-asset--avatar-male" src="/trava-loader/avatar_male.png" alt="" />

            <div className="trava-loader-avatar-bottom">
              <img src="/trava-loader/avatar_glasses.png" alt="" />
            </div>

            <span className="trava-loader-twinkle trava-loader-twinkle--1" />
            <span className="trava-loader-twinkle trava-loader-twinkle--2" />
            <span className="trava-loader-twinkle trava-loader-twinkle--3" />
            <span className="trava-loader-twinkle trava-loader-twinkle--4" />
          </div>

          <div className="trava-loader-copy">
            <div className="trava-loader-brand">TRAVA ✦</div>
            <h1 className="trava-loader-title">
              Preparing your
              <span className="trava-loader-title-gradient">journey</span>
            </h1>
            <p className="trava-loader-subtitle">Loading your next adventure...</p>
          </div>

          <div className="trava-loader-progress-wrap" aria-hidden="true">
            <div className="trava-loader-progress-track">
              <div className="trava-loader-progress-fill" />
            </div>
            <div className="trava-loader-progress-star" />
          </div>
          <span className="trava-loader-sr-only">Loading TRAVA AI</span>
        </div>
      </div>
        {children}
        <script dangerouslySetInnerHTML={{ __html: TRAVA_LOADER_SCRIPT }} />
      </body>
    </html>
  );
}
