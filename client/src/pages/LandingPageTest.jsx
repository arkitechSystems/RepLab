import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppStoreBadges from '../components/AppStoreBadges';
import { useAuth } from '../context/AuthContext';

// ───────────────────────────────────────────────────────────────────────
// REPLAB marketing landing — handoff from Claude Design 2026-05-24.
// Auth-aware: signed-in visitors see "Go to Web App" CTAs that route to
// /app; signed-out visitors see "Log In" CTAs that route to /login. The
// "Join the Waiting List" CTA always navigates to /waiting-list.
// App Store + Google Play badges are intentionally non-clickable (the
// shared `<AppStoreBadges>` component renders them as `disabled` buttons
// that preserve their hover/active visual states). The bottom-of-page
// store badges reuse the SAME component as the hero so the visual
// treatment cannot drift.
//
// The dense CSS that powers the phone-tour mockups, marquee, headline
// reveal, stat counters, and pro-section sweep all lives globally in
// src/index.css under the `.lp-` prefix. A landing-only stylesheet is
// also injected below for the phone mock styles (heavy, single-use, and
// would bloat Tailwind to extract).
// ───────────────────────────────────────────────────────────────────────

// Inline <style> for landing-only mock UI (phone tour + plate calculator).
// Kept here instead of index.css so it's tree-shaken with this page chunk.
const LANDING_STYLES = `
.lp-container{max-width:1440px;margin:0 auto;padding:0 40px}
@media (max-width:780px){.lp-container{padding:0 20px}}

/* App tour grid */
.lp-tour{display:grid;grid-template-columns:repeat(3,1fr);gap:40px}
@media (max-width:780px){.lp-tour{grid-template-columns:1fr;gap:40px}}
.lp-phone{position:relative}
.lp-phone-frame{background:linear-gradient(180deg,#1a1a1a,#0a0a0a);border:1px solid rgba(255,255,255,0.12);border-radius:38px;padding:8px;aspect-ratio:9/15;overflow:hidden;position:relative;box-shadow:0 50px 80px -30px rgba(0,0,0,0.9),0 0 0 1px rgba(255,255,255,0.04),inset 0 0 0 1px rgba(255,255,255,0.05);max-width:300px;margin:0 auto}
.lp-phone-screen{background:#0a0a0a;border-radius:26px;height:100%;overflow:hidden;position:relative}
.lp-phone-notch{position:absolute;top:8px;left:50%;transform:translateX(-50%);width:74px;height:20px;background:#000;border-radius:0 0 12px 12px;z-index:5}
.lp-phone-statusbar{position:absolute;top:0;left:0;right:0;height:30px;display:flex;justify-content:space-between;align-items:center;padding:8px 16px;font-size:9px;font-weight:600;z-index:4;color:#fff}
.lp-phone-meta{margin-top:28px;padding-bottom:28px;border-bottom:1px solid rgba(245,245,242,0.10);display:flex;align-items:flex-start;gap:16px;color:#fff}
.lp-phone-meta .lp-num{font-family:'Anton',sans-serif;font-size:36px;color:#e10600;line-height:1}
.lp-phone-meta .lp-mtitle{font-family:'Anton',sans-serif;font-size:24px;text-transform:uppercase;line-height:1;margin-bottom:8px}
.lp-phone-meta .lp-mdesc{font-size:13px;color:rgba(245,245,242,0.55);line-height:1.55}

/* Workout session screen */
.lp-app-session{padding:28px 6px 4px;display:flex;flex-direction:column;gap:4px;height:100%;color:#fff;background:linear-gradient(180deg,#1a1a1a 0%,#0d0d0d 40%,#111 70%,#0a0a0a 100%);font-family:system-ui,-apple-system,sans-serif}
.lp-as-head{display:flex;align-items:center;gap:6px;padding:2px 4px 4px}
.lp-as-back{font-size:8px;font-weight:600;color:rgba(255,255,255,0.5);letter-spacing:0.06em}
.lp-as-mid{flex:1;text-align:center}
.lp-as-prog{font-size:7px;color:rgba(239,68,68,0.7);letter-spacing:0.22em;text-transform:uppercase;font-weight:600}
.lp-as-name{font-size:9px;color:#fff;font-weight:700;margin-top:1px}
.lp-as-card{position:relative;overflow:hidden;border-radius:2px;background:linear-gradient(160deg,#1e1e1e 0%,#141414 100%);box-shadow:0 8px 20px rgba(0,0,0,0.45),0 3px 8px rgba(0,0,0,0.3),inset 0 1px 0 rgba(255,255,255,0.05)}
.lp-as-accent{height:2px;width:100%;background:linear-gradient(90deg,#9ca3af,rgba(156,163,175,0.5),transparent)}
.lp-as-progress{height:2px;background:rgba(255,255,255,0.04);position:relative;overflow:hidden}
.lp-as-progress > div{height:100%;background:linear-gradient(90deg,#ef4444,rgba(239,68,68,0.6));animation:lpAsProg 12s linear infinite}
@keyframes lpAsProg{0%{width:100%}100%{width:0%}}
.lp-as-trow{padding:7px 9px;display:flex;align-items:center;gap:6px}
.lp-as-pulse{width:5px;height:5px;border-radius:50%;background:#9ca3af}
.lp-as-pulse.lp-red{background:#ef4444;animation:lpAsPulse 1.4s ease-in-out infinite}
@keyframes lpAsPulse{0%,100%{opacity:1}50%{opacity:0.55}}
.lp-as-tlabel{font-size:7px;color:rgba(255,255,255,0.55);letter-spacing:0.28em;text-transform:uppercase;font-weight:300}
.lp-as-tlabel.lp-red{color:rgba(239,68,68,0.85)}
.lp-as-tval{font-size:18px;font-weight:200;color:#fff;font-variant-numeric:tabular-nums;letter-spacing:-0.5px;line-height:1}
.lp-as-tflex{flex:1}
.lp-as-pill{font-size:7px;font-weight:700;color:rgba(255,255,255,0.7);background:rgba(255,255,255,0.06);padding:3px 5px;border-radius:3px}
.lp-as-pill.lp-plus{color:rgba(239,68,68,0.9);background:rgba(239,68,68,0.12)}

/* ExerciseCard mock */
.lp-ec{position:relative;border-radius:8px;background:linear-gradient(160deg,rgba(28,28,28,0.95) 0%,rgba(18,18,18,0.95) 100%);box-shadow:0 4px 12px rgba(0,0,0,0.4),inset 0 1px 0 rgba(255,255,255,0.05);overflow:hidden}
.lp-ec.lp-current{box-shadow:0 6px 18px rgba(239,68,68,0.18),inset 0 1px 0 rgba(255,255,255,0.06),inset 0 0 0 1px rgba(239,68,68,0.35)}
.lp-ec-head{padding:6px 8px 5px;display:flex;justify-content:space-between;align-items:center;border-bottom:1.5px double rgba(255,255,255,0.15);background:rgba(20,20,20,0.6)}
.lp-ec-name{font-size:10px;font-weight:700;color:#fff;letter-spacing:-0.005em;flex:1;min-width:0;text-overflow:ellipsis;overflow:hidden;white-space:nowrap}
.lp-ec-actions{display:flex;gap:3px;flex-shrink:0;align-items:center}
.lp-ec-action{height:13px;padding:0 4px;border-radius:3px;font-size:6px;font-weight:700;letter-spacing:0.04em;display:inline-flex;align-items:center;background:rgba(239,68,68,0.1);color:#ef4444;border:1px solid rgba(239,68,68,0.2)}
.lp-ec-cols{display:grid;grid-template-columns:14px 26px 26px 1fr 1fr;gap:3px;align-items:center;padding:3px 6px;font-size:6px;text-transform:uppercase;letter-spacing:0.08em;color:rgba(255,255,255,0.4);font-weight:500;border-bottom:1px solid rgba(255,255,255,0.04)}
.lp-ec-cols > div{text-align:center}
.lp-ec-row{display:grid;grid-template-columns:14px 26px 26px 1fr 1fr;gap:3px;align-items:center;padding:3px 6px;border-bottom:1px solid rgba(255,255,255,0.04)}
.lp-ec-row:last-child{border-bottom:none}
.lp-ec-check{width:11px;height:11px;border-radius:50%;border:1.5px solid rgba(255,255,255,0.25);display:grid;place-items:center;font-size:7px;color:transparent;line-height:1;justify-self:start}
.lp-ec-check.lp-done{background:#22c55e;border-color:#22c55e;color:#fff}
.lp-ec-row.lp-active .lp-ec-check{border-color:rgba(239,68,68,0.5);box-shadow:0 0 0 1.5px rgba(239,68,68,0.15)}
.lp-ec-type{font-size:6px;color:rgba(255,255,255,0.45);text-align:center;text-transform:uppercase;letter-spacing:0.06em}
.lp-ec-goal{font-size:7px;color:rgba(239,68,68,0.6);text-align:center;font-variant-numeric:tabular-nums;background:rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.05);border-radius:3px;padding:2px 0;font-weight:600}
.lp-ec-input{font-size:9px;color:#fff;text-align:center;background:rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.08);border-radius:4px;padding:3px 0;font-variant-numeric:tabular-nums;font-weight:700;letter-spacing:0.02em;font-family:'JetBrains Mono',monospace}
.lp-ec-input.lp-empty{color:rgba(255,255,255,0.2);font-weight:400}

/* Bottom-nav */
.lp-bn{position:absolute;bottom:0;left:0;right:0;display:flex;background:#0a0a0a;border-top:1px solid rgba(255,255,255,0.06);height:34px;z-index:5}
.lp-bn-tab{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;position:relative;color:rgba(255,255,255,0.45)}
.lp-bn-accent{position:absolute;top:0;left:50%;transform:translateX(-50%);width:18px;height:1.5px;background:#ef4444}
.lp-bn-tab.lp-active{color:#ef4444}
.lp-bn-icon{width:11px;height:11px;display:grid;place-items:center}
.lp-bn-icon svg{width:100%;height:100%}
.lp-bn-label{font-size:5.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.16em}

/* Progress screen */
.lp-app-prog{padding:28px 8px 6px;display:flex;flex-direction:column;gap:6px;height:100%;color:#fff;background:linear-gradient(180deg,#1a1a1a 0%,#0d0d0d 40%,#111 70%,#0a0a0a 100%);font-family:system-ui,-apple-system,sans-serif}
.lp-ap-header{display:flex;justify-content:space-between;align-items:baseline;padding:0 2px 4px}
.lp-ap-title{font-size:18px;font-weight:900;color:#fff;letter-spacing:-0.005em}
.lp-ap-back{font-size:7px;font-weight:700;color:rgba(255,255,255,0.45);letter-spacing:0.2em;text-transform:uppercase}
.lp-ap-card{position:relative;overflow:hidden;border-radius:2px;background:linear-gradient(160deg,#1e1e1e 0%,#141414 100%);box-shadow:0 8px 30px rgba(0,0,0,0.45),0 3px 10px rgba(0,0,0,0.3),inset 0 1px 0 rgba(255,255,255,0.05)}
.lp-ap-stripe{height:2.5px;background:linear-gradient(90deg,#22c55e,rgba(34,197,94,0.25),transparent)}
.lp-ap-glow{position:absolute;top:-30px;right:-30px;width:160px;height:160px;background:radial-gradient(circle,rgba(34,197,94,0.14) 0%,transparent 60%);filter:blur(20px);pointer-events:none}
.lp-ap-body{position:relative;z-index:1;padding:12px 11px}
.lp-ap-eyebrow{font-size:7px;color:rgba(34,197,94,0.85);text-transform:uppercase;letter-spacing:0.3em;font-weight:300;margin-bottom:8px}
.lp-ap-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:8px}
.lp-ap-num{font-size:21px;font-weight:900;color:#fff;line-height:1;font-variant-numeric:tabular-nums;letter-spacing:-0.025em}
.lp-ap-num.lp-green{color:#86efac}
.lp-ap-lbl{font-size:6px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.2em;margin-top:3px;font-weight:300}
.lp-ap-jump{padding:7px 10px;border:1px solid rgba(34,197,94,0.25);background:linear-gradient(135deg,rgba(34,197,94,0.10) 0%,rgba(34,197,94,0.02) 100%);border-radius:2px}
.lp-ap-jump-lbl{font-size:6px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.2em;margin-bottom:3px;font-weight:300}
.lp-ap-jump-name{font-size:9px;font-weight:700;color:#fff;line-height:1.2}
.lp-ap-jump-delta{color:#86efac;font-weight:300;margin-left:4px;font-size:8px}
.lp-ap-h{font-size:14px;font-weight:900;color:#fff;letter-spacing:-0.025em;line-height:0.95;margin-top:2px}
.lp-ap-legend{display:flex;gap:8px;margin-top:8px;font-size:7px;letter-spacing:0.18em;text-transform:uppercase;font-weight:500;flex-wrap:wrap}
.lp-ap-leg{display:inline-flex;align-items:center;gap:3px}
.lp-ap-dot{width:5px;height:5px;border-radius:50%}
.lp-ap-chips{display:flex;gap:4px;flex-wrap:wrap}
.lp-ap-chip{font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:0.18em;padding:5px 7px;border-radius:2px;background:rgba(255,255,255,0.05);color:rgba(255,255,255,0.7);box-shadow:inset 0 0 0 1px rgba(255,255,255,0.1);border:none}
.lp-ap-chip.lp-on{background:linear-gradient(135deg,rgba(239,68,68,0.9),rgba(220,38,38,0.9));color:#fff;box-shadow:0 3px 10px rgba(239,68,68,0.3)}
.lp-ap-chip span{opacity:0.6;font-weight:400;margin-left:2px}
.lp-ap-row{padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04)}
.lp-ap-row:last-child{border-bottom:none;padding-bottom:0}
.lp-ap-row:first-child{padding-top:0}
.lp-ap-row-head{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:5px}
.lp-ap-ex{font-size:9px;font-weight:700;color:#fff}
.lp-ap-w{font-size:7.5px;color:rgba(255,255,255,0.4)}
.lp-ap-pr{display:flex;align-items:center;gap:4px;margin-bottom:3px}
.lp-ap-date{font-size:7px;color:rgba(255,255,255,0.4);width:34px;flex-shrink:0;font-weight:500}
.lp-ap-pill{font-size:9px;font-weight:700;font-variant-numeric:tabular-nums;padding:3px 6px;border-radius:3px}
.lp-ap-pill.lp-up{background:rgba(34,197,94,0.15);color:#86efac;box-shadow:inset 0 0 0 1px rgba(34,197,94,0.45)}
.lp-ap-pill.lp-down{background:rgba(239,68,68,0.15);color:#fca5a5;box-shadow:inset 0 0 0 1px rgba(239,68,68,0.45)}
.lp-ap-pill.lp-same{background:rgba(251,191,36,0.15);color:#fcd34d;box-shadow:inset 0 0 0 1px rgba(251,191,36,0.45)}

/* Plate-calc screen */
.lp-app-pc{padding:50px 16px 16px;height:100%;color:#fff;background:linear-gradient(180deg,#1a1a1a 0%,#0d0d0d 40%,#111 70%,#0a0a0a 100%)}
.lp-pc-head{display:flex;justify-content:space-between;align-items:center;padding:0 4px 18px}
.lp-pc-title{font-family:'Anton',sans-serif;font-size:22px;text-transform:uppercase;letter-spacing:0.01em;line-height:1}
.lp-pc-sub{font-family:'JetBrains Mono',monospace;font-size:9px;color:rgba(245,245,242,0.30);letter-spacing:0.16em;text-transform:uppercase;margin-top:3px}
.lp-pc-btn{width:26px;height:26px;border-radius:50%;background:rgba(255,255,255,0.08);display:grid;place-items:center;font-size:12px;color:#fff}
.lp-pc-top{text-align:center;padding:14px 0 18px}
.lp-pc-tlbl{font-family:'JetBrains Mono',monospace;font-size:8px;color:rgba(245,245,242,0.30);letter-spacing:0.22em;text-transform:uppercase}
.lp-pc-target{font-family:'Anton',sans-serif;font-size:54px;line-height:1;margin-top:4px;color:#fff}
.lp-pc-target small{font-size:18px;color:rgba(245,245,242,0.55);margin-left:2px}
.lp-pc-modes{display:flex;gap:4px;background:rgba(255,255,255,0.04);padding:3px;border-radius:6px;margin:0 24px 14px}
.lp-pc-mode{flex:1;text-align:center;padding:6px 4px;font-family:'JetBrains Mono',monospace;font-size:8px;letter-spacing:0.16em;text-transform:uppercase;color:rgba(245,245,242,0.55);border-radius:4px}
.lp-pc-mode.lp-active{background:#e10600;color:#fff}
.lp-pc-bar{position:relative;height:100px;margin:14px 0}
.lp-pc-line{position:absolute;top:50%;left:0;right:0;height:6px;background:#777;transform:translateY(-50%);border-radius:1px}
.lp-pc-line::before,.lp-pc-line::after{content:"";position:absolute;top:-3px;width:20px;height:12px;background:#999;border-radius:2px}
.lp-pc-line::before{left:-4px}.lp-pc-line::after{right:-4px}
.lp-pc-plates{position:absolute;top:0;bottom:0;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:3px}
.lp-pc-plate{border-radius:3px;display:grid;place-items:center;font-family:'Anton',sans-serif;color:#fff;font-size:10px}
.lp-pc-p45{width:14px;height:88px;background:#e10600}
.lp-pc-p25{width:13px;height:64px;background:#444}
.lp-pc-p10{width:11px;height:42px;background:#fff;color:#000}
.lp-pc-p5{width:10px;height:30px;background:#444}
.lp-pc-list{margin-top:12px;border-top:1px solid rgba(245,245,242,0.10);padding-top:12px}
.lp-pc-row{display:flex;justify-content:space-between;padding:6px 0;font-family:'JetBrains Mono',monospace;font-size:10px;color:#fff}
.lp-pc-row .lp-l{color:rgba(245,245,242,0.55);letter-spacing:0.1em}
.lp-pc-row .lp-r{font-weight:600}
.lp-pc-row.lp-tot{border-top:1px solid rgba(245,245,242,0.10);margin-top:6px;padding-top:10px}
.lp-pc-row.lp-tot .lp-r{color:#e10600;font-family:'Anton',sans-serif;font-size:14px}

/* Section header */
.lp-section{padding:140px 0;border-top:1px solid rgba(245,245,242,0.10);position:relative}
@media (max-width:780px){.lp-section{padding:80px 0}}
/* Tighten the gap between the marquee ticker and the first section
   ("Built for the Gym Floor") -- the default 140px top padding was
   creating dead space immediately after the ticker. 75% reduction. */
.lp-marquee + .lp-section{padding-top:35px}
@media (max-width:780px){.lp-marquee + .lp-section{padding-top:20px}}
.lp-section-tag{position:absolute;top:48px;right:40px;font-family:'JetBrains Mono',monospace;font-size:11px;color:rgba(245,245,242,0.30);letter-spacing:0.2em;text-transform:uppercase}
@media (max-width:780px){.lp-section-tag{display:none}}
.lp-section-head{display:grid;grid-template-columns:auto 1fr;align-items:end;justify-content:space-between;margin-bottom:64px;gap:48px}
@media (max-width:780px){.lp-section-head{grid-template-columns:1fr;gap:16px}}
.lp-section-head h2{font-family:'Anton',sans-serif;font-size:clamp(48px,7vw,108px);line-height:0.88;text-transform:uppercase;letter-spacing:-0.005em;color:#fff}
.lp-section-head h2 .lp-red{color:#e10600}
.lp-section-head .lp-desc{max-width:380px;font-size:15px;color:rgba(245,245,242,0.55);line-height:1.6;justify-self:end;text-align:right}
@media (max-width:780px){.lp-section-head .lp-desc{text-align:left;justify-self:start}}

/* Stats block */
.lp-stats{display:grid;grid-template-columns:repeat(3,1fr);border-top:1px solid rgba(245,245,242,0.10);border-bottom:1px solid rgba(245,245,242,0.10);background:#000}
@media (max-width:780px){.lp-stats{grid-template-columns:1fr}}
.lp-stat{padding:84px 32px 64px;border-right:1px solid rgba(245,245,242,0.10);text-align:center;position:relative}
.lp-stat:last-child{border-right:none}
@media (max-width:780px){.lp-stat{border-right:none;border-bottom:1px solid rgba(245,245,242,0.10);padding:56px 24px}.lp-stat:last-child{border-bottom:none}}
.lp-stat-num{font-family:'Anton',sans-serif;font-size:clamp(96px,13vw,200px);line-height:0.82;letter-spacing:-0.01em;color:#fff}
.lp-stat-num.lp-red{color:#e10600}
.lp-stat-num.lp-stroke{-webkit-text-stroke:1.5px #f5f5f2;color:transparent}
.lp-stat-label{font-family:'JetBrains Mono',monospace;font-size:12px;letter-spacing:0.2em;color:rgba(245,245,242,0.55);text-transform:uppercase;margin-top:18px}
.lp-stat-tag{position:absolute;top:24px;left:32px;font-family:'JetBrains Mono',monospace;font-size:10px;color:rgba(245,245,242,0.30);letter-spacing:0.2em}

/* Pro */
.lp-pro-wrap{padding:140px 0;border-top:1px solid rgba(245,245,242,0.10);background:linear-gradient(180deg,transparent,rgba(225,6,0,0.04))}
@media (max-width:780px){.lp-pro-wrap{padding:80px 0}}
.lp-pro{display:grid;grid-template-columns:1fr 1fr;gap:80px;align-items:center}
@media (max-width:780px){.lp-pro{grid-template-columns:1fr;gap:40px}}
.lp-pro-tag{display:inline-flex;align-items:center;gap:10px;font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#e10600;margin-bottom:24px;padding:6px 12px;border:1px solid #e10600;border-radius:999px}
.lp-pro h2{font-family:'Anton',sans-serif;font-size:clamp(48px,6.5vw,108px);line-height:0.9;text-transform:uppercase;letter-spacing:-0.005em;color:#fff}
.lp-pro h2 .lp-red{color:#e10600}
.lp-pro-lede{margin-top:24px;color:rgba(245,245,242,0.55);font-size:16px;line-height:1.6;max-width:480px}
.lp-pro-right{background:linear-gradient(135deg,#1a0a0a,#0a0a0a);border:1px solid rgba(245,245,242,0.10);padding:44px;position:relative;overflow:hidden}
.lp-pro-right h3{font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:rgba(245,245,242,0.55);margin-bottom:24px}
.lp-pro-features{list-style:none;padding:0;margin:0}
.lp-pro-features li{padding:16px 0;border-bottom:1px solid rgba(245,245,242,0.10);display:flex;align-items:center;gap:14px;font-size:15px;color:#f5f5f2;font-weight:500}
.lp-pro-features li:last-child{border-bottom:none}
.lp-pro-check{width:18px;height:18px;border-radius:50%;background:rgba(225,6,0,0.15);color:#e10600;display:grid;place-items:center;font-size:10px;flex-shrink:0}

/* Download strip */
/* Top padding reduced 75% (140 -> 35 / 80 -> 20) so the "Available Now"
   eyebrow + "Stop Tracking. Start Lifting." headline sit closer to the
   border line above the section. Bottom padding unchanged so the footer
   still has breathing room. */
.lp-download{padding:35px 0 140px;border-top:1px solid rgba(245,245,242,0.10);text-align:center;position:relative;overflow:hidden}
@media (max-width:780px){.lp-download{padding:20px 0 80px}}
.lp-download-bg{position:absolute;inset:0;background:radial-gradient(ellipse at center,rgba(225,6,0,0.10) 0%,transparent 60%);pointer-events:none}
.lp-download-inner{position:relative;z-index:1}
.lp-download h2{font-family:'Anton',sans-serif;font-size:clamp(72px,11vw,200px);line-height:0.86;text-transform:uppercase;letter-spacing:-0.012em;color:#fff}
.lp-download h2 .lp-red{color:#e10600}
.lp-download h2 .lp-stroke{-webkit-text-stroke:1.5px #f5f5f2;color:transparent}
.lp-download p{margin-top:24px;font-size:16px;color:rgba(245,245,242,0.55);max-width:560px;margin-left:auto;margin-right:auto;line-height:1.6}

/* Footer */
.lp-footer{padding:80px 0 36px;border-top:1px solid rgba(245,245,242,0.10);background:#000;color:#fff}
.lp-foot-top{display:grid;grid-template-columns:2fr 1fr 1fr;gap:48px;margin-bottom:60px}
@media (max-width:780px){.lp-foot-top{grid-template-columns:1fr 1fr;gap:32px}}
.lp-foot-brand .lp-brand{margin-bottom:24px;display:flex;align-items:center;gap:12px}
.lp-foot-brand p{font-size:14px;color:rgba(245,245,242,0.55);line-height:1.6;max-width:300px}
.lp-foot-col h4{font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#e10600;margin-bottom:20px}
.lp-foot-col ul{list-style:none;padding:0;margin:0}
.lp-foot-col li{margin-bottom:12px}
.lp-foot-col a, .lp-foot-col button{font-size:14px;color:#f5f5f2;transition:color .2s;background:none;border:none;padding:0;font-family:inherit;cursor:pointer;text-align:left}
.lp-foot-col a:hover, .lp-foot-col button:hover{color:#e10600}
.lp-foot-base{padding-top:28px;border-top:1px solid rgba(245,245,242,0.10);display:flex;justify-content:space-between;align-items:center;font-family:'JetBrains Mono',monospace;font-size:11px;color:rgba(245,245,242,0.55);letter-spacing:0.14em;text-transform:uppercase;flex-wrap:wrap;gap:16px}

/* Nav */
.lp-nav{position:fixed;top:0;left:0;right:0;z-index:100;backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);background:rgba(10,10,10,0.72);border-bottom:1px solid rgba(245,245,242,0.10);padding-top:env(safe-area-inset-top,0px)}
.lp-nav-inner{display:flex;align-items:center;justify-content:space-between;height:68px;padding:0 40px;max-width:1440px;margin:0 auto}
@media (max-width:780px){.lp-nav-inner{padding:0 20px;height:60px}}
/* Mobile-only: hide the EN/ES language toggle and the "Get the App" ghost
   button so only the brand mark + primary login/Go-to-Web-App CTA show.
   The nav was overflowing on phones — the "Get the App" label got
   truncated and the EN|ES switch wasn't doing anything yet. */
@media (max-width:780px){
  .lp-nav .lp-lang{display:none}
  .lp-nav .lp-btn-ghost{display:none}
}
.lp-brand{display:flex;align-items:center;gap:12px}
.lp-brand-mark{width:34px;height:34px;border-radius:6px;background:#000;display:grid;place-items:center;overflow:hidden;border:1px solid rgba(245,245,242,0.10)}
.lp-brand-mark img{width:88%;height:88%;object-fit:contain}
.lp-brand-word{font-family:'Anton',sans-serif;font-size:24px;letter-spacing:0.08em;line-height:1;color:#fff}
.lp-brand-word span{color:#e10600}
.lp-nav-cta{display:flex;align-items:center;gap:14px}
.lp-lang{display:inline-flex;align-items:center;gap:8px;font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:rgba(245,245,242,0.55);user-select:none}
.lp-lang .lp-on{color:#f5f5f2}
.lp-lang .lp-sep{color:rgba(245,245,242,0.30)}
@media (max-width:780px){.lp-lang{display:none}}

/* Buttons */
.lp-btn{display:inline-flex;align-items:center;gap:10px;padding:12px 22px;font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;border-radius:999px;transition:all .2s;white-space:nowrap;cursor:pointer;border:1px solid transparent}
.lp-btn-ghost{border-color:rgba(245,245,242,0.10);color:#f5f5f2;background:transparent}
.lp-btn-ghost:hover{border-color:#f5f5f2;background:rgba(255,255,255,0.04)}
.lp-btn-red{background:#e10600;color:#fff;border-color:#e10600}
.lp-btn-red:hover{background:#ff1810;border-color:#ff1810}
.lp-btn-red.lp-disabled,.lp-btn-red.lp-disabled:hover{cursor:not-allowed}
.lp-btn-ghost.lp-disabled,.lp-btn-ghost.lp-disabled:hover{cursor:not-allowed}
/* Hero variant — ~25% larger than the base nav/CTA buttons for the
   primary "Open Web App" / "Log In" call to action in the hero. */
.lp-btn-hero{padding:15px 28px;font-size:14px}
.lp-btn .lp-arrow{display:inline-block;transition:transform .2s}
.lp-btn:hover .lp-arrow{transform:translate(3px,-3px)}

/* Hero */
.lp-hero{padding:calc(90px + env(safe-area-inset-top,0px)) 0 60px;position:relative;overflow:hidden;display:flex;align-items:center}
@media (max-width:780px){.lp-hero{padding:calc(80px + env(safe-area-inset-top,0px)) 0 40px}}
.lp-hero-glow{position:absolute;top:-300px;right:-300px;width:1000px;height:1000px;background:radial-gradient(circle,rgba(225,6,0,0.16) 0%,transparent 60%);pointer-events:none;z-index:0}
.lp-hero-grid-bg{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.025) 1px,transparent 1px);background-size:80px 80px;pointer-events:none;mask:radial-gradient(ellipse at center,#000 0%,transparent 75%);-webkit-mask:radial-gradient(ellipse at center,#000 0%,transparent 75%);z-index:0}
.lp-hero-grid{display:block;position:relative;z-index:1;width:100%}
.lp-hero-left{max-width:920px;margin:0 auto;text-align:center}
.lp-hero-left .lp-eyebrow{margin-bottom:36px;justify-content:center}
/* Hide the small red rule before the hero eyebrow so 'Strength . Hypertrophy
   . Conditioning' starts flush. The .lp-eyebrow::before rule in index.css
   still applies to other eyebrows on the page (e.g. 'Available Now'). */
.lp-hero-left .lp-eyebrow::before{content:none}
.lp-h1{font-family:'Anton',sans-serif;font-weight:400;font-size:clamp(64px,9.5vw,168px);line-height:0.85;letter-spacing:-0.01em;text-transform:uppercase;color:#f5f5f2}
@media (max-width:1100px){.lp-h1{font-size:clamp(56px,11vw,108px)}}
@media (max-width:780px){.lp-h1{font-size:clamp(54px,12vw,84px)}}
.lp-h1 .lp-red{color:#e10600;display:inline-block;position:relative}
.lp-h1 .lp-stroke{-webkit-text-stroke:1.5px #f5f5f2;color:transparent}
.lp-hero-lede{margin-top:36px;font-size:18px;line-height:1.55;color:rgba(245,245,242,0.55);max-width:480px;margin-left:auto;margin-right:auto}
.lp-hero-cta{margin-top:40px;display:flex;gap:14px;align-items:center;flex-wrap:wrap;justify-content:center}
.lp-hero-badges{margin-top:24px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;justify-content:center}

/* Marquee */
.lp-marquee{border-top:1px solid rgba(245,245,242,0.10);border-bottom:1px solid rgba(245,245,242,0.10);padding:22px 0;overflow:hidden;background:#000;position:relative}
`;

// Headline reveal + stats count-up + body class "lp-is-loaded" trigger.
function useLandingFx(rootRef) {
  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const raf1 = requestAnimationFrame(() => {
      const raf2 = requestAnimationFrame(() => node.classList.add('lp-is-loaded'));
      return () => cancelAnimationFrame(raf2);
    });
    let observer;
    if (!reduce) {
      const statNums = node.querySelectorAll('[data-lp-count-to]');
      const animated = new WeakSet();
      const animate = (el) => {
        if (animated.has(el)) return;
        animated.add(el);
        const target = parseInt(el.getAttribute('data-lp-count-to'), 10);
        const startDelay = parseInt(el.getAttribute('data-lp-start-at') || '0', 10);
        const duration = 900;
        const start = performance.now() + startDelay;
        const tick = (now) => {
          if (now < start) { requestAnimationFrame(tick); return; }
          const t = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - t, 3);
          el.textContent = Math.round(target * eased);
          if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      };
      if (statNums.length) {
        observer = new IntersectionObserver((entries) => {
          entries.forEach((e) => { if (e.isIntersecting) animate(e.target); });
        }, { threshold: 0.4 });
        statNums.forEach((n) => observer.observe(n));
      }
    }
    return () => {
      cancelAnimationFrame(raf1);
      if (observer) observer.disconnect();
    };
  }, [rootRef]);
}

// Workout / rest timer ticker on the first phone mock. Updates the
// readouts every second. Cheap and decorative — pauses if the user
// has reduced-motion enabled.
function useLiveTimers() {
  const [workSec, setWorkSec] = useState(42 * 60 + 18);
  const [restSec, setRestSec] = useState(83);
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    const id = setInterval(() => {
      setWorkSec((s) => s + 1);
      setRestSec((s) => (s <= 0 ? 105 : s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, []);
  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  return { workTime: fmt(workSec), restTime: fmt(restSec) };
}

// Bottom-nav matches the in-app shell: Workouts / Calendar / Utilities /
// Profile. Tab icons are inline SVG mirrored from the design bundle.
function PhoneBottomNav({ active = 'workouts' }) {
  const tabs = [
    {
      id: 'workouts',
      label: 'Workouts',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6.5 6.5l11 11" />
          <path d="M21 21l-1-1" />
          <path d="M3 3l1 1" />
          <path d="M18 22l4-4" />
          <path d="M2 6l4-4" />
          <path d="M3 10l7-7" />
          <path d="M14 21l7-7" />
        </svg>
      ),
    },
    {
      id: 'calendar',
      label: 'Calendar',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      ),
    },
    {
      id: 'utilities',
      label: 'Utilities',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
        </svg>
      ),
    },
    {
      id: 'profile',
      label: 'Profile',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
    },
  ];
  return (
    <div className="lp-bn">
      {tabs.map((t) => (
        <div key={t.id} className={`lp-bn-tab ${t.id === active ? 'lp-active' : ''}`}>
          {t.id === active && <span className="lp-bn-accent" />}
          <span className="lp-bn-icon">{t.icon}</span>
          <span className="lp-bn-label">{t.label}</span>
        </div>
      ))}
    </div>
  );
}

function PhoneStatusBar() {
  return (
    <div className="lp-phone-statusbar">
      <span>9:30</span>
      <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <span style={{ width: 16, height: 8, border: '1px solid #fff', borderRadius: 2, display: 'inline-block', position: 'relative' }}>
          <span style={{ position: 'absolute', inset: 1, background: '#fff', borderRadius: 1, width: '80%' }} />
        </span>
      </span>
    </div>
  );
}

export default function LandingPageTest() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const rootRef = useRef(null);
  useLandingFx(rootRef);
  const { workTime, restTime } = useLiveTimers();

  // Used by both the nav and the hero primary CTA. Signed-in visitors
  // get a direct hop to /app; signed-out visitors land in the login
  // flow. The single source of truth lives in AuthContext.
  const primaryCta = isAuthenticated
    ? { label: 'Go to Web App', target: '/app' }
    : { label: 'Log In', target: '/login' };

  const heroCta = isAuthenticated
    ? { label: 'Open Web App', target: '/app' }
    : { label: 'Log In', target: '/login' };

  // Non-clickable store button helpers — preserve hover transitions via
  // the .lp-btn-red base class but block the click and show a not-allowed
  // cursor. The hero + bottom-strip use the shared AppStoreBadges
  // component (already disabled), so this is only for the nav's "Get the
  // App" CTA which needs to fit the small nav-bar footprint.
  const swallow = (e) => { e.preventDefault(); };

  return (
    <div ref={rootRef} className="lp-root min-h-screen">
      <style>{LANDING_STYLES}</style>

      {/* ============== NAV ============== */}
      <nav className="lp-nav">
        <div className="lp-nav-inner">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="lp-brand"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            aria-label="REPLAB home"
          >
            <span className="lp-brand-mark">
              <img src="/landing-logo-mark.png" alt="" />
            </span>
            <span className="lp-brand-word">REP<span>LAB</span></span>
          </button>
          <div className="lp-nav-cta">
            <div className="lp-lang">
              <span className="lp-on">EN</span>
              <span className="lp-sep">/</span>
              <span>ES</span>
            </div>
            {/* Primary CTA — red filled. When signed in this is "Go to Web App"
                and visually matches the hero "Open Web App" button (also red);
                when signed out it's a red "Log In" so the most important
                action in the nav reads as the brand-colored pill. */}
            <button
              type="button"
              className="lp-btn lp-btn-red"
              onClick={() => navigate(primaryCta.target)}
            >
              {primaryCta.label}
            </button>
            {/* "Get the App" — ghost outline (was red previously). Non-clickable
                until the apps are live in their stores; the styling swap with
                primaryCta puts visual weight on the action that actually
                works right now. */}
            <button
              type="button"
              className="lp-btn lp-btn-ghost lp-disabled"
              onClick={swallow}
              aria-disabled="true"
              title="Coming soon to the App Store and Google Play"
            >
              Get the App <span className="lp-arrow">↗</span>
            </button>
          </div>
        </div>
      </nav>

      {/* ============== HERO ============== */}
      <header className="lp-hero">
        <div className="lp-hero-glow" />
        <div className="lp-hero-grid-bg" />
        <div className="lp-container">
          <div className="lp-hero-grid">
            <div className="lp-hero-left">
              <div className="lp-eyebrow lp-fade lp-fade-1">Strength · Hypertrophy · Conditioning</div>
              <h1 className="lp-h1">
                <span className="lp-word lp-d1"><i>Outlift</i></span><br />
                <span className="lp-word lp-d2"><i className="lp-red">Yesterday.</i></span><br />
                <span className="lp-word lp-d3"><i className="lp-stroke">Every</i></span>{' '}
                <span className="lp-word lp-d4"><i>Day.</i></span>
              </h1>
              <p className="lp-hero-lede lp-fade lp-fade-2">
                REPLAB is the lifter's logbook. Plan your splits, log every set, and chase progressive overload. No matter where you start, progress is built one workout at a time.
              </p>
              <div className="lp-hero-cta lp-fade lp-fade-3">
                <button
                  type="button"
                  className="lp-btn lp-btn-red lp-btn-hero"
                  onClick={() => navigate(heroCta.target)}
                >
                  {heroCta.label} <span className="lp-arrow">↗</span>
                </button>
              </div>
              {/* Hero store badges — shared component, already disabled +
                  hover-preserved. Bottom-of-page badges reuse the SAME
                  component so the visual treatment can't drift. */}
              <div className="lp-hero-badges lp-fade lp-fade-4">
                <AppStoreBadges />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ============== MARQUEE ============== */}
      <div className="lp-marquee" aria-hidden="true">
        <div className="lp-marquee-track">
          {Array.from({ length: 2 }).flatMap((_, dup) => (
            [
              'Progressive Overload',
              'PR Auto-Detection',
              'Plate Calculator',
              '1RM Estimator',
              'Full-Screen Workout Mode',
              '322 Exercises',
              'HIIT & Rest Timers',
              'Cross-Device Sync',
            ].map((t, i) => (
              <span key={`${dup}-${i}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 60 }}>
                <span>{t}</span>
                <span className="lp-dot">●</span>
              </span>
            ))
          ))}
        </div>
      </div>

      {/* ============== APP TOUR ============== */}
      <section className="lp-section">
        <div className="lp-section-tag">// Section 01</div>
        <div className="lp-container">
          <div className="lp-section-head">
            <h2>Built For<br />The Gym <span className="lp-red">Floor.</span></h2>
            <p className="lp-desc">One-handed. Glove-friendly. Lock-screen ready. Every screen earns its place. The loop that matters — plan, log, progress — and nothing else.</p>
          </div>

          <div className="lp-tour">
            {/* PHONE 1: WORKOUT SESSION */}
            <div className="lp-phone">
              <div className="lp-phone-frame">
                <div className="lp-phone-screen">
                  <div className="lp-phone-notch" />
                  <PhoneStatusBar />
                  <div className="lp-app-session">
                    <div className="lp-as-head">
                      <div className="lp-as-back">‹ Back</div>
                      <div className="lp-as-mid">
                        <div className="lp-as-prog">Will's Hypertrophy</div>
                        <div className="lp-as-name">Push Day · Week 3</div>
                      </div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', width: 14, textAlign: 'center' }}>⚙</div>
                    </div>
                    <div className="lp-as-card">
                      <div className="lp-as-accent" />
                      <div className="lp-as-trow">
                        <div className="lp-as-pulse" />
                        <div className="lp-as-tlabel">WORKOUT</div>
                        <div className="lp-as-tval">{workTime}</div>
                        <div className="lp-as-tflex" />
                      </div>
                    </div>
                    <div className="lp-as-card">
                      <div className="lp-as-progress"><div style={{ width: '62%' }} /></div>
                      <div className="lp-as-trow">
                        <div className="lp-as-pulse lp-red" />
                        <div className="lp-as-tlabel lp-red">REST</div>
                        <div className="lp-as-tval" style={{ color: '#fff' }}>{restTime}</div>
                        <div className="lp-as-tflex" />
                        <div className="lp-as-pill">−15</div>
                        <div className="lp-as-pill lp-plus">+15</div>
                      </div>
                    </div>
                    <div className="lp-ec lp-current">
                      <div className="lp-ec-head">
                        <div className="lp-ec-name">Barbell Bench Press</div>
                        <div className="lp-ec-actions">
                          <span className="lp-ec-action">PC</span>
                          <span className="lp-ec-action">★ PRs</span>
                          <span className="lp-ec-action">▶ Demo</span>
                        </div>
                      </div>
                      <div className="lp-ec-cols">
                        <div>Set</div>
                        <div>Type</div>
                        <div>Goal</div>
                        <div>Actual</div>
                        <div>Reps</div>
                      </div>
                      {[
                        { done: true, set: 1, type: 'Normal', goal: '185', actual: '185', reps: '8' },
                        { done: true, set: 2, type: 'Normal', goal: '185', actual: '185', reps: '8' },
                        { active: true, set: 3, type: 'Normal', goal: '185', actual: '185', reps: '—' },
                        { set: 4, type: 'Normal', goal: '185', actual: '—', reps: '—' },
                        { set: 5, type: 'Drop', goal: '155', actual: '—', reps: '—' },
                      ].map((r, i) => (
                        <div key={i} className={`lp-ec-row ${r.active ? 'lp-active' : ''}`}>
                          <span className={`lp-ec-check ${r.done ? 'lp-done' : ''}`}>{r.done ? '✓' : ''}</span>
                          <span className="lp-ec-type">{r.type}</span>
                          <span className="lp-ec-goal">{r.goal}</span>
                          <span className={`lp-ec-input ${r.actual === '—' ? 'lp-empty' : ''}`}>{r.actual}</span>
                          <span className={`lp-ec-input ${r.reps === '—' ? 'lp-empty' : ''}`}>{r.reps}</span>
                        </div>
                      ))}
                    </div>
                    <PhoneBottomNav active="workouts" />
                  </div>
                </div>
              </div>
              <div className="lp-phone-meta">
                <span className="lp-num">01</span>
                <div>
                  <div className="lp-mtitle">Log.</div>
                  <div className="lp-mdesc">Plan your week, hit "Start", and log every set as you go. PRs auto-detect by weight, reps, and volume.</div>
                </div>
              </div>
            </div>

            {/* PHONE 2: PROGRESS */}
            <div className="lp-phone">
              <div className="lp-phone-frame">
                <div className="lp-phone-screen">
                  <div className="lp-phone-notch" />
                  <PhoneStatusBar />
                  <div className="lp-app-prog">
                    <div className="lp-ap-header">
                      <div className="lp-ap-title">PROGRESS</div>
                      <div className="lp-ap-back">BACK</div>
                    </div>
                    <div className="lp-ap-card">
                      <div className="lp-ap-stripe" />
                      <div className="lp-ap-glow" />
                      <div className="lp-ap-body">
                        <div className="lp-ap-eyebrow">LAST 30 DAYS</div>
                        <div className="lp-ap-grid">
                          <div>
                            <div className="lp-ap-num">14</div>
                            <div className="lp-ap-lbl">Sessions</div>
                          </div>
                          <div>
                            <div className="lp-ap-num">42</div>
                            <div className="lp-ap-lbl">Exercises</div>
                          </div>
                          <div>
                            <div className="lp-ap-num lp-green">+74</div>
                            <div className="lp-ap-lbl">Reps Gained</div>
                          </div>
                        </div>
                        <div className="lp-ap-jump">
                          <div className="lp-ap-jump-lbl">BIGGEST JUMP</div>
                          <div className="lp-ap-jump-name">Barbell Bench Press <span className="lp-ap-jump-delta">+8 reps · 185 lbs</span></div>
                        </div>
                      </div>
                    </div>
                    <div className="lp-ap-card">
                      <div className="lp-ap-stripe" />
                      <div className="lp-ap-body">
                        <div className="lp-ap-eyebrow">PROGRESSIVE OVERLOAD</div>
                        <div className="lp-ap-h">SAME WEIGHT.<br />MORE REPS?</div>
                        <div className="lp-ap-legend">
                          <span className="lp-ap-leg"><span className="lp-ap-dot" style={{ background: '#22c55e' }} /><span style={{ color: '#86efac' }}>Up</span></span>
                          <span className="lp-ap-leg"><span className="lp-ap-dot" style={{ background: '#eab308' }} /><span style={{ color: '#fcd34d' }}>Flat</span></span>
                          <span className="lp-ap-leg"><span className="lp-ap-dot" style={{ background: '#ef4444' }} /><span style={{ color: '#fca5a5' }}>Down</span></span>
                          <span className="lp-ap-leg"><span className="lp-ap-dot" style={{ background: '#9ca3af' }} /><span style={{ color: 'rgba(255,255,255,0.55)' }}>New</span></span>
                        </div>
                      </div>
                    </div>
                    <div className="lp-ap-chips">
                      <button className="lp-ap-chip lp-on">All <span>42</span></button>
                      <button className="lp-ap-chip">Chest <span>8</span></button>
                      <button className="lp-ap-chip">Back <span>7</span></button>
                      <button className="lp-ap-chip">Legs <span>6</span></button>
                    </div>
                    <div className="lp-ap-card">
                      <div className="lp-ap-body" style={{ padding: 11 }}>
                        <div className="lp-ap-row">
                          <div className="lp-ap-row-head">
                            <span className="lp-ap-ex">Bench Press</span>
                            <span className="lp-ap-w">185 lbs</span>
                          </div>
                          <div className="lp-ap-pr">
                            <span className="lp-ap-date">May 12</span>
                            <span className="lp-ap-pill lp-same">8</span>
                            <span className="lp-ap-pill lp-same">7</span>
                            <span className="lp-ap-pill lp-same">6</span>
                            <span className="lp-ap-pill lp-same">5</span>
                          </div>
                          <div className="lp-ap-pr">
                            <span className="lp-ap-date">May 19</span>
                            <span className="lp-ap-pill lp-up">9</span>
                            <span className="lp-ap-pill lp-up">8</span>
                            <span className="lp-ap-pill lp-same">6</span>
                            <span className="lp-ap-pill lp-up">6</span>
                          </div>
                        </div>
                        <div className="lp-ap-row">
                          <div className="lp-ap-row-head">
                            <span className="lp-ap-ex">Incline DB Press</span>
                            <span className="lp-ap-w">60 lbs</span>
                          </div>
                          <div className="lp-ap-pr">
                            <span className="lp-ap-date">May 14</span>
                            <span className="lp-ap-pill lp-same">10</span>
                            <span className="lp-ap-pill lp-same">8</span>
                            <span className="lp-ap-pill lp-same">7</span>
                          </div>
                          <div className="lp-ap-pr">
                            <span className="lp-ap-date">May 21</span>
                            <span className="lp-ap-pill lp-up">11</span>
                            <span className="lp-ap-pill lp-up">9</span>
                            <span className="lp-ap-pill lp-down">6</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <PhoneBottomNav active="utilities" />
                  </div>
                </div>
              </div>
              <div className="lp-phone-meta">
                <span className="lp-num">02</span>
                <div>
                  <div className="lp-mtitle">Progress.</div>
                  <div className="lp-mdesc">Exercise-by-exercise progressive overload. Live charts of estimated 1RM, volume, and reps gained — the numbers that move.</div>
                </div>
              </div>
            </div>

            {/* PHONE 3: PLATE CALCULATOR */}
            <div className="lp-phone">
              <div className="lp-phone-frame">
                <div className="lp-phone-screen">
                  <div className="lp-phone-notch" />
                  <PhoneStatusBar />
                  <div className="lp-app-pc">
                    <div className="lp-pc-head">
                      <div>
                        <div className="lp-pc-title">Plate Calc</div>
                        <div className="lp-pc-sub">Barbell · 45 LB</div>
                      </div>
                      <div className="lp-pc-btn">⚖</div>
                    </div>
                    <div className="lp-pc-top">
                      <div className="lp-pc-tlbl">Target Weight</div>
                      <div className="lp-pc-target">315<small>LB</small></div>
                    </div>
                    <div className="lp-pc-modes">
                      <div className="lp-pc-mode lp-active">Both Sides</div>
                      <div className="lp-pc-mode">One Side</div>
                      <div className="lp-pc-mode">Machine</div>
                    </div>
                    <div className="lp-pc-bar">
                      <div className="lp-pc-line" />
                      <div className="lp-pc-plates">
                        <div className="lp-pc-plate lp-pc-p5">5</div>
                        <div className="lp-pc-plate lp-pc-p10">10</div>
                        <div className="lp-pc-plate lp-pc-p25">25</div>
                        <div className="lp-pc-plate lp-pc-p45">45</div>
                        <div className="lp-pc-plate lp-pc-p45">45</div>
                        <div style={{ width: 30 }} />
                        <div className="lp-pc-plate lp-pc-p45">45</div>
                        <div className="lp-pc-plate lp-pc-p45">45</div>
                        <div className="lp-pc-plate lp-pc-p25">25</div>
                        <div className="lp-pc-plate lp-pc-p10">10</div>
                        <div className="lp-pc-plate lp-pc-p5">5</div>
                      </div>
                    </div>
                    <div className="lp-pc-list">
                      <div className="lp-pc-row"><span className="lp-l">2 × 45 LB</span><span className="lp-r">180 LB</span></div>
                      <div className="lp-pc-row"><span className="lp-l">1 × 25 LB</span><span className="lp-r">50 LB</span></div>
                      <div className="lp-pc-row"><span className="lp-l">1 × 10 LB</span><span className="lp-r">20 LB</span></div>
                      <div className="lp-pc-row"><span className="lp-l">1 × 5 LB</span><span className="lp-r">10 LB</span></div>
                      <div className="lp-pc-row lp-tot"><span className="lp-l">BAR + PLATES</span><span className="lp-r">315 LB</span></div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="lp-phone-meta">
                <span className="lp-num">03</span>
                <div>
                  <div className="lp-mtitle">Load.</div>
                  <div className="lp-mdesc">Long-press any weight mid-session and REPLAB shows you the exact plates to load. Both Sides, One Side, Machine — handled.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============== STATS ============== */}
      <section style={{ borderTop: '1px solid rgba(245,245,242,0.10)', position: 'relative', overflow: 'hidden' }}>
        <div className="lp-stats">
          <div className="lp-stat">
            <div className="lp-stat-tag">// 01</div>
            <div className="lp-stat-num" data-lp-count-to="322" data-lp-start-at="0">0</div>
            <div className="lp-stat-label lp-label-flash" style={{ '--lp-flash-period': '2s', '--lp-flash-delay': '0s' }}>Exercises in the Library</div>
          </div>
          <div className="lp-stat">
            <div className="lp-stat-tag">// 02</div>
            <div className="lp-stat-num lp-red" data-lp-count-to="9" data-lp-start-at="450">0</div>
            <div className="lp-stat-label lp-label-flash" style={{ '--lp-flash-period': '1.5s', '--lp-flash-delay': '0.25s' }}>Pro Coach Programs</div>
          </div>
          <div className="lp-stat">
            <div className="lp-stat-tag">// 03</div>
            <div className="lp-stat-num lp-stroke">0</div>
            <div className="lp-stat-label lp-label-flash" style={{ '--lp-flash-period': '0.75s', '--lp-flash-delay': '0.5s' }}>Ads · Bloat · BS</div>
          </div>
        </div>
      </section>

      {/* ============== PRO ============== */}
      <div className="lp-pro-wrap">
        <div className="lp-container">
          <div className="lp-pro">
            <div>
              <div className="lp-pro-tag">
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#e10600' }} /> REPLAB PRO
              </div>
              <h2>Smarter Programming.<br /><span className="lp-red">On Demand.</span></h2>
              <p className="lp-pro-lede">
                Pro unlocks AI workout generation that adapts to your equipment and recovery, advanced overload analytics, trainer hand-off, and priority feature drops. First 1,000 lifters get founder pricing for life.
              </p>
              <div style={{ marginTop: 32, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Waiting-list CTA — routes to /waiting-list regardless of
                    auth state. .btn-liquid is the app's red <-> white animated
                    flowing-gradient class from index.css; replaces the static
                    .lp-btn-red so this Pro CTA visually stands out from
                    every other red button on the page. */}
                <button
                  type="button"
                  className="lp-btn btn-liquid"
                  onClick={() => navigate('/waiting-list')}
                >
                  Join the Waiting List <span className="lp-arrow">↗</span>
                </button>
              </div>
            </div>
            <div className="lp-pro-right">
              <div className="lp-pro-sweep" />
              <h3>// What You Unlock</h3>
              <ul className="lp-pro-features">
                <li><span className="lp-pro-check">✓</span> AI-Generated Workouts</li>
                <li><span className="lp-pro-check">✓</span> Advanced Overload &amp; Fatigue Charts</li>
                <li><span className="lp-pro-check">✓</span> Trainer Hand-off &amp; Client Programs</li>
                <li><span className="lp-pro-check">✓</span> Custom Periodization Templates</li>
                <li><span className="lp-pro-check">✓</span> Founder Pricing · Locked Forever</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* ============== DOWNLOAD ============== */}
      <section className="lp-download">
        <div className="lp-download-bg" />
        <div className="lp-container lp-download-inner">
          <div className="lp-eyebrow" style={{ marginBottom: 32, justifyContent: 'center', display: 'inline-flex' }}>
            Available Now
          </div>
          <h2>Stop<br />Tracking.<br /><span className="lp-red">Start</span> <span className="lp-stroke">Lifting.</span></h2>
          <p>REPLAB is free on iOS, Android, and the web. Your data syncs across every device. One logbook. Everywhere you train.</p>
          {/* Bottom store badges — SAME shared component as the hero so
              the visual treatment cannot drift. Non-clickable, hover
              preserved. */}
          <div style={{ marginTop: 56 }}>
            <AppStoreBadges />
          </div>
        </div>
      </section>

      {/* ============== FOOTER ============== */}
      <footer className="lp-footer">
        <div className="lp-container">
          <div className="lp-foot-top">
            <div className="lp-foot-brand">
              <div className="lp-brand">
                <span className="lp-brand-mark">
                  <img src="/landing-logo-mark.png" alt="" />
                </span>
                <span className="lp-brand-word">REP<span>LAB</span></span>
              </div>
              <p>The lifter's logbook. Strength &amp; hypertrophy coach for people who actually train.</p>
            </div>
            <div className="lp-foot-col">
              <h4>Company</h4>
              <ul>
                <li><a href="https://arkitechsystems.com" target="_blank" rel="noopener noreferrer">About</a></li>
                <li><a href="mailto:support@replab-fitness.com">Contact</a></li>
                <li><button type="button" onClick={() => navigate('/userguide')}>User Guide</button></li>
              </ul>
            </div>
            <div className="lp-foot-col">
              <h4>Legal</h4>
              <ul>
                <li><button type="button" onClick={() => navigate('/privacy')}>Privacy</button></li>
                <li><button type="button" onClick={() => navigate('/terms')}>Terms</button></li>
              </ul>
            </div>
          </div>
          <div className="lp-foot-base">
            <div>© {new Date().getFullYear()} ArkiTech Systems LLC · All Rights Reserved</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
