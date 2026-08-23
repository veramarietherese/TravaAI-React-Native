import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

const CSS = String.raw`
html,body{margin:0;min-height:100%;background:#f8f2ff}
body{overflow:hidden}
#trava-bootstrap-loader{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;overflow:hidden;background:radial-gradient(circle at 50% 8%,rgba(255,226,211,.82),transparent 35%),radial-gradient(circle at 18% 62%,rgba(253,225,247,.7),transparent 38%),radial-gradient(circle at 82% 70%,rgba(221,231,255,.76),transparent 42%),linear-gradient(180deg,#fff8ee 0%,#fff1f3 28%,#f7eeff 66%,#eef5ff 100%);font-family:Inter,-apple-system,BlinkMacSystemFont,"SF Pro Display","Segoe UI",sans-serif;transition:opacity .38s ease,visibility .38s linear;opacity:1;visibility:visible}
#trava-bootstrap-loader.trava-bootstrap-loader--leaving{opacity:0;visibility:hidden;pointer-events:none}
.tbl-shell{width:min(96vw,500px);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:10px 14px 18px}
.tbl-stage{position:relative;width:min(92vw,470px);height:min(51vh,510px);min-height:350px}
.tbl-orbit,.tbl-ripple{position:absolute;left:50%;top:49%;transform:translate(-50%,-50%);border-radius:50%;pointer-events:none}
.tbl-orbit{border:1.2px dashed rgba(255,255,255,.92)}
.tbl-o1{width:34%;aspect-ratio:1;border-style:solid}.tbl-o2{width:58%;aspect-ratio:1}.tbl-o3{width:78%;aspect-ratio:1}.tbl-o4{width:96%;aspect-ratio:1;opacity:.74}
.tbl-ripple{width:38%;aspect-ratio:1;border:1px solid rgba(255,255,255,.76);opacity:0;animation:tblRipple 2.35s ease-out infinite}.tbl-r2{animation-delay:.78s}.tbl-r3{animation-delay:1.56s}
.tbl-glow{position:absolute;left:50%;top:49%;width:32%;aspect-ratio:1;transform:translate(-50%,-50%);border-radius:50%;background:rgba(255,255,255,.5);box-shadow:0 0 44px rgba(219,117,244,.2)}
.tbl-asset{position:absolute;display:block;object-fit:contain;opacity:0;filter:drop-shadow(0 12px 16px rgba(104,73,173,.13));animation:tblPop .58s cubic-bezier(.2,.95,.35,1.25) forwards,tblFloat 3.7s ease-in-out infinite}
.tbl-star{left:40%;top:39%;width:20%;height:22%;animation-delay:.05s,.9s}.tbl-airplane{left:6%;top:9%;width:34%;height:29%;animation-delay:.18s,1s}.tbl-pin{left:42%;top:0;width:16%;height:25%;animation-delay:.3s,1.1s}.tbl-calendar{right:5%;top:12%;width:21%;height:27%;animation-delay:.42s,1.2s}.tbl-female{right:-1%;top:40%;width:19%;height:24%;animation-delay:.54s,1.3s}.tbl-suitcase{right:3%;bottom:12%;width:22%;height:31%;animation-delay:.66s,1.4s}.tbl-glasses{left:41%;bottom:-3%;width:18%;height:23%;animation-delay:.78s,1.5s}.tbl-globe{left:36.5%;bottom:7%;width:27%;height:31%;animation-delay:.9s,1.6s}.tbl-ticket{left:3%;bottom:18%;width:32%;height:26%;animation-delay:1.02s,1.7s}.tbl-male{left:-1%;top:39%;width:19%;height:24%;animation-delay:1.14s,1.8s}
.tbl-cloud{position:absolute;display:block;object-fit:contain;opacity:.78}.tbl-cloud-left{left:-2%;top:14%;width:12%;height:10%}.tbl-cloud-right{right:-1%;bottom:18%;width:12%;height:10%}
.tbl-copy{display:flex;flex-direction:column;align-items:center;text-align:center;margin-top:-8px;opacity:0;transform:translateY(18px);animation:tblFadeUp .58s 1.05s ease forwards;width:100%}
.tbl-brand{font-size:20px;line-height:24px;letter-spacing:4px;font-weight:800;background:linear-gradient(90deg,#675ae9,#e96bae,#f28ac8);-webkit-background-clip:text;background-clip:text;color:transparent}
.tbl-heading{margin:13px 0 0;color:#10162d;font-size:clamp(34px,8vw,40px);line-height:1.08;font-weight:900;letter-spacing:-1.1px}.tbl-journey{margin-top:-2px;font-size:clamp(50px,12vw,58px);line-height:1.05;font-weight:900;letter-spacing:-2px;background:linear-gradient(90deg,#6697ff,#9279ff,#e871c9,#ffa060);-webkit-background-clip:text;background-clip:text;color:transparent}.tbl-sub{margin:12px 0 0;color:#8184a6;font-size:16px;line-height:22px;font-weight:700}
.tbl-progress{width:86%;max-width:380px;height:62px;margin-top:28px;padding:0 16px;display:flex;align-items:center;border-radius:31px;background:#0c0e1a;box-shadow:0 10px 24px rgba(92,74,147,.12)}.tbl-track{flex:1;height:14px;border-radius:999px;overflow:hidden;background:#202337}.tbl-fill{height:100%;width:0;border-radius:999px;background:linear-gradient(90deg,#4faeff,#986bff,#eb6ec4,#ff9b71);animation:tblProgress 2.5s 1.15s cubic-bezier(.4,0,.2,1) forwards}.tbl-progress-star{width:42px;margin-left:10px;color:#f17fc1;font-size:24px;text-align:center;text-shadow:0 0 12px rgba(241,127,193,.45)}
@keyframes tblRipple{0%{transform:translate(-50%,-50%) scale(.82);opacity:0}15%{opacity:.45}100%{transform:translate(-50%,-50%) scale(1.28);opacity:0}}@keyframes tblPop{0%{opacity:0;transform:translateY(12px) scale(.62);filter:blur(7px)}70%{opacity:1;transform:translateY(-2px) scale(1.05);filter:blur(0)}100%{opacity:1;transform:translateY(0) scale(1)}}@keyframes tblFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}@keyframes tblFadeUp{to{opacity:1;transform:translateY(0)}}@keyframes tblProgress{to{width:100%}}
@media(max-height:740px){.tbl-stage{height:min(47vh,430px);min-height:310px}.tbl-shell{transform:scale(.9)}.tbl-progress{margin-top:18px}}
@media(prefers-reduced-motion:reduce){.tbl-asset,.tbl-copy,.tbl-fill,.tbl-ripple{animation-duration:.01ms!important;animation-delay:0ms!important;animation-iteration-count:1!important}.tbl-asset,.tbl-copy{opacity:1!important;transform:none!important}.tbl-fill{width:100%!important}}
`;

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
      </head>
      <body>
        <div id="trava-bootstrap-loader" role="status" aria-live="polite" aria-label="TRAVA AI is loading">
          <div className="tbl-shell">
            <div className="tbl-stage" aria-hidden="true">
              <div className="tbl-orbit tbl-o1" /><div className="tbl-orbit tbl-o2" /><div className="tbl-orbit tbl-o3" /><div className="tbl-orbit tbl-o4" />
              <div className="tbl-ripple" /><div className="tbl-ripple tbl-r2" /><div className="tbl-ripple tbl-r3" /><div className="tbl-glow" />
              <img className="tbl-cloud tbl-cloud-left" src="/trava-loader/cloud_left.png" alt="" />
              <img className="tbl-cloud tbl-cloud-right" src="/trava-loader/cloud_right.png" alt="" />
              <img className="tbl-asset tbl-star" src="/trava-loader/center_star.png" alt="" />
              <img className="tbl-asset tbl-airplane" src="/trava-loader/airplane.png" alt="" />
              <img className="tbl-asset tbl-pin" src="/trava-loader/pin.png" alt="" />
              <img className="tbl-asset tbl-calendar" src="/trava-loader/calendar.png" alt="" />
              <img className="tbl-asset tbl-female" src="/trava-loader/avatar_female.png" alt="" />
              <img className="tbl-asset tbl-suitcase" src="/trava-loader/suitcase.png" alt="" />
              <img className="tbl-asset tbl-glasses" src="/trava-loader/avatar_glasses.png" alt="" />
              <img className="tbl-asset tbl-globe" src="/trava-loader/globe.png" alt="" />
              <img className="tbl-asset tbl-ticket" src="/trava-loader/ticket.png" alt="" />
              <img className="tbl-asset tbl-male" src="/trava-loader/avatar_male.png" alt="" />
            </div>
            <div className="tbl-copy">
              <div className="tbl-brand">T R A V A ✦</div>
              <div className="tbl-heading">Preparing your</div>
              <div className="tbl-journey">journey</div>
              <p className="tbl-sub">Loading your next adventure...</p>
              <div className="tbl-progress"><div className="tbl-track"><div className="tbl-fill" /></div><div className="tbl-progress-star">✦</div></div>
            </div>
          </div>
        </div>
        {children}
      </body>
    </html>
  );
}
