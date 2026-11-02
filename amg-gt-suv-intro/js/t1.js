/*
 * T1 — launch segment (after the intro). Scroll-scrubbed clip + WebGL FX + launch sound.
 *
 * Two frame sources, same timeline:
 *  - desktop / tablets: <video> assets/video/t1_{hd,sd} (all-intra-ish GOP 2, whole file in memory, seeked)
 *  - phones (coarse pointer, short side <= 820 px): assets/seq/t1_m.{bin,json} — 130 WebP frames 1280x720 (4.3 MB)
 *    streamed progressively; each frame decoded with createImageBitmap (frame-exact, no iOS <video> seek jank),
 *    small LRU of decoded frames + look-ahead. Frame blending for sub-frame smoothness.
 * S1 end hold: a real-footage driving loop generated from T1's own last frame (S1 config below: desktop <video loop>, phones
 * a WebP sequence decoded on the fly). Handoff (S1.cut, c 5.355–5.37): a straight cut on the identical frame (loop frame 0 ==
 * T1 frame 129). Without `cut`, the old warp + road dissolve + masked car swap (S1.win / S1.fit) is used. The old ping-pong /
 * 110→124 crossfade hold only runs if the loop assets are missing (?noloop forces it).
 * Clip time c (s): 0…0.5 zoom-matched crossfade from the intro · 0…1.28 build (scrub) · 1.28 commit (real time,
 * sound in sync) · 1.38–1.9 hit FX masking the source jump · 1.6–3.1 pull-back streaks · end hold (loop).
 * Scroll: down auto-advances to the next stop (snap / commit); up never snaps or auto-plays — it scrubs back exactly as far
 * as the user scrolls (a running launch is interrupted) and stays there. End hold: looping cruise sound (t1_cruise) crossfaded
 * from the launch tail, faded out when scrubbing back.
 * First scroll: T1 is fetched during the intro (desktop: progressive fragmented-MP4 via MediaSource, frames usable as they
 * arrive; phones: streamed WebP), GL + first frames are pre-warmed, a down scroll plays on immediately in real time
 * (velocity-continuous, no snap pause) as soon as the download is predicted to keep ahead; a scroll that arrives
 * before the gate / data is latched and replayed. At rest every motion FX (shake, blur, shutter, CA, defocus) settles
 * to zero, grain freezes, the clip rests on an exact frame (no blend / seek ghost) and the S1 loop pauses while scrubbing.
 * prefers-reduced-motion / ?nomotion: soft flash only. Debug: ?t1=<c> freeze, ?t1play open the gate, ?mobile / ?desktop, ?loop enables the experimental coded road loop, ?roadt=<s> its clock.
 */
(() => {
  'use strict';
  const I = window.AMGIntro;
  if (!I) return;
  const params = new URLSearchParams(location.search);
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches || params.has('nomotion');
  const shortSide = Math.min(screen.width || innerWidth, screen.height || innerHeight, Math.max(innerWidth, innerHeight));
  let MOBILE = params.has('mobile') || (!params.has('desktop') && !params.has('hd') && !params.has('sd') &&
    window.matchMedia('(pointer: coarse)').matches && shortSide <= 820);
  document.documentElement.classList.toggle('is-mobile', MOBILE);

  const T = {
    fps: 24, end: 5.40, commit: 1.28, hit: 1.47,
    cueC: 1.35,                 // clip time at which the cue starts (its launch transient, cue 0.10–0.15 s, lands on the hit)
    xfEnd: 0.30, zmEnd: 0.50,   // crossfade / zoom-match ranges
    hold: [4.80, 5.40], holdPeriod: 3.2,                 // desktop ping-pong
    gateT: 8.0,
    pxPerSec: 650, touchMul: 2.2, touchMin: 5,
  };
  // mobile hold: crossfade loop over frames 110…124 (4.58–5.17 s); the 3 frames at 124 fade into the loop start.
  // The loop start is re-aligned onto the loop end (car drifts left / perspective) and the alignment eases out over
  // the loop, so the car stays put while the road keeps rushing.
  const LOOP = { a: 110, b: 124, x: 3, al: { cx: 500 / 1280, cy: 400 / 720, s: 0.95, tx: -118 / 1280 } };
  // S1 end hold — to swap the loop clip, change only this entry. Build the assets with
  //   python3 tools/make_s1_loop.py <clip>   (loop.mp4 + loop_m.{bin,json} 1024 px + loop_m2 1280 px for DPR >= 2 phones)
  //   python3 tools/fit_s1_loop.py <clip>    (loop_mask.png, prints `fit`)
  const S1 = { video: 'assets/s1/loop.mp4', seq: 'assets/s1/loop_m', seq2: 'assets/s1/loop_m2', mask: 'assets/s1/loop_mask.png',
    fit: { s: 1, tx: 0, ty: 0 },
    // the loop is generated FROM T1's last frame (loop frame 0 == T1 frame 129, same pixels): the handoff is a straight cut
    // on that identical frame — no alignment move, no mask, no dissolve. (`win` = the old warp/dissolve handoff, unused with `cut`)
    cut: [5.355, 5.37],
    win: { a: [4.80, 5.25], bg: [4.92, 5.32], car: [5.14, 5.35] } };
  const NOLOOP = params.has('noloop');
  const ZM = { z: 1.085, k: [951, 678], v: [936, 671] };
  const GT0 = 1.25, GT = [598,598,599,599,616,549,503,454,446,449,452,459,457,456,459,471,482,485,487,488,490,492,495,497,496];
  const COMP_K = 0.65;
  const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  // ------------------------------------------------------------------ DOM
  const stage = document.getElementById('stage');
  const cv = document.createElement('canvas');
  cv.id = 't1'; cv.setAttribute('aria-hidden', 'true');
  stage.appendChild(cv);
  const loadBar = document.createElement('div');
  loadBar.className = 't1-load'; loadBar.setAttribute('aria-hidden', 'true'); loadBar.innerHTML = '<i></i>';
  document.body.appendChild(loadBar);
  let vReady = false, loaded = 0, vSet = null;      // loaded: 0..1
  const perf = { t0: performance.now(), firstFrameMs: null, fullMs: null, decodes: 0, decodeMs: 0, decodeMax: 0, seeks: 0, seekMs: 0, seekMax: 0 };

  // ------------------------------------------------------------------ source A: <video> (desktop / tablet)
  const video = document.createElement('video');
  video.muted = true; video.defaultMuted = true; video.playsInline = true;
  video.setAttribute('playsinline', ''); video.setAttribute('webkit-playsinline', ''); video.setAttribute('muted', '');
  video.preload = 'auto'; video.crossOrigin = 'anonymous';
  const SAVE = !!(navigator.connection && navigator.connection.saveData);
  function pickVideo() {               // HD whenever possible (progressive, so no wait); SD only for Save-Data
    if (params.has('hd')) return 'hd';
    if (params.has('sd')) return 'sd';
    return SAVE ? 'sd' : 'hd';
  }
  // HD as fragmented MP4 (2 frames / fragment), split for the CDN; appended to a MediaSource while it streams
  const HDF = { parts: ['assets/video/t1_hdf.part0', 'assets/video/t1_hdf.part1'], bytes: 11828585, type: 'video/mp4; codecs="avc1.640032"' };
  const net = { got: 0, t1: 0, rate: 0, bufEnd: 0 };       // desktop progressive state (rate: bytes/ms)
  function onVData() { vReady = true; perf.firstFrameMs = performance.now() - perf.t0; document.documentElement.dataset.t1 = vSet; }
  function loadMSE() {
    return new Promise((res, rej) => {
      const ms = new MediaSource(); let sb = null, q = [], done = false;
      video.src = URL.createObjectURL(ms);
      const upd = () => { try { const b = sb.buffered; if (b.length) net.bufEnd = b.end(b.length - 1); } catch (e) {} loaded = Math.max(loaded, Math.min(0.998, net.bufEnd / T.end)); };
      const pump = () => {
        if (!sb || sb.updating) return;
        if (q.length) {
          const n = q.reduce((a, b) => a + b.length, 0), u = new Uint8Array(n); let o = 0;
          for (const b of q) { u.set(b, o); o += b.length; } q = [];
          try { sb.appendBuffer(u); } catch (e) { rej(e); }
        } else if (done) {
          if (ms.readyState === 'open') { try { ms.endOfStream(); } catch (e) {} }
          loaded = 1; perf.fullMs = performance.now() - perf.t0; loadLoopVideo(); res();
        }
      };
      ms.addEventListener('sourceopen', async () => {
        try {
          sb = ms.addSourceBuffer(HDF.type);
          sb.addEventListener('updateend', () => { upd(); pump(); });
          sb.addEventListener('error', () => rej(new Error('sourcebuffer')));
          const t0 = performance.now();
          for (const u of HDF.parts) {
            const r = await fetch(u); if (!r.ok) throw new Error(u + ' ' + r.status);
            const rd = r.body.getReader();
            for (;;) {
              const { done: d, value } = await rd.read(); if (d) break;
              if (!net.t1) net.t1 = performance.now();
              net.got += value.length; net.rate = net.got / Math.max(50, performance.now() - net.t1);
              q.push(value); pump();
            }
          }
          done = true; pump();
        } catch (e) { rej(e); }
      }, { once: true });
    });
  }
  async function loadVideo() {
    vSet = pickVideo();
    video.addEventListener('loadeddata', onVData, { once: true });
    if (vSet === 'hd' && !params.has('nomse') && window.MediaSource && MediaSource.isTypeSupported && MediaSource.isTypeSupported(HDF.type) && window.ReadableStream) {
      loadMSE().catch((e) => { console.warn('[t1] progressive HD failed, whole-file fallback', e); if (!vReady) loadBlob(); else loaded = 1; });
      return;
    }
    loadBlob();
  }
  async function loadBlob() {
    net.got = 0;
    const parts = vSet === 'hd' ? HDF.parts : ['assets/video/t1_sd.mp4'];
    let src = null;
    try {
      const bufs = await Promise.all(parts.map(async (u) => { const r = await fetch(u); if (!r.ok) throw new Error(u + ' ' + r.status); return r.arrayBuffer(); }));
      src = URL.createObjectURL(new Blob(bufs, { type: 'video/mp4' }));
    } catch (e) { console.warn('[t1] video fetch', e); }
    if (!src) { vSet = 'sd'; src = 'assets/video/t1_sd.mp4'; }
    video.src = src;
    video.addEventListener('loadeddata', () => { loaded = 1; perf.fullMs = performance.now() - perf.t0; if (!vReady) onVData(); }, { once: true });
    video.load();
    loadLoopVideo();
  }
  const lv = document.createElement('video');            // S1 loop (desktop)
  lv.muted = true; lv.defaultMuted = true; lv.playsInline = true; lv.loop = true; lv.preload = 'auto';
  lv.setAttribute('playsinline', ''); lv.setAttribute('webkit-playsinline', ''); lv.setAttribute('muted', '');
  let lvReady = false, lvPrimed = false;
  async function loadLoopVideo() {
    if (NOLOOP || lv.src) return;
    try { const r = await fetch(S1.video); if (!r.ok) throw new Error(S1.video + ' ' + r.status); lv.src = URL.createObjectURL(await r.blob()); }
    catch (e) { console.warn('[t1] loop video', e); return; }
    lv.addEventListener('canplaythrough', () => { lvReady = true; }, { once: true });
    lv.addEventListener('seeked', () => { vNew.l = 8; });
    lv.load();
  }
  let seeking = false, pendingSeek = null, seekT0 = 0;
  function seekTo(t) {
    if (MOBILE || !vReady) return;
    t = Math.max(0, Math.min(5.4, t));
    if (seeking) { pendingSeek = t; return; }
    if (Math.abs(video.currentTime - (t + 0.2 / T.fps)) < 0.5 / T.fps) return;
    seeking = true; seekT0 = performance.now(); video.currentTime = Math.min(5.4, t + 0.2 / T.fps);   // inside frame k's interval (exact frame)
  }
  const vNew = { v: 8, l: 8 };
  const rvfc = (el, k) => { if (!el.requestVideoFrameCallback) return; const f = () => { vNew[k] = Math.max(vNew[k], 3); el.requestVideoFrameCallback(f); }; el.requestVideoFrameCallback(f); };   // a newly presented frame (late decode after 'seeked') → re-upload                       // frames left to upload while paused (the decoded frame can land a few frames after 'seeked')
  if (!MOBILE) { rvfc(video, 'v'); rvfc(lv, 'l'); }
  video.addEventListener('seeked', () => {
    const ms = performance.now() - seekT0; perf.seeks++; perf.seekMs += ms; perf.seekMax = Math.max(perf.seekMax, ms);
    seeking = false; vNew.v = 8;
    if (pendingSeek !== null) { const t = pendingSeek; pendingSeek = null; seekTo(t); }
  });
  let primed = false;
  function prime() {           // iOS: a video must be played once inside a gesture before frames decode
    if (!MOBILE && !lvPrimed && lv.src) { lvPrimed = true; const q = lv.play(); if (q && q.then) q.then(() => { if (!loopRun) lv.pause(); }, () => { lvPrimed = false; }); }
    if (MOBILE || primed || !video.src) return;
    primed = true;
    const p = video.play();
    if (p && p.then) p.then(() => { if (mode !== 'play') { video.pause(); seekTo(c); } }, () => { primed = false; });
  }
  ['touchend', 'click', 'keydown', 'pointerup'].forEach((e) => window.addEventListener(e, prime, { capture: true, passive: true }));

  // ------------------------------------------------------------------ source B: WebP sequence (phones)
  // DPR >= 2 phones: 1600x900 q80 (≈1:1 on the canvas, 5.6 MB); others 1280x720 (4.3 MB)
  const HIRES = !SAVE && !params.has('lores') && ((window.devicePixelRatio || 1) >= 1.75 || params.has('hires'));
  const SEQ = HIRES ? 'assets/seq/t1_m2' : 'assets/seq/t1_m';
  const seq = { meta: null, buf: null, got: 0, t1: 0, rate: 0, bm: new Map(), pend: new Set(), use: new Map(), cap: HIRES ? 22 : 28 };
  async function loadSeq() {
    vSet = 'seq';
    try {
      seq.meta = await (await fetch(SEQ + '.json')).json();
      const M = seq.meta; seq.buf = new Uint8Array(M.bytes);
      const r = await fetch(SEQ + '.bin');
      if (!r.ok) throw new Error('seq ' + r.status);
      const onBytes = () => {
        loaded = seq.got / M.bytes;
        if (!vReady && avail(0)) { want(0); }
      };
      if (r.body && r.body.getReader) {
        const rd = r.body.getReader();
        for (;;) {
          const { done, value } = await rd.read();
          if (done) break;
          if (!seq.t1) seq.t1 = performance.now();
          seq.buf.set(value, seq.got); seq.got += value.length; seq.rate = seq.got / Math.max(50, performance.now() - seq.t1); onBytes();
        }
      } else { seq.buf.set(new Uint8Array(await r.arrayBuffer()), 0); seq.got = M.bytes; onBytes(); }
      perf.fullMs = performance.now() - perf.t0;
      document.documentElement.dataset.t1 = 'seq';
      loadLoopSeq();
    } catch (e) {
      console.warn('[t1] sequence failed, falling back to video', e);
      MOBILE_FALLBACK();
    }
  }
  // S1 loop (phones): whole .bin in memory, frames decoded just ahead of the loop playhead, small window kept
  const lseq = { meta: null, buf: null, bm: new Map(), pend: new Set(), shown: -1 };
  async function loadLoopSeq() {
    if (NOLOOP) return;
    try {
      const L = HIRES && S1.seq2 ? S1.seq2 : S1.seq;
      const M = await (await fetch(L + '.json')).json();
      const r = await fetch(L + '.bin'); if (!r.ok) throw new Error('loop seq ' + r.status);
      const b = new Uint8Array(await r.arrayBuffer()); if (b.length < M.bytes) throw new Error('loop seq short');
      lseq.meta = M; lseq.buf = b;
    } catch (e) { console.warn('[t1] loop sequence', e); }
  }
  function lwant(i) {
    const M = lseq.meta; i = ((i % M.n) + M.n) % M.n;
    const b = lseq.bm.get(i); if (b) return b;
    if (!lseq.pend.has(i) && typeof createImageBitmap === 'function') {
      lseq.pend.add(i); const [o, l] = M.f[i];
      createImageBitmap(new Blob([lseq.buf.subarray(o, o + l)], { type: M.type })).then((bm) => { lseq.pend.delete(i); lseq.bm.set(i, bm); },
        () => { lseq.pend.delete(i); });
    }
    return null;
  }
  function lkeep(i0) {
    const n = lseq.meta.n;
    for (const [k, b] of lseq.bm) { const d = ((k - i0) % n + n) % n; if (d > 8 && d < n - 2 && k !== lseq.shown) { if (b.close) b.close(); lseq.bm.delete(k); } }
  }
  const avail = (i) => seq.meta && i >= 0 && i < seq.meta.n && seq.meta.f[i][0] + seq.meta.f[i][1] <= seq.got;
  function want(i) {           // request a decoded frame (async); returns the bitmap if ready
    if (!seq.meta) return null;
    i = Math.max(0, Math.min(seq.meta.n - 1, i));
    const b = seq.bm.get(i);
    if (b) { seq.use.set(i, performance.now()); return b; }
    if (!seq.pend.has(i) && avail(i) && typeof createImageBitmap === 'function') {
      seq.pend.add(i);
      const [o, l] = seq.meta.f[i], t0 = performance.now();
      createImageBitmap(new Blob([seq.buf.subarray(o, o + l)], { type: seq.meta.type })).then((bm) => {
        const ms = performance.now() - t0; perf.decodes++; perf.decodeMs += ms; perf.decodeMax = Math.max(perf.decodeMax, ms);
        seq.pend.delete(i); seq.bm.set(i, bm); seq.use.set(i, performance.now());
        if (!vReady) { vReady = true; perf.firstFrameMs = performance.now() - perf.t0; }
        evict();
      }, (e) => { seq.pend.delete(i); console.warn('[t1] decode', i, e); });
    }
    return null;
  }
  function evict() {
    if (seq.bm.size <= seq.cap) return;
    const keep = new Set(protect);
    const order = [...seq.use.entries()].filter(([k]) => !keep.has(k)).sort((a, b) => a[1] - b[1]);
    while (seq.bm.size > seq.cap && order.length) {
      const [k] = order.shift(); const b = seq.bm.get(k);
      if (b && b.close) b.close(); seq.bm.delete(k); seq.use.delete(k);
    }
  }
  let protect = [];
  function nearest(i) {        // closest decoded frame (never show a blank while decoding catches up)
    if (seq.bm.has(i)) return i;
    for (let d = 1; d < 140; d++) { if (seq.bm.has(i - d)) return i - d; if (seq.bm.has(i + d)) return i + d; }
    return -1;
  }
  let MOBILE_FALLBACK = () => {};

  // ------------------------------------------------------------------ WebGL
  const gl = cv.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
  let U = {};
  const VS = `attribute vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }`;
  const FS = `precision highp float;
uniform sampler2D tex, tex2, texB;
uniform vec2 res; uniform vec4 rect; uniform vec4 lb;
uniform vec2 zc; uniform vec2 zv; uniform float zs;
uniform vec2 shake; uniform float blur, eblur, ca, bloom, lines, vig, alpha, time, grain, film, fb, xf;
uniform vec3 flash; uniform vec2 fc;
uniform vec2 sc; uniform vec4 pz; uniform vec4 al;                // al: loop alignment of the primary frame (cx, cy, s, tx)
uniform sampler2D texM; uniform vec3 gA; uniform vec4 lB; uniform float xfC;  // S1: T1-layer move (s,tx,ty) · loop-layer sample map (s,tx,ty,mask) · car swap
uniform vec2 mb; uniform float dfc, flare;     // mb: directional shutter blur · dfc: defocus
float h1(float n){ return fract(sin(n)*43758.5453); }
float h2(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
vec3 tap(vec2 uv){
  const vec2 cB = vec2(707.2 / 1920., 562.9 / 1080.);
  vec2 u0 = cB + (uv - cB - gA.yz) / gA.x;                       // S1 handoff: T1 layer carried onto the loop car
  vec2 ua = clamp(al.xy + (u0 - al.xy - vec2(al.w, 0.)) / al.z, vec2(0.0005), vec2(0.9995));
  vec3 a = texture2D(tex, ua).rgb;
  if (fb > 0.001) a = mix(a, texture2D(tex2, ua).rgb, fb);
  if (xf > 0.001 || xfC > 0.001) {
    vec2 ub = cB + (uv - cB) * lB.x + lB.yz;                     // loop layer, arriving with the inverse move
    vec2 uc = clamp(ub, vec2(0.0005), vec2(0.9995));
    vec4 bb = texture2D(texB, uc);
    float mk = lB.w > 0.5 ? texture2D(texM, uc).r : lB.w < -0.5 ? bb.a : 0.;   // car region swaps late (S1 mask / road alpha)
    vec2 e = smoothstep(vec2(-.002), vec2(.006), ub) * smoothstep(vec2(-.002), vec2(.006), 1. - ub);   // never show clamp smear
    a = mix(a, bb.rgb, mix(xf, xfC, mk) * e.x * e.y); }
  return a;
}
void main(){
  vec2 px = vec2(gl_FragCoord.x, res.y - gl_FragCoord.y);
  vec2 s = (px - rect.xy) / rect.zw;
  vec2 vp = s * vec2(1920., 1080.);
  vp = zv + (vp - zc) * zs;
  vp = pz.xy + (vp - sc) * pz.z;
  vec2 uv = vp / vec2(1920., 1080.) + shake;
  vec2 c = fc; vec2 d = uv - c; float L = length(d * vec2(1.7778, 1.));
  float bl = blur + eblur * smoothstep(.28, .95, L);            // zoom blur + (mobile) peripheral motion streaks
  vec3 col;
  if (bl > 0.001 || dot(mb, mb) > 1e-8) {
    col = vec3(0.); float wsum = 0.;
    for (int i = 0; i < 14; i++) { float f = float(i) / 13.; float w = 1. - abs(f - .5) * .8;
      col += tap(uv - d * bl * f + mb * (f - .5)) * w; wsum += w; }
    col /= wsum;
  } else col = tap(uv);
  if (dfc > 0.002) {                                           // rack focus: hexagonal-ish bokeh ring, highlights bloom
    vec3 b = vec3(0.);
    for (int i = 0; i < 12; i++) { float a = float(i) * .5236; vec2 o = vec2(cos(a), sin(a)) * vec2(.0056, .01) * dfc;
      vec3 t = tap(uv + o); b += t + t * t * 1.5; }
    col = mix(col, b / 12., min(1., dfc * 1.4));
  }
  if (ca > 0.0001) {
    col.r = mix(col.r, tap(uv + d * ca).r, .85);
    col.b = mix(col.b, tap(uv - d * ca).b, .85);
  }
  if (bloom > 0.001) {
    vec3 b = vec3(0.);
    for (int i = 0; i < 8; i++) { float a = float(i) * .785398; vec2 o = vec2(cos(a), sin(a)) * vec2(.012, .021);
      b += max(tap(uv + o) - .55, 0.) + max(tap(uv + o * 2.4) - .55, 0.); }
    col += b / 16. * bloom * 2.2;
  }
  if (flare > 0.001) {                                         // anamorphic-style horizontal streak from the hottest highlights
    vec3 b = vec3(0.);
    for (int i = 0; i < 12; i++) { float x = (float(i) - 5.5) / 5.5; b += max(tap(uv + vec2(x * .055 + d.x * .02, d.y * .02)) - .78, 0.) * (1. - abs(x) * .8); }
    col += b * vec3(.5, .68, 1.) * flare * .35;
  }
  if (lines > 0.001) {
    float a = atan(d.y, d.x * 1.7778);
    float k = floor(a * 70.);
    float r = h1(k * 1.37);
    float seg = fract(L * 2.2 - time * (2.4 + r * 2.2) + r * 7.);
    float th = smoothstep(.45, 0., abs(fract(a * 70.) - .5) * 2.) ;
    float on = step(.62, r) * smoothstep(.0, .35, seg) * smoothstep(1., .55, seg);
    col += vec3(.9, .92, 1.) * th * on * smoothstep(.22, .75, L) * lines * .55;
  }
  float fall = .55 + .45 * smoothstep(.9, 0., L);
  if (film > 0.) {                                             // filmic hit: exposure push + soft shoulder + halation
    float ex = dot(flash, vec3(.3333)) * 4.5 * fall;
    vec3 e = col * (1. + ex) + flash * .35 * fall;
    col = e / (1. + e * .55) * 1.55;
    col += vec3(.18, .02, .0) * smoothstep(.55, 1.4, dot(e, vec3(.3333))) * dot(flash, vec3(.3333));
  } else col += flash * fall;
  col *= 1. - vig * smoothstep(.35, 1.05, length((s - .5) * vec2(1.25, 1.)));
  if (grain > 0.) col += (h2(px + fract(time * 13.) * 91.) - .5) * grain;
  float m = 1.;
  vec2 q = px - rect.xy;
  if (lb.x > 0.) { m *= smoothstep(0., lb.x, q.y) * smoothstep(0., lb.y, rect.w - q.y); }
  if (lb.z > 0.) { m *= smoothstep(0., lb.z, q.x) * smoothstep(0., lb.w, rect.z - q.x); }
  if (s.x < 0. || s.y < 0. || s.x > 1. || s.y > 1.) m = 0.;
  if (pz.w > 0.) { vec2 e = smoothstep(vec2(0.), vec2(.05, .09), uv) * smoothstep(vec2(0.), vec2(.05, .12), 1. - uv); m *= mix(1., e.x * e.y, pz.w); }
  col = clamp(col * m, 0., 1.);
  gl_FragColor = vec4(col * alpha, alpha);
}`;
  const TX = [null, null, null, null], TXF = [-2, -2, -2, -2];   // textures for tex / tex2 / texB / texM and the frame each holds
  let prog = null, fsBuf = null;
  function bindFS() {
    gl.useProgram(prog); gl.bindBuffer(gl.ARRAY_BUFFER, fsBuf);
    const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  }
  function initGL() {
    if (!gl) return false;
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o);
      if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
    prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog); gl.useProgram(prog);
    fsBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, fsBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    bindFS();
    for (const n of ['tex', 'tex2', 'texB', 'texM', 'gA', 'lB', 'xfC', 'res', 'rect', 'lb', 'zc', 'zv', 'zs', 'shake', 'blur', 'eblur', 'ca', 'bloom', 'lines', 'vig', 'alpha',
      'time', 'grain', 'film', 'fb', 'xf', 'flash', 'fc', 'sc', 'pz', 'al', 'mb', 'dfc', 'flare'])
      U[n] = gl.getUniformLocation(prog, n);
    for (let k = 0; k < 4; k++) {
      TX[k] = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + k); gl.bindTexture(gl.TEXTURE_2D, TX[k]);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, new Uint8Array(3));
    }
    gl.uniform1i(U.tex, 0); gl.uniform1i(U.tex2, 1); gl.uniform1i(U.texB, 2); gl.uniform1i(U.texM, 3);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); }, false);
    cv.addEventListener('webglcontextrestored', () => { try { initGL(); TXF.fill(-2); } catch (err) {} }, false);
    return true;
  }
  let glOK = false;
  try { glOK = initGL(); } catch (e) { console.error('[t1] WebGL init failed, plain video fallback', e); glOK = false; }
  if (!glOK) { cv.remove(); video.className = 't1-fallback'; stage.appendChild(video); }
  // S1 road loop (js/t1loop.js): endless straight-road shot rendered live into a texture; the old frame hold stays as fallback
  let road = null;
  function startRoad() {
    if (road || !glOK || !window.AMGLoop || !params.has('loop')) return;   // coded road loop: opt-in only (?loop)
    try { road = window.AMGLoop(gl, { mobile: MOBILE }); } catch (e) { console.warn('[t1] road loop', e); road = null; }
    bindFS();
  }
  const roadOn = () => !!(road && road.ready && !road.err);
  // handoff alignment: the T1 frames n=114…129 registered onto the loop plate (frame 129) — similarity about the car
  const RAL = { 114: [1.0933, 154.4, 12.8], 115: [1.0947, 141.6, 12.3], 116: [1.092, 126.4, 12.3], 117: [1.088, 112, 12.3],
    118: [1.076, 93.6, 10.1], 119: [1.0733, 80, 10.1], 120: [1.056, 63.2, 9.1], 121: [1.0253, 42.4, 8.5], 122: [1.0173, 30.4, 7.5],
    123: [1.0173, 22.4, 6.4], 124: [1.012, 15.2, 5.9], 125: [1.0093, 9.6, 5.3], 126: [1.008, 5.6, 3.7], 127: [1.0013, 1.6, 2.1],
    128: [1.0027, 0, 1.1], 129: [1, 0, 0] };
  function roadAlign(cc) {
    const n = Math.max(114, Math.min(129, cc * T.fps)), i = Math.floor(n), j = Math.min(129, i + 1), f = n - i, A = RAL[i], B = RAL[j];
    return [A[0] + (B[0] - A[0]) * f, (A[1] + (B[1] - A[1]) * f) / 1920, (A[2] + (B[2] - A[2]) * f) / 1080];
  }
  const ROADT = params.has('roadt') ? parseFloat(params.get('roadt')) || 0 : null;   // debug: freeze the road-loop clock
  const RX = [5.06, 5.375];     // clip-time window of the video → road-loop dissolve (frames 121→129, ~0.3 s)
  // S1 loop state
  const maskImg = new Image(); let maskOK = false;
  if (!NOLOOP) { maskImg.onload = () => { maskOK = true; }; maskImg.src = S1.mask; }
  const loopReady = () => glOK && !NOLOOP && !roadOn() && (MOBILE ? !!lseq.buf : lvReady);
  let lAv = 0, loopRun = false, lT0 = 0;           // lAv: 0→1 once the loop is usable (no pop if it arrives late)
  MOBILE_FALLBACK = () => { if (!vReady) { MOBILE = false; document.documentElement.classList.remove('is-mobile'); loadVideo(); } };
  function upload(k, src, id) {
    if (TXF[k] === id && id >= 0) return;
    gl.activeTexture(gl.TEXTURE0 + k); gl.bindTexture(gl.TEXTURE_2D, TX[k]);
    try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, src); TXF[k] = id; } catch (e) {}
  }

  // canvas backing store: CSS px x min(dpr, 2) — the FX are soft, 3x buys nothing on a phone but costs 2.25x fill
  const cdpr = () => Math.min(window.devicePixelRatio || 1, 2);
  function resizeCv() {
    const v = I.view, d = cdpr();
    const W = Math.round(v.w * d), H = Math.round(v.h * d);
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  }
  window.addEventListener('resize', resizeCv);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', resizeCv);

  // ------------------------------------------------------------------ audio cue
  let cueBuf = null, cueMeta = null, cueSrc = null, cueGain = null;
  let clock = null;          // { ctx0, c0 } while the launch plays against the audio clock
  async function loadCue() {
    try {
      cueMeta = await (await fetch('assets/audio/t1_launch.json')).json();
      const ab = await (await fetch('assets/audio/t1_launch.mp3')).arrayBuffer();
      const tryDecode = () => {
        const ctx = I.audio.ctx; if (!ctx) { setTimeout(tryDecode, 300); return; }
        ctx.decodeAudioData(ab.slice(0), (b) => { cueBuf = b; }, (e) => console.warn('[t1] cue decode', e));
      };
      tryDecode();
    } catch (e) { console.warn('[t1] cue load', e); }
  }
  function audioLive() { const ctx = I.audio.ctx; return !!(ctx && ctx.state === 'running' && I.audioOn); }
  function startCue(offset, when) {
    const ctx = I.audio.ctx, out = I.audio.output;
    stopCue(0.02);
    if (!ctx || !out || !cueBuf || !audioLive()) return;
    cueSrc = ctx.createBufferSource(); cueSrc.buffer = cueBuf;
    cueGain = ctx.createGain(); cueGain.gain.value = 1;
    cueSrc.connect(cueGain).connect(out);
    const at = Math.max(ctx.currentTime + 0.01, when);
    const off = Math.max(0, offset + (at - when));
    if (off >= cueBuf.duration) { cueSrc = null; return; }
    if (off > 0.2) { cueGain.gain.setValueAtTime(0, at); cueGain.gain.linearRampToValueAtTime(1, at + 0.12); }   // resumed mid-sound: no click
    cueSrc.start(at, off);
  }
  function stopCue(fade) {
    if (!cueSrc) return;
    const ctx = I.audio.ctx, t = ctx.currentTime;
    try { cueGain.gain.cancelScheduledValues(t); cueGain.gain.setValueAtTime(cueGain.gain.value, t);
      cueGain.gain.linearRampToValueAtTime(0, t + fade); cueSrc.stop(t + fade + 0.05); } catch (e) {}
    cueSrc = null;
  }
  // cruise loop (end hold): file = the loop x3, played over [loop_start, loop_end) — period-exact, so decoder priming is harmless
  const CRUISE = { at: 4.0, fade: 2.0, gain: 0.85 };   // starts at cue time 4.0 (≈ hold), 2 s equal-power crossfade from the launch tail
  let crBuf = null, crMeta = null, crSrc = null, crGain = null;
  async function loadCruise() {
    try {
      crMeta = await (await fetch('assets/audio/t1_cruise.json')).json();
      const ab = await (await fetch('assets/audio/t1_cruise.mp3')).arrayBuffer();
      const tryDecode = () => {
        const ctx = I.audio.ctx; if (!ctx) { setTimeout(tryDecode, 300); return; }
        ctx.decodeAudioData(ab.slice(0), (b) => { crBuf = b; }, (e) => console.warn('[t1] cruise decode', e));
      };
      tryDecode();
    } catch (e) { console.warn('[t1] cruise load', e); }
  }
  function startCruise(when, fade) {
    const ctx = I.audio.ctx, out = I.audio.output;
    stopCruise(0.05);
    if (!ctx || !out || !crBuf || !crMeta || !audioLive()) return;
    const at = Math.max(ctx.currentTime + 0.02, when);
    crSrc = ctx.createBufferSource(); crSrc.buffer = crBuf; crSrc.loop = true;
    crSrc.loopStart = crMeta.loop_start; crSrc.loopEnd = crMeta.loop_end;
    crGain = ctx.createGain(); crGain.gain.value = 0;
    const n = 32, curve = new Float32Array(n);
    for (let i = 0; i < n; i++) curve[i] = CRUISE.gain * Math.sin((i / (n - 1)) * Math.PI / 2);
    try { crGain.gain.setValueCurveAtTime(curve, at, Math.max(0.1, fade)); } catch (e) { crGain.gain.setValueAtTime(CRUISE.gain, at); }
    crSrc.connect(crGain).connect(out);
    crSrc.start(at, crMeta.loop_start);
  }
  function stopCruise(fade) {
    if (!crSrc) return;
    const ctx = I.audio.ctx, t = ctx.currentTime;
    try { crGain.gain.cancelScheduledValues(t); crGain.gain.setValueAtTime(crGain.gain.value, t);
      crGain.gain.linearRampToValueAtTime(0, t + fade); crSrc.stop(t + fade + 0.05); } catch (e) {}
    crSrc = null;
  }
  function envAt(arr, tsec) {
    if (!cueMeta || !arr || tsec < 0) return 0;
    const x = tsec * cueMeta.rate, i = Math.floor(x);
    if (i >= arr.length - 1) return 0;
    return arr[i] + (arr[i + 1] - arr[i]) * (x - i);
  }

  // ------------------------------------------------------------------ state / input
  let mode = 'off';         // off | scrub | play | hold
  let c = 0, target = 0, lastInput = 0, playC0 = 0, playP0 = 0, holdP0 = 0, lastDy = 1, inertia = 0;
  const FREEZE = params.has('t1') ? Math.max(0, Math.min(T.end, parseFloat(params.get('t1')) || 0)) : null;
  const FREEZE_LOOPT = params.has('loopt') ? (parseFloat(params.get('loopt')) || 0) * 1000 + 0.001 : 0;   // debug: freeze the S1 loop clock (s)
  const FREEZE_HOLD = params.has('t1hold') ? parseFloat(params.get('t1hold')) || 0 : null;   // mobile loop phase test
  const ready = () => vReady && (!MOBILE || loaded > 0.999 || avail(Math.ceil(Math.min(target, T.commit) * T.fps) + 2));
  let userGo = false;          // the user scrolled down during the intro: T1 starts at once (no waiting for the gate)
  function gateOpen() { return FREEZE !== null || params.has('t1play') || userGo || I.now() >= T.gateT; }
  let pend = 0;               // down scroll that arrived before T1 could answer (intro gate / first frame): replayed then
  // how far the clip can be shown right now (streamed bytes)
  function availC() {
    if (loaded >= 0.999) return T.end;
    if (MOBILE) { let k = Math.min(seq.meta.n - 1, Math.floor(seq.got / seq.meta.bytes * seq.meta.n) + 1); while (k > 0 && !avail(k)) k--; return k / T.fps; }
    return Math.max(0, net.bufEnd - 2 / T.fps);
  }
  // real-time playback from c0 only if the rest of the clip is predicted to arrive before the playhead needs it
  function canPlay(c0) {
    if (loaded >= 0.999) return true;
    const R = (MOBILE ? seq.rate : net.rate) * 0.75; if (!(R > 0)) return false;
    const total = MOBILE ? seq.meta.bytes : HDF.bytes, got = MOBILE ? seq.got : net.got;
    for (let x = c0 + 0.25; x <= T.end + 0.001; x += 0.25) {
      const need = MOBILE ? (() => { const f = seq.meta.f[Math.min(seq.meta.n - 1, Math.ceil(x * T.fps))]; return f[0] + f[1]; })() : total * Math.min(1, x / T.end + 0.02);
      if ((need - got) / R > (x - c0) * 1000 - 200) return false;
    }
    return availC() > c0 + 0.1;
  }
  function input(dy) {
    if (FREEZE !== null) return;
    if (!gateOpen()) {                             // scroll during the intro: cut it short, T1 dissolves in over the current intro frame
      if (!(dy > 0 && mode === 'off' && I.now() > 0)) return;
      userGo = true; if (I.cutShort) I.cutShort();
    }
    if (!vReady) { if (dy > 0 && mode === 'off') { pend += dy; I.scrollStart(); } return; }
    lastInput = performance.now();
    if (mode === 'play' || mode === 'hold') {
      if (dy >= 0) return;                         // down: the launch / hold carries on
      // up: stop right here and scrub back exactly as far as the user scrolls (no auto-resume)
      mode = 'scrub'; target = c; inertia = 0; clock = null;
      if (!MOBILE) { video.pause(); seekTo(c); }
      stopCue(0.25); stopCruise(0.4);
    }
    if (mode === 'off' && dy <= 0) return;
    if (mode === 'off') { mode = 'scrub'; I.scrollStart(); if (!perf.in0) perf.in0 = lastInput; }
    goDown = dy > 0;                               // any down input, however small, commits the full run to the S1 stop
    lastDy = dy;
    target = Math.max(0, Math.min(T.end, target + dy / T.pxPerSec));
    if (dy > 0 && target < 1 / T.fps) target = 1 / T.fps;   // tiny input: at least one frame of visible motion at once
    if (dy > 0 && c < T.commit) target = Math.min(target, T.commit + 0.02);
    if (dy > 0 && loaded < 0.999) target = Math.min(target, Math.max(c, availC()));   // never scrub past what has streamed in
  }
  function commit() {
    if (!canPlay(c)) { waitPlay = true; return false; }   // the download must keep ahead of the playhead (bar shows progress)
    waitPlay = false;
    if (goDown && c < 1 / T.fps && target >= 1 / T.fps) c = 1 / T.fps;   // first motion frame at once (the audio clock lags a frame or two)
    mode = 'play'; target = T.end; inertia = 0;
    playC0 = c; playP0 = performance.now();
    const ctx = I.audio.ctx;
    clock = null;
    stopCruise(0.2);
    if (audioLive()) {
      const lead = 0.03;                           // schedule slightly ahead: no clipped attack, sample-exact sync
      clock = { ctx0: ctx.currentTime + lead, c0: playC0 };
      startCue(Math.max(0, playC0 - T.cueC), clock.ctx0 + Math.max(0, T.cueC - playC0));
      const late = Math.max(0, playC0 - T.cueC - CRUISE.at);          // committed from late in the clip: shorter fade
      startCruise(clock.ctx0 + Math.max(0, T.cueC + CRUISE.at - playC0), Math.max(0.6, CRUISE.fade - late));
    }
    if (!MOBILE) {                                 // no seek when the decoder already sits on this frame: no start hitch
      if (seeking || Math.abs(video.currentTime - playC0) > 1.5 / T.fps) { try { video.currentTime = playC0; } catch (e) {} }
      pendingSeek = null; const p = video.play(); if (p && p.catch) p.catch(() => {});
    }
    return true;
  }
  let waitPlay = false, goDown = false;
  let touchY = null, touchT = 0, vel = 0;
  window.addEventListener('wheel', (e) => {
    const k = e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? window.innerHeight : 1;
    input(e.deltaY * k);
  }, { passive: true });
  window.addEventListener('touchstart', (e) => { touchY = e.touches[0] ? e.touches[0].clientY : null; touchT = performance.now(); vel = 0; inertia = 0; }, { passive: true });
  window.addEventListener('touchmove', (e) => {
    if (touchY === null || !e.touches[0]) return;
    // at S0 a swipe starts T1 as soon as the finger has moved up T.touchMin px (on touchmove; smaller = tap jitter)
    if (mode === 'off' && touchY - e.touches[0].clientY < T.touchMin) return;
    const y = e.touches[0].clientY, now = performance.now(), dy = (touchY - y) * T.touchMul, dtm = Math.max(1, now - touchT);
    vel = vel * 0.6 + (dy / dtm) * 0.4;             // px/ms, smoothed
    input(dy); touchY = y; touchT = now;
  }, { passive: true });
  window.addEventListener('touchend', () => {
    if (performance.now() - touchT < 90 && Math.abs(vel) > 0.15) inertia = Math.max(-6, Math.min(6, vel));   // flick → momentum
    touchY = null;
  }, { passive: true });
  window.addEventListener('keydown', (e) => {
    const m = { ArrowDown: 120, PageDown: 600, ' ': 600, Spacebar: 600, End: 4000, ArrowUp: -120, PageUp: -600, Home: -4000 }[e.key];
    if (m) input(e.shiftKey && (e.key === ' ' || e.key === 'Spacebar') ? -m : m);
  });
  const replayBtn = document.getElementById('replay');
  if (replayBtn) replayBtn.addEventListener('click', () => { reset(); });
  function reset() { goDown = false; mode = 'off'; c = 0; target = 0; inertia = 0; pend = 0; stopCue(0.15); stopCruise(0.3); clock = null; if (!MOBILE) { video.pause(); seekTo(0); } }
  document.addEventListener('visibilitychange', () => {      // tab hidden mid-launch: resume cleanly on return
    if (!document.hidden && mode === 'play' && !clock) { playC0 = c; playP0 = performance.now(); }
  });

  // ------------------------------------------------------------------ FX curves
  function hitEnv(x) {
    if (x < 1.38) return 0;
    if (x < T.hit) { const u = (x - 1.38) / (T.hit - 1.38); return u * u; }
    return Math.exp(-(x - T.hit) / 0.09) * (1 - ss(1.9, 2.1, x));
  }
  function gtAt(x) {
    const i = Math.floor((x - GT0) * T.fps);
    if (i < 0) return GT[0]; if (i >= GT.length - 1) return GT[GT.length - 1];
    return GT[i];
  }
  function counterShift(x) {
    if (x < 1.39 || x > 2.15) return 0;
    const tgt = 599 + (490 - 599) * ss(1.39, 2.10, x);
    return COMP_K * (tgt - gtAt(x));
  }
  function noise(t, s) { return Math.sin(t * 37.1 + s) * 0.5 + Math.sin(t * 61.7 + s * 2.3) * 0.3 + Math.sin(t * 97.3 + s * 4.1) * 0.2; }

  // ------------------------------------------------------------------ frame loop
  let lastP = performance.now(), vis = false, hold = null, mv = 0, cPrev = 0, gTime = 0, frameDt = 0.016;   // mv: motion 0..1 (rest → FX off)   // hold: { fp, xfF, xf, a } for the mobile loop
  const holdLen = (LOOP.b - LOOP.a) / T.fps, holdX = LOOP.x / T.fps;
  function draw(now) {
    const dtR = (now - lastP) / 1000, dt = Math.min(0.05, dtR); lastP = now; frameDt = dt;
    if (pend && mode === 'off' && gateOpen() && vReady && FREEZE === null) { const d = Math.max(pend, 100); pend = 0; input(d); }
    lAv = loopReady() ? Math.min(1, lAv + dt / 0.5) : 0;
    if (Math.abs(inertia) > 0.02 && mode === 'scrub') { input(inertia * dt * 1000); inertia *= Math.exp(-dt / 0.3); } else if (mode !== 'scrub') inertia = 0;
    hold = null;
    if (FREEZE !== null) {
      c = FREEZE; mode = c > 0 ? 'scrub' : 'off'; seekTo(c);
      if (FREEZE_HOLD !== null && MOBILE) { mode = 'hold'; holdP0 = now - FREEZE_HOLD * 1000; }
    } else if (mode === 'scrub') {
      // DOWN: play on from where the clip is, in real time (sound in sync) — immediately, velocity-continuous, no snap pause.
      // Even the smallest down input plays through to the S1 stop (no minimum). UP: the clip stays exactly where the user left it.
      const idle = now - lastInput;
      if (lastDy > 0 && c < T.end - 0.1 && target >= c - 0.01 && (target > 0 || goDown || c >= T.commit) && commit()) { goDown = false; }
      else {
        if (idle > 160 && Math.abs(inertia) < 0.05 && !(lastDy > 0 && waitPlay)) target = Math.round(target * T.fps) / T.fps;   // rest on an exact frame
        { const dA = Math.min(0.1, dtR), er = target - c, ae = Math.abs(er);         // glide, but with a floor speed: the tail lands on
          const st = Math.min(ae, Math.max(ae * (1 - Math.exp(-dA * (MOBILE ? 11 : 9))), 0.7 * dA));   // the frame in ~60 ms instead of creeping
          c += Math.sign(er) * st; if (Math.abs(target - c) < 0.002) c = target; }
      }
      if (mode !== 'scrub') { /* committed */ }
      else if (lastDy > 0 && c >= T.end - 0.1) {                     // scrolled down onto the end: settle into the hold
        mode = 'hold'; holdP0 = now; c = MOBILE ? (loopReady() ? 129 : LOOP.b) / T.fps : T.end; target = T.end;
        if (!MOBILE) video.pause();
        if (audioLive()) startCruise(0, 1.0);
      }
      if (mode === 'scrub') {
        if (lastDy <= 0 || target < c - 0.01) waitPlay = false;
        if (crSrc) stopCruise(0.4);
        seekTo(c);
        if (c < T.cueC + 0.35 && cueSrc) stopCue(0.3);
        if (c <= 0.0005 && target === 0 && !(goDown && lastDy > 0)) mode = 'off';
      }
    } else if (mode === 'play') {
      // display clock: advances with the frame time, slewed onto the audio clock (or the playing video) — no
      // render-quantum / currentTime jitter, no start stall while the decoder spins up
      const ctx = I.audio.ctx;
      let ref = null;
      if (clock && ctx && ctx.state === 'running') ref = clock.c0 + Math.max(0, ctx.currentTime - clock.ctx0);
      else if (!MOBILE && vReady && !video.paused && video.currentTime > playC0 + 0.03) ref = video.currentTime;
      if (ref === null) c = playC0 + (now - playP0) / 1000;
      else { const cv = c + Math.min(0.1, dtR), er = ref - cv; c = Math.abs(er) > 0.08 ? ref : cv + er * Math.min(1, dt * 6); }
      const endC = roadOn() || (MOBILE && loopReady()) ? 129 / T.fps : MOBILE ? LOOP.b / T.fps : T.end - 0.03;
      if (c >= endC || (!MOBILE && video.ended)) { mode = 'hold'; holdP0 = now; c = roadOn() ? Math.max(endC, Math.min(c, T.end)) : MOBILE ? endC : T.end; if (!MOBILE) video.pause(); }
    }
    if (mode === 'hold') {
      const u = (now - holdP0) / 1000;
      if (!crSrc && crBuf && audioLive() && FREEZE === null) startCruise(0, 1.0);   // sound switched on during the hold
      if (roadOn() || loopReady()) {
        c = MOBILE ? 129 / T.fps : T.end;        // the S1 loop takes over; the clip rests on its last frame underneath
      } else if (MOBILE) {
        const ph = u % holdLen;
        hold = { fp: LOOP.a + ph * T.fps, a: 1 - ph / holdLen, xf: ph < holdX ? 1 - ss(0, holdX, ph) : 0, xfF: LOOP.b };
        c = LOOP.b / T.fps;
      } else {
        const m = (T.hold[0] + T.hold[1]) / 2, a = (T.hold[1] - T.hold[0]) / 2;
        c = m + a * Math.cos(u * 2 * Math.PI / T.holdPeriod);
        seekTo(c);
      }
    }
    // motion amount: playing / holding = 1; scrubbing follows the clip speed; at rest → 0 (FX settle, frame steady)
    const mT = FREEZE !== null || mode === 'play' || mode === 'hold' ? 1 : Math.min(1, Math.abs(c - cPrev) / Math.max(1e-3, dt) / 0.6);
    mv += (mT - mv) * (1 - Math.exp(-Math.min(0.5, dtR) / (mT > mv ? 0.05 : 0.16))); if (mv < 0.004) mv = 0;
    cPrev = c;
    if (mv > 0) gTime = Math.floor(now / 1000 * 24) / 24;           // grain: 24 fps when moving, frozen at rest
    updateLoad(now);
    if (mode === 'off' && FREEZE === null) warm(now / 1000);
    render(now / 1000);
    requestAnimationFrame(draw);
  }

  let loadShown = false;
  function updateLoad() {
    const need = FREEZE === null && gateOpen() && ((MOBILE && loaded < 0.999) || (pend > 0 && !vReady) || (waitPlay && mode === 'scrub'));
    if (need !== loadShown) { loadShown = need; loadBar.classList.toggle('is-visible', need); }
    if (need) loadBar.firstChild.style.transform = `scaleX(${loaded.toFixed(3)})`;
  }

  // pre-warm before the first scroll: GL state + texture storage + first frames decoded, drawn once at alpha 0
  let warmed = 0, warmFx = false;
  function warm(time) {
    if (!glOK || !vReady) return;
    if (MOBILE) { for (let k = 0; k <= 10 && seq.pend.size < 2; k++) if (!seq.bm.has(k)) want(k); }
    const lw = loopReady() && maskOK && (MOBILE ? !!lwant(0) : lv.readyState >= 2);
    const st = (MOBILE ? seq.bm.has(0) && seq.bm.has(1) : video.readyState >= 2) ? (lw ? 2 : 1) : 0;
    if (st > warmed) { warmed = st; warmFx = true; render(time); warmFx = false; }
  }
  function render(time) {
    const show = (mode !== 'off' && vReady) || warmFx;
    const alpha = warmFx ? 0 : show ? ss(0, T.xfEnd, c) * 0.999 + (c > T.xfEnd ? 0.001 : 0) : 0;
    if (!warmFx) window.__t1Covered = show && alpha >= 0.999;
    if (!glOK) { video.style.opacity = String(alpha); return; }
    if (!show && !vis) return;
    vis = show;
    resizeCv();
    gl.viewport(0, 0, cv.width, cv.height); bindFS();
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    if (!show) return;
    let fb = 0, xf = 0, xfC = 0, aln = 0, gA = [1, 0, 0], lB = [1, 0, 0, 0];
    const xR = roadOn() ? ss(RX[0], RX[1], c) : 0;
    // S1 handoff weights (T1 frame n → loop car: per-frame T1 motion RAL⁻¹ composed with the S1 fit)
    const W = S1.win, la = S1.cut ? 0 : ss(W.a[0], W.a[1], c) * lAv;
    let xL = S1.cut ? ss(S1.cut[0], S1.cut[1], c) * lAv : ss(W.bg[0], W.bg[1], c) * lAv, xC = S1.cut ? xL : ss(W.car[0], W.car[1], c) * lAv;
    const nowMs = time * 1000;
    if (lAv > 0 && c > 4.3) {                                    // decode / start the loop ahead of the handoff
      if (MOBILE && lseq.buf) for (let k = 0; k < 4; k++) lwant(k);
    }
    if (warmFx && warmed === 2) { xL = 0.5; xC = 0.5; }
    // the loop runs while playing / holding; scrubbing pauses it (a steady frame at rest); it restarts from its frame 0
    // (the S1 fit) once the handoff has been left
    const loopGo = xL > 0.001 && !FREEZE_LOOPT && !warmFx && (mode === 'play' || mode === 'hold');
    if (loopGo && !loopRun) { loopRun = true; if (!MOBILE) { const q = lv.play(); if (q && q.catch) q.catch(() => {}); } }
    else if (!loopGo && loopRun) { loopRun = false; if (!MOBILE) lv.pause(); }
    if (loopRun) lT0 += frameDt * 1000;
    if (xL <= 0.001 && !warmFx && lT0 > 0) { lT0 = 0; lseq.shown = -1; if (!MOBILE && lv.readyState >= 1) { try { lv.currentTime = 0; } catch (e) {} } }
    let lHave = false;
    if (xL > 0.001) {
      if (MOBILE) {
        const M = lseq.meta, i = Math.floor(((FREEZE_LOOPT || lT0) / 1000) * M.fps) % M.n;
        for (let k = 0; k < 5; k++) lwant(i + k);
        const b = lseq.bm.get(i);
        if (b) { upload(2, b, 1000 + i); lseq.shown = i; lHave = true; }
        else if (lseq.shown >= 0 && lseq.bm.get(lseq.shown)) { upload(2, lseq.bm.get(lseq.shown), 1000 + lseq.shown); lHave = true; }
        lkeep(i);
      } else if (lv.readyState >= 2) {
        if (TXF[2] !== -4 || !lv.paused || vNew.l) {           // paused: upload only after a seek
          gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, TX[2]);
          try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, lv); TXF[2] = -4; if (vNew.l > 0) vNew.l--; } catch (e) {}
        }
        lHave = TXF[2] === -4;
      }
      if (maskOK && TXF[3] !== 1) upload(3, maskImg, 1);
    }
    if (!lHave) { xL = 0; xC = 0; }
    if (S1.cut && xL > 0.001) { xf = xL; xfC = xL; }                 // identical-frame cut: both layers unwarped
    else if (xL > 0.001 || la > 0.001) {
      const r = roadAlign(c), F = S1.fit;
      const sG = F.s / r[0], tx = F.tx / 1920 - F.s * r[1] / r[0], ty = F.ty / 1080 - F.s * r[2] / r[0];
      gA = [1 + (sG - 1) * la, tx * la, ty * la];
      lB = [1 + (sG - 1) * (1 - la), tx * (1 - la), ty * (1 - la), maskOK ? 1 : 0];
      xf = xL; xfC = xC;
    }
    const loopOpaque = xL >= 0.999 && xC >= 0.999;
    if (xR > 0.001) {
      road.render(ROADT !== null ? ROADT : time);                                         // its own program + FBO; then restore the FX pass
      resizeCv(); gl.viewport(0, 0, cv.width, cv.height); bindFS();
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, road.tex); TXF[2] = -3;
    }
    if (MOBILE) {
      // frames to show: primary floor/ceil (frame blend) and, on the hold, the loop tail
      const fp = hold ? hold.fp : Math.max(0, Math.min(seq.meta.n - 1, c * T.fps));
      const f0 = Math.floor(fp + 1e-4), f1 = Math.min(seq.meta.n - 1, f0 + 1);
      const blend = fp - f0;                                     // sub-frame blend: 60 Hz-smooth scrub / playback from 24 fps frames
      protect = [f0, f1];
      const b0 = want(f0), n0 = b0 ? f0 : nearest(f0);
      perf.drawn = (perf.drawn || 0) + 1; if (n0 !== f0) perf.miss = (perf.miss || 0) + 1;
      if (n0 < 0) return;
      upload(0, seq.bm.get(n0), n0);
      if (blend > 0.02 && n0 === f0) { const b1 = want(f1); if (b1) { upload(1, b1, f1); fb = blend; } }
      if (xR <= 0.001 && hold && hold.xf > 0.001) {
        const ft = Math.min(seq.meta.n - 1, Math.round(hold.xfF)); protect.push(ft);
        const bt = want(ft); if (bt) { upload(2, bt, ft); xf = hold.xf; }
      }
      if (hold) aln = hold.a;
      // look-ahead decode (direction of travel), and the whole loop once we are close to it
      const dir = mode === 'scrub' && target < c ? -1 : 1;
      for (let k = 1; k <= (mode === 'scrub' ? 8 : 5); k++) want(f0 + dir * k);
      if ((c > 4.2 || hold) && !roadOn() && !loopReady()) for (let k = LOOP.a; k <= LOOP.b + LOOP.x; k++) want(k);
      if (c > 4.0) startRoad();
    } else if (video.readyState >= 2 && xR < 0.999 && !loopOpaque) {
      if (TXF[0] !== -1 || !video.paused || vNew.v || seeking) {   // paused + no seek: same frame, skip the 8 MB upload
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, TX[0]);
        try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, video); TXF[0] = -1; if (vNew.v > 0) vNew.v--; } catch (e) {}
      }
    }
    if (xR > 0.001) { const r = xR < 0.999 ? roadAlign(c) : [1, 0, 0]; lB = [1 / r[0], -r[1] / r[0], -r[2] / r[0], -1]; xf = xR; xfC = ss(0.55, 1, xR); }
    const v = I.view, d = cdpr();
    const R = reduced() || warmFx;
    const M0 = mv;                                             // motion FX scale (0 at rest)
    const p = c - T.cueC;
    const aEnv = envAt(cueMeta && cueMeta.env, p), aHit = envAt(cueMeta && cueMeta.hit, p);
    const H = hitEnv(c);
    const pull = ss(1.6, 1.9, c) * (1 - ss(2.7, 3.1, c));
    const run = ss(3.4, 3.8, c) * (1 - ss(4.5, 4.9, c));
    const e = ss(0, T.zmEnd, c);
    const punch = R ? 0 : (MOBILE ? 0.07 : 0.10) * H + 0.015 * aHit * pull;
    const zs = (ZM.z + (1 - ZM.z) * e) / (1 + punch);
    const cs = counterShift(c);
    const zv = [ZM.v[0] + (ZM.k[0] - ZM.v[0]) * e, ZM.v[1] + (ZM.k[1] - ZM.v[1]) * e - cs];
    const shK = MOBILE ? 0.7 : 1;
    const shAmp = R ? 0 : M0 * shK * (0.011 * H + (0.0025 * aEnv + 0.004 * aHit) * (pull + 0.4 * run) + 0.0012 * ss(1.4, 1.6, c) * aEnv);
    // road loop: low-amplitude camera-car vibration (two incommensurate rumbles), no visible pattern
    const rum = R ? 0 : xR * 0.00055;
    const shake = [noise(time, 1.3) * shAmp * 0.6 + rum * 0.5 * noise(time * 0.37, 4.2), noise(time, 7.9) * shAmp + rum * (noise(time * 0.53, 2.7) + 0.4 * Math.sin(time * 71))];
    const xfB = hold && hold.xf > 0 && !R ? 0.045 * 4 * hold.xf * (1 - hold.xf) : 0;   // seam: brief motion blur hides the ghost
    // the hit: shorter radial zoom + a directional shutter smear along the camera jump (vertical) — reads as a lens/camera
    // reaction instead of a cartoon zoom-burst
    const xfS = R || S1.cut ? 0 : 0.025 * 4 * xC * (1 - xC);              // S1 car swap: a touch of motion blur through the dissolve
    const blur = R ? 0 : M0 * ((MOBILE ? 0.05 : 0.07) * H + 0.012 * pull * aEnv + xfB + xfS);
    const mbv = R ? 0 : M0 * ((MOBILE ? 0.03 : 0.04) * H + 0.006 * ss(1.39, 1.5, c) * (1 - ss(1.6, 1.9, c)));
    const eblur = R || !MOBILE ? 0 : M0 * (0.05 * pull * (0.6 + 0.4 * aEnv) + 0.022 * run + 0.012 * (hold ? 1 : 0));   // mobile: soft motion streaks
    const ca = R ? 0 : M0 * ((MOBILE ? 0.0022 : 0.010) * H + 0.0016 * pull + 0.0008 * run);
    const bloom = (R ? 0.4 : 1) * ((MOBILE ? 0.55 : 1.1) * H + 0.25 * aEnv * pull + 0.12 * run);
    const lines = 0;                                           // no comic speed lines: motion is carried by the plate + shutter blur
    const vig = 0.22 + 0.25 * H + 0.08 * pull;
    const fAmt = (R ? 0.35 : MOBILE ? 0.62 : 0.70) * H;
    const red = ss(T.hit, T.hit + 0.12, c);
    const fcol = [fAmt * 1.0, fAmt * (0.95 - 0.8 * red), fAmt * (0.9 - 0.8 * red)];
    gl.uniform2f(U.res, cv.width, cv.height);
    gl.uniform4f(U.rect, v.tx * d, v.ty * d, v.iw * d, v.ih * d);
    const lbT = v.ty > 0.5 ? v.ih * 0.14 * d : 0, lbL = v.tx > 0.5 ? v.iw * 0.08 * d : 0;
    gl.uniform4f(U.lb, lbT, lbT * 1.6, lbL, lbL);
    gl.uniform2f(U.zc, ZM.k[0], ZM.k[1]); gl.uniform2f(U.zv, zv[0], zv[1]); gl.uniform1f(U.zs, zs);
    gl.uniform2f(U.shake, shake[0], shake[1]);
    gl.uniform1f(U.blur, blur); gl.uniform1f(U.eblur, eblur); gl.uniform1f(U.ca, ca); gl.uniform1f(U.bloom, bloom); gl.uniform1f(U.lines, lines);
    gl.uniform1f(U.vig, vig); gl.uniform1f(U.alpha, alpha); gl.uniform1f(U.time, FREEZE !== null ? time : gTime);
    gl.uniform1f(U.grain, params.has('nograin') ? 0 : (MOBILE ? 0.03 : 0.035) * (0.55 + 0.45 * M0));   // static, lighter grain at rest
    gl.uniform1f(U.film, 1); gl.uniform1f(U.fb, fb); gl.uniform1f(U.xf, xf);
    gl.uniform3f(U.gA, gA[0], gA[1], gA[2]); gl.uniform4f(U.lB, lB[0], lB[1], lB[2], lB[3]); gl.uniform1f(U.xfC, xfC);
    gl.uniform2f(U.mb, R ? 0 : M0 * 0.004 * H * 0.6, mbv);
    // intro → T1: the clip arrives slightly out of focus and pulls in as the dissolve completes (rack focus)
    gl.uniform1f(U.dfc, R ? 0 : M0 * 0.9 * (1 - ss(0.02, 0.42, c)));
    gl.uniform1f(U.flare, R ? 0 : (MOBILE ? 0.5 : 0.8) * H + 0.10 * xR);
    const A = LOOP.al;
    gl.uniform4f(U.al, A.cx, A.cy, 1 + (A.s - 1) * aln, A.tx * aln);
    gl.uniform3f(U.flash, fcol[0], fcol[1], fcol[2]); gl.uniform2f(U.fc, 0.49, 0.50 - cs / 1080);
    // narrow screens: follow + fit the car (it ends left of centre and wider than the visible window)
    const wf = Math.min(1, v.w / v.iw), scx = (v.w / 2 - v.tx) / v.iw * 1920, scy = (v.h / 2 - v.ty) / v.ih * 1080;
    const pm = wf < 0.98 ? ss(3.0, 3.65, c) : 0;
    const carX = (c < 3.6 ? 0.49 : c < 3.9 ? 0.49 + (0.41 - 0.49) * ss(3.6, 3.9, c) : 0.41 + (0.355 - 0.41) * ss(3.9, 5.0, c)) + la * S1.fit.tx / 1920;
    const zfit = Math.max(1, Math.min(1.35, 0.64 / wf));
    gl.uniform2f(U.sc, scx, scy);
    gl.uniform4f(U.pz, scx + (carX * 1920 - scx) * pm, scy, 1 + (zfit - 1) * pm, pm);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (!warmFx && alpha > 0 && !perf.shown && perf.in0) perf.shown = performance.now() - perf.in0;
  }

  window.AMGT1 = { get c() { return c; }, get mode() { return mode; }, get ready() { return vReady; }, get set() { return vSet; },
    get loaded() { return loaded; }, get mobile() { return MOBILE; }, get perf() { return perf; }, get cached() { return seq.bm.size; },
    get dpr() { return cdpr(); }, get loop() { return { ready: loopReady(), av: lAv, run: loopRun, frame: MOBILE ? lseq.shown : lv.currentTime, mask: maskOK }; }, get road() { return roadOn() ? 1 : road && road.err ? String(road.err) : 0; }, input, commit, reset, get cuePlaying() { return !!cueSrc; }, get cruisePlaying() { return !!crSrc; }, get cruiseReady() { return !!crBuf; }, get motion() { return mv; }, get waitPlay() { return waitPlay; }, get pend() { return pend; }, get net() { return MOBILE ? { got: seq.got, rate: seq.rate, hires: HIRES, w: seq.meta && seq.meta.w } : net; }, want: (i) => want(i), get dbg() { return MOBILE ? { shown: seq.shown } : { vt: video.currentTime, sk: seeking, vn: vNew.v, ps: pendingSeek }; } };

  const kick = () => {
    resizeCv();
    perf.t0 = performance.now();
    if (MOBILE) loadSeq(); else loadVideo();
    loadCue(); loadCruise(); requestAnimationFrame(draw);
    setTimeout(startRoad, 1200);
  };
  if (document.documentElement.dataset.ready === '1') kick();
  else { const iv = setInterval(() => { if (document.documentElement.dataset.ready === '1') { clearInterval(iv); kick(); } }, 100); }
})();
