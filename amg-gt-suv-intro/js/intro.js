/**
 * AMG GT SUV — opening scene ("wake-up") prototype, v6.
 * v6: 8 grille LED bars (4+4, reference), L/R symmetry, rounded DRL ends, red light on the cover (cover_sheen), stronger ignition + blips (real recordings,
 *     lights + camera react to the blips), cinematic emblem entrance (back-glow, depth settle, light sweep), LED scroll cue.
 *
 * Architecture
 *  - One <canvas>. Every frame we call render(t). render() is a PURE function of t (no accumulated state) ->
 *    scrubbable, replayable, previewable with ?t=6.3 (freezes the scene at 6.3 s, no audio).
 *  - No start screen: the timeline starts as soon as the layers are decoded (t = 0, performance.now clock).
 *    The engine audio is fetched + decoded in the background. On the first user gesture (pointer / touch / key;
 *    wheel is tried too) the AudioContext is resumed and the audio starts at the position matching the visual
 *    timeline; from then on the clock is the AudioContext output clock (continuous, no jump), so visuals stay
 *    locked to the sound. Before ignition the clip is scheduled so its ignition lands on timeline.engineStart;
 *    shortly after ignition it joins the clip at the matching offset; later it goes straight into the idle loop.
 *    If the browser allows autoplay (context starts 'running'), audio starts without a gesture.
 *  - Audio = ONE buffer (ignition, 3 throttle blips, idle) played by one AudioBufferSourceNode with
 *    loop=true, loopStart/loopEnd = the idle loop (built seamless in tools/make_audio_v6.py). When the user
 *    starts scrolling, the idle fades out (after the blips) and 'amg:scrollstart' is dispatched;
 *    AMGIntro.audio exposes the context + output bus for future scroll sounds.
 *  - Two image sets (assets/layers/hd = 2.5x, sd = 1.5x of the 1672x940 originals). All geometry is in SCENE
 *    UNITS (1672x940); hd is chosen when the scene is shown at > ~1.57 device px per scene px (?hd / ?sd force).
 *  - Layers are pixel-aligned to Natan's original frames:
 *      base  : frame_dark (img-000), frame_red (img-004 with all light sources removed)
 *      add   : drawn with 'lighter': amber, drl_{L,R}_{main,up,low}, slat_0..7, cover_sheen, grille_frame, grille_reflect,
 *              grille_led (LED contour traced on the grille surround), star, emblem_rim, emblem_halo
 *      over  : emblem_face (+ pre-blurred copy for the blur -> sharp reveal)
 *    End state (all lights on) == img-004 + the grille LED.
 *
 * Query params: ?t=<sec> freeze frame · ?debug show clock · ?nomotion reduced motion · ?hd / ?sd · ?nograin
 */
(() => {
  'use strict';
  const C = window.INTRO_CONFIG;
  const TL = C.timeline, AU = C.audio;
  // derived cue times (seconds from t = 0)
  const H = {
    unlock: TL.unlockFlash,
    double: TL.doubleFlash,
    double2: TL.doubleFlash + C.amber.doubleGap,
    engine: TL.engineStart,
    emblem: TL.engineStart + (AU.emblemHitInClip - AU.engineHitInClip),
    audioStart: TL.engineStart - AU.engineHitInClip,
  };
  const params = new URLSearchParams(location.search);
  const FREEZE_T = params.has('t') ? parseFloat(params.get('t')) : null;
  const DEBUG = params.has('debug');
  if (params.has('nograin')) C.render.grain = 0;   // for measurements
  const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reducedMotion = () => mqReduce.matches || params.has('nomotion');

  // ---------------------------------------------------------------- easing / envelopes
  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const ease = {
    linear: (x) => x,
    outQuad: (x) => 1 - (1 - x) * (1 - x),
    outCubic: (x) => 1 - Math.pow(1 - x, 3),
    inOutCubic: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    inOutSine: (x) => -(Math.cos(Math.PI * x) - 1) / 2,
  };
  /** 0 -> 1 between t0 and t0+dur */
  const ramp = (t, t0, dur, e = ease.linear) => e(clamp01((t - t0) / dur));
  /** one indicator flash: rise / hold / decay */
  function flash(t, t0) {
    const { rise, hold, decay } = C.amber;
    if (t < t0) return 0;
    const x = t - t0;
    if (x < rise) return ease.outQuad(x / rise);
    if (x < rise + hold) return 1;
    if (x < rise + hold + decay) return 1 - ease.inOutSine((x - rise - hold) / decay);
    return 0;
  }
  /** smooth bump 0 -> 1 -> 0 over [t0, t0+dur] */
  const bump = (t, t0, dur) => (t < t0 || t > t0 + dur ? 0 : Math.sin(Math.PI * (t - t0) / dur));

  // ---------------------------------------------------------------- DOM
  const canvas = document.getElementById('scene');
  const ctx = canvas.getContext('2d', { alpha: false });
  const hud = document.getElementById('hud');
  const muteBtn = document.getElementById('mute');
  const replayBtn = document.getElementById('replay');
  const cue = document.getElementById('scroll-cue');
  const dbg = document.getElementById('debug');
  if (DEBUG) dbg.hidden = false;

  // ---------------------------------------------------------------- assets
  let M = null;            // manifest
  const IMG = {};          // name -> HTMLImageElement
  let SW = 1672, SH = 940; // scene size

  function loadImage(src) {
    return new Promise((res, rej) => {
      const im = new Image();
      im.decoding = 'async';
      im.onload = () => (im.decode ? im.decode().catch(() => {}).then(() => res(im)) : res(im));
      im.onerror = () => rej(new Error('Failed to load ' + src));
      im.src = src;
    });
  }
  /** device px per scene px for a viewport (same rule as resize()) */
  function sceneScale(w, h) {
    const [x0, y0, x1, y1] = C.framing.safeRegion;
    return Math.min(Math.max(w / SW, h / SH), Math.min(w / (x1 - x0), h / (y1 - y0)));
  }
  function pickSet() {
    if (params.has('hd')) return 'hd';
    if (params.has('sd')) return 'sd';
    const dpr = Math.min(window.devicePixelRatio || 1, C.framing.maxDpr);
    const sw = Math.max(screen.width || 0, window.innerWidth), sh = Math.max(screen.height || 0, window.innerHeight);
    const need = Math.max(sceneScale(sw, sh), sceneScale(sh, sw), sceneScale(window.innerWidth, window.innerHeight)) * dpr;
    return need > C.assets.sets.sd.scale * 1.05 ? 'hd' : 'sd';
  }
  let SET = 'hd';
  async function loadLayers(onProgress) {
    SET = pickSet();
    const base = C.assets.sets[SET].dir;
    M = await (await fetch(base + 'layers.json')).json();
    [SW, SH] = M.size;
    const names = Object.keys(M.layers);
    let done = 0;
    await Promise.all(names.map(async (n) => {
      IMG[n] = await loadImage(base + M.layers[n].file);
      onProgress(++done);
    }));
    return names.length;
  }

  // ---------------------------------------------------------------- haze texture (generated once)
  const haze = (() => {
    const w = 192, h = 108, c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d'), d = g.createImageData(w, h);
    // smooth value noise: random grid, bilinear upsample, 3 octaves
    const rnd = (s) => { const x = Math.sin(s) * 43758.5453; return x - Math.floor(x); };
    const vnoise = (x, y, cell, seed) => {
      const xi = Math.floor(x / cell), yi = Math.floor(y / cell), fx = x / cell - xi, fy = y / cell - yi;
      const r = (i, j) => rnd((i + 1) * 127.1 + (j + 1) * 311.7 + seed * 74.7);
      const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      const a = r(xi, yi) + (r(xi + 1, yi) - r(xi, yi)) * sx;
      const b = r(xi, yi + 1) + (r(xi + 1, yi + 1) - r(xi, yi + 1)) * sx;
      return a + (b - a) * sy;
    };
    for (let y = 0; y < h; y++) {
      // vertical weighting: haze sits low (floor / car), little at the top
      const vy = y / h, wv = Math.exp(-Math.pow((vy - 0.68) / 0.28, 2)) * 0.9 + 0.1;
      for (let x = 0; x < w; x++) {
        // tile-able horizontally by sampling x modulo w (cell sizes divide w)
        const n = 0.55 * vnoise(x, y, 48, 1) + 0.3 * vnoise(x, y, 24, 2) + 0.15 * vnoise(x, y, 12, 3);
        const v = Math.pow(clamp01((n - 0.35) / 0.55), 1.6) * wv * 255;
        const i = (y * w + x) * 4;
        d.data[i] = v; d.data[i + 1] = v; d.data[i + 2] = v; d.data[i + 3] = 255;
      }
    }
    g.putImageData(d, 0, 0);
    return c;
  })();

  // ---------------------------------------------------------------- grain (dither) tile, mid-grey +- noise, drawn with 'overlay'
  const grain = (() => {
    const n = 256, c = document.createElement('canvas'); c.width = n; c.height = n;
    const g = c.getContext('2d'), d = g.createImageData(n, n);
    let seed = 1234567;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    for (let i = 0; i < n * n; i++) {
      const v = 128 + ((rnd() + rnd() + rnd()) / 3 - 0.5) * 255;   // triangular-ish distribution
      d.data[i * 4] = d.data[i * 4 + 1] = d.data[i * 4 + 2] = v; d.data[i * 4 + 3] = 255;
    }
    g.putImageData(d, 0, 0);
    return c;
  })();
  let grainPattern = null;

  // ---------------------------------------------------------------- offscreen helpers
  const off = document.createElement('canvas');          // device-size scratch (red bloom)
  const offCtx = off.getContext('2d');
  const small = document.createElement('canvas');        // layer-size scratch (DRL sweep, LED trace)
  const smallCtx = small.getContext('2d');
  const sweepC = document.createElement('canvas');       // layer-size scratch (emblem light sweep)
  const sweepCtx = sweepC.getContext('2d');

  /** Additive copy of a layer seen through a moving diagonal light band (u: band centre 0..1 across the layer,
   *  w: half-width as a fraction of the diagonal). Drawn with the current transform (handles snap like drawLayer). */
  function drawBand(name, u, w, alpha) {
    if (alpha <= 0.001 || u < -w || u > 1 + w) return;
    const L = M.layers[name], im = SRC(name);
    const pw = im.naturalWidth || im.width, ph = im.naturalHeight || im.height;
    if (sweepC.width !== pw || sweepC.height !== ph) { sweepC.width = pw; sweepC.height = ph; }
    const g = sweepCtx;
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    g.clearRect(0, 0, pw, ph); g.drawImage(im, 0, 0);
    // band along the top-left -> bottom-right diagonal, slightly tilted like a studio strip light
    const x0 = -0.15 * pw, y0 = -0.25 * ph, x1 = 1.15 * pw, y1 = 1.25 * ph;
    const gr = g.createLinearGradient(x0, y0, x1, y1);
    const st = (v, a) => gr.addColorStop(clamp01(v), `rgba(0,0,0,${a})`);
    st(0, 0); st(u - w, 0); st(u - w * 0.35, 0.55); st(u, 1); st(u + w * 0.35, 0.55); st(u + w, 0); st(1, 0);
    g.globalCompositeOperation = 'destination-in'; g.fillStyle = gr; g.fillRect(0, 0, pw, ph);
    g.globalCompositeOperation = 'source-over';
    ctx.globalCompositeOperation = 'lighter';
    let a = alpha;
    while (a > 0.001) {
      ctx.globalAlpha = Math.min(a, 1);
      if (SNAP && isCache(im)) { const [px, py] = blitPos(L); ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(sweepC, px, py); ctx.restore(); }
      else ctx.drawImage(sweepC, L.x, L.y, L.w, L.h);
      a -= 1;
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }

  // ---------------------------------------------------------------- per-resize resample cache
  // Each layer is resampled ONCE (per resize) to exactly the device-pixel size it is shown at, with
  // imageSmoothingQuality 'high'. Per-frame draws are then ~1:1 copies: sharper and much cheaper than
  // resampling 4K images every frame.
  const CACHE = {};
  let cacheKey = '', cacheTimer = 0;
  function buildCache() {
    const f = view.s * view.dpr, key = f.toFixed(4);
    if (!M || key === cacheKey || Object.keys(M.layers).some((n) => !IMG[n])) return;   // not all layers loaded yet
    for (const n of Object.keys(M.layers)) {
      const L = M.layers[n], im = IMG[n];
      const w = Math.max(1, Math.round(L.w * f)), h = Math.max(1, Math.round(L.h * f));
      // v9: ALWAYS cache at the exact device size (also when ~1:1 or larger than the asset), so every per-frame draw is
      // an integer-position 1:1 blit. v8 skipped the cache within 2 % of the asset size (e.g. 390x844 @3x on the SD
      // set, or 2560-wide screens on HD) and then bilinear-resampled the full frame at a fractional offset every frame.
      if (w === im.naturalWidth && h === im.naturalHeight) { CACHE[n] = im; EXACT.add(im); continue; }
      const c = (CACHE[n] instanceof HTMLCanvasElement) ? CACHE[n] : document.createElement('canvas');
      c.width = w; c.height = h;
      const g = c.getContext('2d');
      g.imageSmoothingEnabled = true; g.imageSmoothingQuality = C.render.cacheSmoothing;
      g.drawImage(im, 0, 0, w, h);
      CACHE[n] = c;
    }
    cacheKey = key;
  }
  const SRC = (n) => CACHE[n] || IMG[n];
  function scheduleCache(immediate) {
    clearTimeout(cacheTimer);
    if (immediate) buildCache(); else cacheTimer = setTimeout(() => { buildCache(); if (!running) frame(); }, 150);
  }

  // Pixel snapping: while the context holds the plain view transform (scale k, offset ex/ey in device px),
  // a cached layer is blitted 1:1 at an integer device position -> no resampling at all per frame.
  let SNAP = null;   // { k, ex, ey } or null
  function blitPos(L) { return [Math.round(SNAP.ex + L.x * SNAP.k), Math.round(SNAP.ey + L.y * SNAP.k)]; }
  const EXACT = new WeakSet();   // v9: assets already at the exact device size (blitted 1:1 like a cache canvas)
  const isCache = (im) => im instanceof HTMLCanvasElement || EXACT.has(im);

  /** Draw a manifest layer at its scene offset. Additive alpha > 1 is drawn in passes. */
  function drawLayer(name, alpha, mode) {
    if (alpha <= 0.001) return;
    const L = M.layers[name], im = SRC(name);
    ctx.globalCompositeOperation = mode || (L.mode === 'add' ? 'lighter' : 'source-over');
    const snap = SNAP && isCache(im);
    let px = 0, py = 0;
    if (snap) { [px, py] = blitPos(L); ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); }
    let a = alpha;
    while (a > 0.001) {
      ctx.globalAlpha = Math.min(a, 1);
      if (snap) ctx.drawImage(im, px, py); else ctx.drawImage(im, L.x, L.y, L.w, L.h);
      a -= 1;
    }
    if (snap) ctx.restore();
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }

  /** Additive layer revealed by a soft-edged horizontal wipe from xFrom to xTo (scene px). */
  function drawWipe(name, p, xFrom, xTo, feather) {
    if (p <= 0) return;
    if (p >= 1) return drawLayer(name, 1);
    const L = M.layers[name], im = SRC(name);
    const pw = im.naturalWidth || im.width, ph = im.naturalHeight || im.height, k = pw / L.w;   // image px per scene px
    if (small.width !== pw || small.height !== ph) { small.width = pw; small.height = ph; }
    smallCtx.globalCompositeOperation = 'source-over';
    smallCtx.clearRect(0, 0, pw, ph);
    smallCtx.drawImage(im, 0, 0);
    const dir = Math.sign(xTo - xFrom), edge = xFrom + (xTo - xFrom) * p;
    const a = (xFrom - L.x - dir * feather) * k, b = (edge - L.x) * k, c = (edge - L.x + dir * feather) * k;
    const gr = smallCtx.createLinearGradient(a, 0, c, 0);
    gr.addColorStop(0, 'rgba(0,0,0,1)');
    gr.addColorStop(clamp01((b - a) / (c - a || 1)), 'rgba(0,0,0,1)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    smallCtx.globalCompositeOperation = 'destination-in';
    smallCtx.fillStyle = gr; smallCtx.fillRect(0, 0, pw, ph);
    ctx.globalCompositeOperation = 'lighter';
    if (SNAP && isCache(im)) { const [px, py] = blitPos(L); ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(small, px, py); ctx.restore(); }
    else ctx.drawImage(small, L.x, L.y, L.w, L.h);
    ctx.globalCompositeOperation = 'source-over';
  }

  /** Red wall glow blooming from the car centre outward (radial soft mask). */
  function drawRedBloom(p) {
    if (p <= 0) return;
    if (p >= 1) return drawLayer('frame_red', 1, 'source-over');
    // rendered at device resolution with the current scene transform (no intermediate resampling)
    if (off.width !== canvas.width || off.height !== canvas.height) { off.width = canvas.width; off.height = canvas.height; }
    offCtx.setTransform(1, 0, 0, 1, 0, 0);
    offCtx.globalCompositeOperation = 'source-over';
    offCtx.clearRect(0, 0, off.width, off.height);
    offCtx.imageSmoothingEnabled = true; offCtx.imageSmoothingQuality = C.render.frameSmoothing;
    const fr = SRC('frame_red');
    if (SNAP && isCache(fr)) { const [px, py] = blitPos(M.layers.frame_red); offCtx.drawImage(fr, px, py); }
    offCtx.setTransform(ctx.getTransform());
    if (!(SNAP && isCache(fr))) offCtx.drawImage(fr, 0, 0, SW, SH);
    const [cx, cy] = [M.car_center[0], 380];     // bloom origin: behind the car, wall height
    const Rmax = Math.hypot(SW, SH) * 0.75, R = 40 + Rmax * p, inner = R * 0.35;
    const gr = offCtx.createRadialGradient(cx, cy, inner, cx, cy, R);
    gr.addColorStop(0, `rgba(0,0,0,${Math.min(1, 0.35 + p)})`);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    offCtx.globalCompositeOperation = 'destination-in';
    offCtx.fillStyle = gr; offCtx.fillRect(-SW, -SH, SW * 3, SH * 3);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(off, 0, 0);
    ctx.restore();
  }

  // ---------------------------------------------------------------- framing (responsive)
  let view = { s: 1, tx: 0, ty: 0, dpr: 1, w: 0, h: 0 };
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, C.framing.maxDpr);
    dpr = Math.min(dpr, C.render.maxBackingPx / Math.max(w, h));      // cap the backing store (memory / fill rate)
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = C.render.frameSmoothing;   // state resets on resize
    const [x0, y0, x1, y1] = C.framing.safeRegion;
    const cover = Math.max(w / SW, h / SH);
    const fitSafe = Math.min(w / (x1 - x0), h / (y1 - y0));
    const s = Math.min(cover, fitSafe);                // cover, unless that would crop the car/emblem
    const [fx, fy] = C.framing.focus;
    const iw = SW * s, ih = SH * s;
    // focus point at screen centre; clamp so the image covers the screen where it can, else centre (letterbox)
    let tx = w / 2 - fx * s, ty = h / 2 - fy * s;
    tx = iw >= w ? Math.min(0, Math.max(w - iw, tx)) : (w - iw) / 2;
    ty = ih >= h ? Math.min(0, Math.max(h - ih, ty)) : (h - ih) / 2;
    view = { s, tx, ty, dpr, w, h, iw, ih };
  }

  /** Fade image edges into black where the image doesn't cover the screen (portrait letterbox). */
  function drawLetterboxBlend() {
    const { w, h, tx, ty, iw, ih, dpr } = view;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#000';
    if (ty > 0.5) {
      const f = ih * 0.14;
      ctx.fillRect(0, 0, w, ty + 1); ctx.fillRect(0, ty + ih - 1, w, h - ty - ih + 1);
      let g = ctx.createLinearGradient(0, ty, 0, ty + f);
      g.addColorStop(0, '#000'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, ty, w, f);
      g = ctx.createLinearGradient(0, ty + ih, 0, ty + ih - f * 1.6);
      g.addColorStop(0, '#000'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, ty + ih - f * 1.6, w, f * 1.6);
    }
    if (tx > 0.5) {
      const f = iw * 0.08;
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, tx + 1, h); ctx.fillRect(tx + iw - 1, 0, w - tx - iw + 1, h);
      let g = ctx.createLinearGradient(tx, 0, tx + f, 0);
      g.addColorStop(0, '#000'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(tx, 0, f, h);
      g = ctx.createLinearGradient(tx + iw, 0, tx + iw - f, 0);
      g.addColorStop(0, '#000'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(tx + iw - f, 0, f, h);
    }
  }


  // ---------------------------------------------------------------- grille LED trace
  function pathPoint(s) {                    // point at normalised arc length s (0..1)
    const P = M.grille_led_path, S = P.s, pts = P.points;
    let lo = 0, hi = S.length - 1;
    if (s <= 0) return pts[0];
    if (s >= 1) return pts[hi];
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (S[m] <= s) lo = m; else hi = m; }
    const f = (s - S[lo]) / (S[hi] - S[lo] || 1);
    return [pts[lo][0] + (pts[hi][0] - pts[lo][0]) * f, pts[lo][1] + (pts[hi][1] - pts[lo][1]) * f];
  }
  function subPath(a, b) {                   // polyline between arc lengths a < b
    const P = M.grille_led_path, out = [pathPoint(a)];
    for (let i = 0; i < P.s.length; i++) if (P.s[i] > a && P.s[i] < b) out.push(P.points[i]);
    out.push(pathPoint(b));
    return out;
  }
  /** LED contour on the grille surround: traced from both lower tips up to the top centre, then a short settle flash. */
  function drawLED(t) {
    const E = C.engineStart, P = M.grille_led_path;
    if (!P || !M.layers.grille_led) return 0;
    const t0 = H.engine + E.ledDelay, p = ramp(t, t0, E.ledTrace, ease.inOutSine);
    if (p <= 0) return 0;
    const level = E.ledLevel * (1 + E.ledFlash * bump(t, t0 + E.ledTrace * 0.85, E.ledFlashDur));
    if (p >= 1) { drawLayer('grille_led', level); return p; }
    const L = M.layers.grille_led, im = SRC('grille_led');
    const pw = im.naturalWidth || im.width, ph = im.naturalHeight || im.height, k = pw / L.w;
    if (small.width !== pw || small.height !== ph) { small.width = pw; small.height = ph; }
    const g = smallCtx;
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, pw, ph);
    g.setTransform(k, 0, 0, k, -L.x * k, -L.y * k);       // scene units
    const hl = p * P.top_s, hr = 1 - p * (1 - P.top_s);                    // the two tracing fronts (arc length)
    g.lineJoin = 'round'; g.lineCap = 'round'; g.strokeStyle = '#000';
    for (const [w, a] of [[40, 0.3], [24, 0.45], [12, 1]]) {   // soft-edged mask; round caps pulled back by w/2 -> soft fronts
      const back = (w / 2) / P.length;
      const segs = [[0, hl - back], [hr + back, 1]].filter(([a0, b0]) => b0 > a0).map(([a0, b0]) => subPath(a0, b0));
      g.lineWidth = w; g.globalAlpha = a;
      for (const sp of segs) { g.beginPath(); g.moveTo(sp[0][0], sp[0][1]); for (let i = 1; i < sp.length; i++) g.lineTo(sp[i][0], sp[i][1]); g.stroke(); }
    }
    g.globalAlpha = 1; g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-in'; g.drawImage(im, 0, 0);
    g.globalCompositeOperation = 'source-over';
    ctx.globalCompositeOperation = 'lighter';
    let a = level;
    while (a > 0.001) {
      ctx.globalAlpha = Math.min(a, 1);
      if (SNAP && isCache(im)) { const [px, py] = blitPos(L); ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(small, px, py); ctx.restore(); }
      else ctx.drawImage(small, L.x, L.y, L.w, L.h);
      a -= 1;
    }
    // comet heads (bright moving point at each tracing front)
    const hg = E.ledHead * (1 - ramp(p, 0.85, 0.15));
    if (hg > 0.01) {
      for (const s of [hl, hr]) {
        const [hx, hy] = pathPoint(s), r = 7;
        const gr = ctx.createRadialGradient(hx, hy, 0, hx, hy, r);
        gr.addColorStop(0, `rgba(255,255,255,${hg})`); gr.addColorStop(0.25, `rgba(235,240,255,${hg * 0.45})`); gr.addColorStop(1, 'rgba(220,228,255,0)');
        ctx.globalAlpha = 1; ctx.fillStyle = gr; ctx.fillRect(hx - r, hy - r, 2 * r, 2 * r);
      }
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    return p;
  }

  // ---------------------------------------------------------------- v6: throttle blips (audio meta) -> light / shake
  function blipState(t) {
    const out = { light: 0, shake: 0 };
    if (!META || !META.blips) return out;
    const ct = clipPos(t);
    if (ct >= META.idle_from || ct <= 0) return out;
    for (const b of META.blips) {
      const d = ct - b;
      if (d > -0.2 && d < 1.0) {
        out.light = Math.max(out.light, Math.exp(-Math.pow((d - 0.16) / 0.17, 2)));
        if (d >= 0 && d < C.blips.shakeDuration) out.shake = Math.max(out.shake, 1 - d / C.blips.shakeDuration);
      }
    }
    return out;
  }

  // ---------------------------------------------------------------- v7: audio-driven ignition / blip FX
  // fx_env (loudness follower) + fx_hit (low-band onset strength), 100 Hz curves precomputed in the audio JSON
  // (tools/make_audio_v7.py), read at the clip position that is actually heard -> shake / light surge / red pulse /
  // vignette + bloom punch / floor flicker stay locked to the catch and every blip.
  function fxAt(t) {
    const out = { env: 0, hit: 0 };
    if (!META || !META.fx_env) return out;
    const ct = clipPos(t);
    if (ct < AU.engineHitInClip - 0.03) return out;      // v8: nothing before the catch (no starter flicker)
    const x = ct * META.fx_rate, i = Math.floor(x), f = x - i, n = META.fx_env.length;
    if (ct <= 0 || i >= n - 1) return out;
    out.env = META.fx_env[i] + (META.fx_env[i + 1] - META.fx_env[i]) * f;
    out.hit = META.fx_hit[i] + (META.fx_hit[i + 1] - META.fx_hit[i]) * f;
    return out;
  }

  // ---------------------------------------------------------------- the scene as a function of time
  function render(t) {
    const rm = reducedMotion();
    const E = C.engineStart, EM = C.emblem, LP = C.loop;
    const { s, tx, ty, dpr } = view;

    // camera shake on engine start (scene px, decaying, deterministic)
    let sx = 0, sy = 0;
    if (!rm && t >= H.engine && t < H.engine + E.shakeDuration) {
      const k = 1 - (t - H.engine) / E.shakeDuration, amp = E.shakePx * k;
      sx = amp * Math.sin(t * 173.3); sy = amp * Math.cos(t * 241.7);
    }
    // v6: throttle blips (positions from the audio meta, following what is actually heard): LED lift + micro-shake
    const BL = blipState(t);
    if (!rm && BL.shake > 0) { const a = C.blips.shakePx * BL.shake; sx += a * Math.sin(t * 151.1 + 1.3); sy += a * Math.cos(t * 203.9); }
    // v7: audio-driven FX (none of the motion under prefers-reduced-motion; light surge kept, halved)
    const F = C.fx, FX = fxAt(t);
    let zoom = 0;
    if (!rm) {
      const hA = F.shakeHit * Math.pow(FX.hit, 1.4), rA = F.rumble * FX.env;
      sx += hA * Math.sin(t * 167.3 + 0.7) + rA * Math.sin(t * 71.3 + 2.1);
      sy += hA * Math.cos(t * 229.1) * 0.8 + rA * Math.cos(t * 57.7 + 0.4);
      zoom = F.zoomPunch * Math.pow(FX.hit, 1.6);
    }
    const surge = (rm ? 0.5 : 1) * (F.lightEnv * FX.env + F.lightHit * FX.hit);
    const LG = 1 + (rm ? 0 : C.blips.light * BL.light) + surge;    // LED gain

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (zoom > 1e-4) {                       // v7: tiny zoom punch about the focus point (no pixel-snapped blits)
      const [fxp, fyp] = C.framing.focus, z = 1 + zoom;
      ctx.setTransform(dpr * s * z, 0, 0, dpr * s * z, dpr * (tx + sx * s - fxp * s * zoom), dpr * (ty + sy * s - fyp * s * zoom));
      SNAP = null;
    } else {
      ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * (tx + sx * s), dpr * (ty + sy * s));
      SNAP = { k: dpr * s, ex: dpr * (tx + sx * s), ey: dpr * (ty + sy * s) };
    }
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = C.render.frameSmoothing;

    // 1) darkness (img-000), faded in from black
    const fadeIn = ramp(t, 0, TL.fadeInFromBlack, ease.inOutSine);
    const tRed = H.double2;
    const red = ramp(t, tRed, C.red.bloomDuration, ease.inOutCubic);
    if (red < 1) drawLayer('frame_dark', fadeIn, 'source-over');   // fully covered once the red room is on

    // 2) red wall glow: blooms from centre on the 2nd flash of the double flash
    drawRedBloom(red);

    // 3) breathing loop + engine-level glow (modulates the red room only, not the lamps)
    const breathAmp = (rm ? 0 : LP.breathAmount) * ramp(t, H.emblem + LP.breathStartAfterEmblem, LP.breathRamp, ease.inOutSine);
    const breathT = t - (H.emblem + LP.breathStartAfterEmblem);
    let k = breathAmp * Math.sin((2 * Math.PI * breathT) / LP.breathPeriod);
    if (!rm && ENV && LP.engineGlow) {          // follows what is heard: ignition, blips, then the idle loop
      const ct = clipPos(t), dur = ENV.values.length / ENV.rate;
      if (ct > 0 && ct < dur) {
        const x = ct * ENV.rate, i = Math.floor(x), f = x - i;
        const v = ENV.values[i] + ((ENV.values[i + 1] ?? ENV.values[i]) - ENV.values[i]) * f;
        const w = ramp(ct, AU.engineHitInClip, 0.25) * idleGainAt(t);
        k += LP.engineGlow * (v - ENV.mean) * w;
      }
    }
    k += (rm ? 0.5 : 1) * (F.redEnv * FX.env + F.redHit * FX.hit);   // v7: red ambient pulse on wall / floor / cover
    if (red > 0 && k > 0) drawLayer('frame_red', k * red, 'lighter');
    if (red > 0 && k < 0) { ctx.globalAlpha = -k * red; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, SW, SH); ctx.globalAlpha = 1; }
    // 3b) v6: red light on the cover - fold highlights, wall rim light along the silhouette, floor bounce on the skirt.
    //     Comes up with the red bloom (slightly behind it) and breathes with the room.
    if (red > 0 && M.layers.cover_sheen) drawLayer('cover_sheen', C.cover.sheen * Math.pow(red, 1.6) * Math.max(0, 1 + 2.5 * k));

    // 4) tiny grille glints in the dark (slow shimmer, gone once the slats light)
    const glintFade = (1 - ramp(t, H.engine, 0.3)) * fadeIn;
    if (glintFade > 0) {
      M.slat_order_center_out.forEach((i, n) => {
        const sh = rm ? 0.5 : 0.5 + 0.5 * Math.sin(t * 1.7 - n * 0.9);
        drawLayer('slat_' + i, C.intro.glintAlpha * sh * glintFade);
      });
    }

    // 5) amber indicators: single unlock flash, then double flash (240 ms apart). Layer includes floor streaks.
    const amber = Math.max(flash(t, H.unlock), flash(t, H.double), flash(t, tRed)) * C.amber.level;
    drawLayer('amber', amber);

    // 6) engine start: main DRL bar sweeps inner -> outer, then the upper + lower DRL segments light as whole
    //    elements (no wipe edge cutting through their diagonal strokes)
    const drl = ramp(t, H.engine, E.drlMain, ease.outCubic);
    const drlEl = ramp(t, H.engine + E.drlElemDelay, E.drlElemFade, ease.outQuad);
    for (const sd of ['L', 'R']) {
      const sp = M.drl_main_span[sd];
      drawWipe('drl_' + sd + '_main', drl, sp[0], sp[1], E.drlFeather);
      if (drl >= 1 && LG > 1.001) drawLayer('drl_' + sd + '_main', LG - 1);
      drawLayer('drl_' + sd + '_up', drlEl * LG);
      drawLayer('drl_' + sd + '_low', drlEl * LG);
    }

    // 7) grille slats centre-outward (40 ms stagger, 150 ms fade) + surround + floor reflection
    const t0s = H.engine + E.slatDelay;
    M.slat_order_center_out.forEach((i, n) => drawLayer('slat_' + i, LG * ramp(t, t0s + n * E.slatStagger, E.slatFade, ease.outQuad)));
    const frameA = ramp(t, t0s, E.frameFade, ease.outQuad);
    drawLayer('grille_frame', frameA * (1 + 0.6 * surge));
    // v7: floor reflection flickers with the hits (deterministic shimmer, decays with fx_hit)
    const flick = rm ? 0 : F.floorFlicker * FX.hit * (0.6 + 0.4 * Math.sin(t * 97.0) * Math.sin(t * 41.0 + 1.0));
    drawLayer('grille_reflect', ramp(t, t0s + 0.05, E.frameFade + 0.2, ease.outQuad) * (1 + 0.8 * surge + flick));
    const led = drawLED(t);                        // LED contour around the grille surround
    if (led >= 1 && LG > 1.001) drawLayer('grille_led', (LG - 1) * E.ledLevel);

    // 8) star last, with one glow pulse
    const tStar = t0s + (M.slat_order_center_out.length - 1) * E.slatStagger + E.slatFade + E.starGap;
    const star = ramp(t, tStar, E.starFade, ease.outQuad) + E.starPulseGain * bump(t, tStar + E.starFade * 0.5, E.starPulse);
    drawLayer('star', star * LG);

    // 9) emblem (v6): back-glow builds just before the engine hit and swells on it -> face comes in out of focus,
    //    slightly large, and settles (damped depth settle, blur -> sharp) -> a strip-light sweep runs across the
    //    metal (stronger on the rim ring) -> rim light settles out. Everything keyed to H.emblem (= engine hit).
    const te = H.emblem;
    const preG = EM.preGlow * ramp(t, te - EM.preGlowLead, EM.preGlowLead, ease.inOutSine);
    const hitG = t >= te ? EM.hitFlash * Math.pow(bump(t, te, EM.hitFlashDur), 2) * (t - te < EM.hitFlashDur * 0.5 ? 1 : 1) : 0;
    const haloMain = ramp(t, te + EM.haloDelay, EM.haloDuration, ease.inOutSine);
    const halo = Math.min(1 + EM.hitFlash, Math.max(preG, haloMain) + hitG);
    drawLayer('emblem_halo', halo);
    const tFace = te + EM.faceDelay;
    const pf = ramp(t, tFace, EM.faceDuration, ease.outCubic);
    if (pf > 0) {
      const x = Math.max(0, (t - tFace) / EM.faceDuration);
      const sc = rm ? 1 : 1 + (EM.scaleFrom - 1) * Math.exp(-x * EM.settle) * Math.cos(Math.min(x, 2) * Math.PI * 0.9);
      const [ex, ey] = M.emblem_center;
      ctx.save(); const snapSave = SNAP; if (Math.abs(sc - 1) > 1e-4) SNAP = null;
      ctx.translate(ex, ey); ctx.scale(sc, sc); ctx.translate(-ex, -ey);
      if (!rm) drawLayer('emblem_face_blur', clamp01(pf * 2.2) * (1 - pf));
      drawLayer('emblem_face', rm ? pf : Math.pow(pf, 1.5));
      // light sweep across the metal
      const us = ramp(t, te + EM.sweepDelay, EM.sweepDuration, ease.inOutSine);
      if (!rm && us > 0 && us < 1) {
        const u = -EM.sweepWidth + us * (1 + 2 * EM.sweepWidth);
        drawBand('emblem_face', u, EM.sweepWidth, EM.sweepFace * pf);
        drawBand('emblem_rim', u, EM.sweepWidth * 0.8, EM.sweepRim);
      }
      ctx.restore(); SNAP = snapSave;
    }
    const rim = ramp(t, te, EM.rimIn, ease.outCubic) * (1 - ramp(t, te + EM.faceDelay + EM.faceDuration, EM.rimOutDuration, ease.inOutSine));
    drawLayer('emblem_rim', rim);

    // 10) haze: drifting low-contrast noise (additive)
    const hz = C.intro.hazeAlpha * fadeIn * (1 + (C.intro.hazeRed ?? 0.6) * red);   // v9: much lighter, thins out in the red room (was a soft grey veil over floor / cover)
    if (hz > 0) {
      ctx.globalCompositeOperation = 'lighter';
      const drift = rm ? 0 : t * 9;                       // scene px / s
      [[drift, 0.6], [-drift * 0.6 + 400, 0.4]].forEach(([dx, a]) => {
        ctx.globalAlpha = hz * a;
        const x = ((dx % SW) + SW) % SW;
        ctx.drawImage(haze, x - SW, 0, SW, SH); ctx.drawImage(haze, x, 0, SW, SH);
      });
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }

    // 10b) v7: bloom + vignette punch on the catch / blips (subtle, scene space)
    if (FX.hit > 0.01 || FX.env > 0.01) {
      const [fxp, fyp] = C.framing.focus;
      const bl = (rm ? 0.5 : 1) * (F.bloom * FX.hit + F.bloomEnv * FX.env);
      if (bl > 0.003) {
        const g = ctx.createRadialGradient(fxp, fyp + 30, 0, fxp, fyp + 30, 430);
        g.addColorStop(0, `rgba(255,236,232,${bl})`); g.addColorStop(0.35, `rgba(255,120,110,${bl * 0.35})`); g.addColorStop(1, 'rgba(255,60,50,0)');
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(fxp - 430, fyp - 400, 860, 860);
      }
      const vg = rm ? 0 : F.vignette * FX.hit;
      if (vg > 0.003) {
        const g = ctx.createRadialGradient(fxp, fyp, SW * 0.28, fxp, fyp, SW * 0.78);
        g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${vg})`);
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(-200, -200, SW + 400, SH + 400);
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    SNAP = null;
    drawLetterboxBlend();

    // 11) grain / dither (device pixels, 'overlay' around mid-grey: invisible on black, breaks up banding)
    if (C.render.grain > 0) {
      if (!grainPattern) grainPattern = ctx.createPattern(grain, 'repeat');
      const fi = rm || FREEZE_T !== null ? 0 : Math.floor(t * 24);
      const ox = (fi * 97) % 256, oy = (fi * 57) % 256;
      ctx.setTransform(1, 0, 0, 1, -ox, -oy);
      ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = C.render.grain * 4;
      ctx.fillStyle = grainPattern; ctx.fillRect(ox, oy, canvas.width, canvas.height);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    if (DEBUG) dbg.textContent = `t=${t.toFixed(3)}s  red=${red.toFixed(2)} amber=${amber.toFixed(2)} drl=${drl.toFixed(2)} led=${led.toFixed(2)} pf=${pf.toFixed(2)}  audio=${audioOn ? 'on' : 'off'} clip=${clipPos(t).toFixed(2)} fx=${FX.env.toFixed(2)}/${FX.hit.toFixed(2)}`;
  }

  // ---------------------------------------------------------------- audio (decoded in the background, no gate)
  const ACtor = window.AudioContext || window.webkitAudioContext;
  let actx = null, master = null, bus = null, buffer = null, META = null, ENV = null;
  let src = null, srcGain = null, startAt = 0, muted = false;
  let audioOn = false, audioOnAt = 0;  // audio running and driving the clock
  let aT0 = 0, aOff = 0;                // timeline time the source began + buffer offset there
  let vStart = 0, started = false;     // visual clock (performance.now) until audio is on
  let scrollT = null, idleFadeT = null; // user scroll intent -> idle fade
  let introCut = false;                // scrolled before the intro ended: the engine fades now, quickly
  const scrollHooks = [];

  function ensureContext() {
    if (actx || !ACtor || FREEZE_T !== null) return actx;
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
    try { actx = new ACtor({ latencyHint: 'interactive' }); } catch (e) { return null; }
    master = actx.createGain(); master.gain.value = muted ? 0 : 1; master.connect(actx.destination);   // mute
    bus = actx.createGain(); bus.connect(master);                                                       // engine (idle fade)
    actx.addEventListener('statechange', () => { if (actx.state === 'running') tryStartAudio(); });
    return actx;
  }
  function decode(bytes) {
    return new Promise((res, rej) => { const p = actx.decodeAudioData(bytes, res, rej); if (p && p.then) p.then(res, rej); });
  }
  const metaReady = fetch(AU.meta).then((r) => r.json()).then((m) => {
    META = m;
    const v = m.values, a = Math.round(m.loop_start * m.rate), b = Math.min(v.length, Math.round(m.loop_end * m.rate));
    let sum = 0; for (let i = a; i < b; i++) sum += v[i];
    ENV = { values: v, rate: m.rate, mean: sum / Math.max(1, b - a) };   // centred on the idle level
  }).catch((e) => console.warn('Audio meta unavailable', e));
  let audioReady = Promise.resolve();
  if (FREEZE_T === null && ACtor) {
    ensureContext();
    audioReady = Promise.all([fetch(AU.file).then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); }), metaReady])
      .then(([bytes]) => decode(bytes))
      .then((b) => { buffer = b; tryStartAudio(); })
      .catch((e) => { console.warn('Audio unavailable, running silent', e); });
  }

  function ctxNow() {                    // context time of the sample currently leaving the speaker
    const lat = actx.outputLatency || actx.baseLatency || 0;
    if (actx.getOutputTimestamp) {
      const ts = actx.getOutputTimestamp(), age = performance.now() - ts.performanceTime;
      // right after resume() the timestamp can be stale (performanceTime from before the suspension) -> ignore it
      if (ts.contextTime > 0 && age >= 0 && age < 250) return ts.contextTime + age / 1000;
    }
    return actx.currentTime - lat;
  }
  // Visual clock: performance.now() (never freezes or jumps), slewed towards the audio output clock once the
  // sound is on (max 8 % rate change; snaps only if > 1 s apart, e.g. after the tab was hidden). The audio clock
  // is only trusted while it is advancing.
  let corr = 0, lastPerf = 0, lastCtxT = -1, lastCtxPerf = 0;
  function now() {
    if (FREEZE_T !== null) return FREEZE_T;
    if (!started) return 0;
    const pn = performance.now();
    let tp = (pn - vStart) / 1000 + corr;
    if (audioOn && actx.state === 'running') {
      const ct = actx.currentTime;
      if (ct !== lastCtxT) { lastCtxT = ct; lastCtxPerf = pn; }
      if (pn - lastCtxPerf < 120) {                  // audio clock is moving
        const e = ctxNow() - startAt - tp, dt = Math.min(0.1, Math.max(0, (pn - lastPerf) / 1000));
        if (Math.abs(e) > 1.0) corr += e;
        else { const m = 0.08 * dt; corr += Math.max(-m, Math.min(m, e)); }
        tp = (pn - vStart) / 1000 + corr;
      }
    }
    lastPerf = pn;
    return tp;
  }

  /** Clip position (s in the audio buffer) heard at timeline t; follows the loop. Used for the glow. */
  function clipPos(t) {
    let p = audioOn && src ? aOff + (t - aT0) : t - H.audioStart;   // silent viewing: as if audio were playing
    if (META && p >= META.loop_end) p = META.loop_start + ((p - META.loop_start) % META.loop_len);
    return p;
  }
  /** Timeline time at which the heard audio reaches the idle part. */
  function idleStartT() {
    if (!META) return H.audioStart + 9.15;
    if (audioOn && src && aOff >= META.idle_from) return aT0;
    return H.audioStart + META.idle_from;
  }
  const idleFadeD = () => introCut ? Math.min(AU.idleFadeOnScroll, 0.6) : AU.idleFadeOnScroll;
  function idleGainAt(t) { return idleFadeT === null ? 1 : 1 - ramp(t, idleFadeT, idleFadeD(), ease.inOutSine); }

  function stopSource() {
    if (src) { try { src.stop(); } catch (e) {} try { src.disconnect(); } catch (e) {} }
    src = null; srcGain = null;
  }
  /** Start the engine buffer so that what is heard matches timeline time tv (= now). */
  function scheduleFrom(tv) {
    stopSource();
    const J = META.idle_from, Lp = META.loop_len;
    let when = Math.max(startAt + tv + 0.06, actx.currentTime + 0.03);
    let tS = when - startAt, off = 0, fade = 0;
    if (tS <= H.audioStart) { tS = H.audioStart; when = startAt + tS; }          // before ignition: scheduled in sync
    else {
      const c = tS - H.audioStart;                                                 // where the clip would be now
      if (c < AU.engineHitInClip + AU.lateJoinWindow) { off = c; fade = AU.joinFade; }   // just after ignition: join
      else { off = c >= J ? J + ((c - J) % Lp) : J; fade = AU.idleJoinFade; }            // later: straight into idle
    }
    src = actx.createBufferSource(); src.buffer = buffer;
    src.loop = true; src.loopStart = META.loop_start; src.loopEnd = META.loop_end;
    srcGain = actx.createGain(); src.connect(srcGain); srcGain.connect(bus);
    if (fade > 0) { srcGain.gain.setValueAtTime(0, when); srcGain.gain.linearRampToValueAtTime(1, when + fade); }
    bus.gain.cancelScheduledValues(0); bus.gain.setValueAtTime(1, actx.currentTime);
    src.start(when, off);
    aT0 = tS; aOff = off;
    if (idleFadeT !== null) applyIdleFade();
  }
  function applyIdleFade() {
    if (scrollT === null) return;
    idleFadeT = introCut ? scrollT : Math.max(scrollT, idleStartT());   // normally ignition + blips play out; cut short: fade now
    if (!audioOn || !src) return;
    const w0 = Math.max(startAt + idleFadeT, actx.currentTime), d = idleFadeD();
    bus.gain.cancelScheduledValues(0); bus.gain.setValueAtTime(1, w0);
    // equal-power-ish curve
    const n = 16, curve = new Float32Array(n);
    for (let i = 0; i < n; i++) curve[i] = Math.cos((i / (n - 1)) * Math.PI / 2);
    try { bus.gain.setValueCurveAtTime(curve, w0, d); } catch (e) { bus.gain.linearRampToValueAtTime(0, w0 + d); }
    try { src.stop(w0 + d + 0.05); } catch (e) {}
  }
  function onScrollIntent() {
    if (scrollT !== null || FREEZE_T !== null || !started) return;
    scrollT = now();
    applyIdleFade();
    window.dispatchEvent(new CustomEvent('amg:scrollstart', { detail: { t: scrollT } }));
    for (const f of scrollHooks) { try { f(scrollT); } catch (e) { console.error(e); } }
  }

  /** Called whenever the context may have become runnable (gesture, autoplay, decode finished). */
  let waitClock = false;
  function tryStartAudio() {
    if (audioOn || waitClock || !actx || !buffer || !META || !started || actx.state !== 'running') return;
    // 'running' can be reported before the output actually pulls samples (currentTime still frozen):
    // anchor the audio to the visual timeline only once the context clock is moving.
    waitClock = true;
    const c0 = actx.currentTime, p0 = performance.now();
    const poll = () => {
      if (actx.state !== 'running') { waitClock = false; return; }
      let moving;
      if (actx.getOutputTimestamp) {               // output really running: fresh timestamp with a context time
        const ts = actx.getOutputTimestamp(), age = performance.now() - ts.performanceTime;
        moving = ts.contextTime > 0 && age >= 0 && age < 100;
      } else moving = actx.currentTime - c0 > 0.05;
      if (!moving && performance.now() - p0 < 2500) { setTimeout(poll, 10); return; }
      waitClock = false; anchorAudio();
    };
    poll();
  }
  function anchorAudio() {
    if (audioOn) return;
    const tv = now();
    startAt = ctxNow() - tv;           // the audio clock continues the visual clock (no jump)
    audioOn = true; audioOnAt = performance.now();
    scheduleFrom(tv);
    document.documentElement.dataset.audio = 'on';
    detachGestures();
  }
  // sound is on by default: the first gesture of any kind unlocks the context (iOS / Chrome only honour
  // touchend / click / pointerup / keydown as activation; the rest are tried too). Never blocks the visuals.
  const GESTURES = ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchmove', 'touchend', 'click', 'keydown', 'wheel', 'scroll'];
  function onGesture() {
    if (!actx || audioOn) return;
    if (actx.state !== 'running') {
      try {                              // iOS: play a 1-sample buffer inside the gesture
        const s = actx.createBufferSource(); s.buffer = actx.createBuffer(1, 1, actx.sampleRate); s.connect(actx.destination); s.start(0);
      } catch (e) {}
      const p = actx.resume();
      if (p && p.then) p.then(tryStartAudio, () => {});
    } else tryStartAudio();
  }
  function attachGestures() { for (const e of GESTURES) window.addEventListener(e, onGesture, { capture: true, passive: true }); }
  function detachGestures() { for (const e of GESTURES) window.removeEventListener(e, onGesture, { capture: true }); }

  function setMuted(m) {
    muted = m;
    muteBtn.setAttribute('aria-pressed', String(m));
    muteBtn.setAttribute('aria-label', m ? 'Unmute sound' : 'Mute sound');
    if (master) master.gain.setTargetAtTime(m ? 0 : 1, actx.currentTime, 0.03);
  }
  function replay() {
    scrollT = null; idleFadeT = null; introCut = false;
    vStart = performance.now(); corr = 0;
    if (audioOn) { startAt = ctxNow(); scheduleFrom(0); }
  }

  // scroll intent (there is no scroll section yet: the page itself does not scroll)
  let touchY = null;
  window.addEventListener('wheel', (e) => { if (e.deltaY > 0) onScrollIntent(); }, { passive: true });   // down only, any size
  window.addEventListener('touchstart', (e) => { touchY = e.touches[0] ? e.touches[0].clientY : null; }, { passive: true });
  window.addEventListener('touchmove', (e) => { if (touchY !== null && e.touches[0] && touchY - e.touches[0].clientY >= 5) onScrollIntent(); }, { passive: true });
  window.addEventListener('keydown', (e) => { if (['ArrowDown', 'PageDown', 'End', ' ', 'Spacebar'].includes(e.key)) onScrollIntent(); });
  window.addEventListener('scroll', onScrollIntent, { passive: true });

  // ---------------------------------------------------------------- LED scroll cue (v6)
  // 5x7 dot-matrix "SCROLL" + a 10-dot LED line. Driven every frame by the intro clock (deterministic in ?t= mode):
  // entrance = letters power on left -> right with a short flicker, then the line dots top -> bottom; loop = a light
  // head runs down the line with a trail; the text pulses with the SAME period and phase (peak when the head launches).
  const FONT = {
    S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
    C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
    R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
    O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
    L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  };
  const cueLED = (() => {
    const NS = 'http://www.w3.org/2000/svg', P = 2.6, R = 0.95, word = 'SCROLL', GAP = 2;
    const cols = word.length * 5 + (word.length - 1) * GAP, tw = cols * P, th = 7 * P;
    const nd = C.scrollCue.dots, LP = 4.2, lineTop = th + 9, H = lineTop + (nd - 1) * LP + P;
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${tw} ${H}`); svg.setAttribute('width', tw); svg.setAttribute('height', H);
    svg.innerHTML = `<defs><filter id="cueGlow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="1.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`;
    const off = document.createElementNS(NS, 'g'); off.setAttribute('class', 'cue-off');
    const lit = document.createElementNS(NS, 'g'); lit.setAttribute('class', 'cue-lit'); lit.setAttribute('filter', 'url(#cueGlow)');
    svg.append(off, lit);
    const dot = (g, x, y) => { const c = document.createElementNS(NS, 'circle'); c.setAttribute('cx', x.toFixed(2)); c.setAttribute('cy', y.toFixed(2)); c.setAttribute('r', R); g.appendChild(c); return c; };
    const letters = [];
    [...word].forEach((ch, li) => {
      const x0 = li * (5 + GAP) * P, el = [];
      FONT[ch].forEach((row, r) => [...row].forEach((b, c) => {
        const x = x0 + (c + 0.5) * P, y = (r + 0.5) * P;
        dot(off, x, y); if (b === '1') el.push(dot(lit, x, y));
      }));
      letters.push(el);
    });
    const line = [];
    for (let i = 0; i < nd; i++) { const y = lineTop + i * LP + P / 2; dot(off, tw / 2, y); line.push(dot(lit, tw / 2, y)); }
    cue.textContent = ''; cue.appendChild(svg);
    const lab = document.createElement('span'); lab.className = 'sr-only'; lab.textContent = 'Scroll'; cue.appendChild(lab);
    const FLICK = [1, 0.15, 0.85, 0.3, 1, 0.7, 1];         // power-on flicker (35 ms steps), then steady
    const powerOn = (u, t0) => { if (u < t0) return 0; const k = Math.floor((u - t0) / 0.035); return k < FLICK.length ? FLICK[k] : 1; };
    let last = '';
    function set(el, v) { const s = v.toFixed(3); if (el._v !== s) { el._v = s; el.style.fillOpacity = s; } }
    return function update(t) {
      const u = t - C.loop.scrollCueAt, S = C.scrollCue;
      if (u < -0.05) { if (last !== 'off') { letters.flat().concat(line).forEach((e) => set(e, 0)); last = 'off'; } return; }
      last = 'on';
      if (reducedMotion()) {   // static: no flicker, no running light
        const a = clamp01(u / 0.4);
        letters.forEach((el) => el.forEach((e) => set(e, 0.85 * a)));
        line.forEach((e, i) => set(e, a * (0.75 - 0.5 * i / (nd - 1))));
        return;
      }
      const loopU = u - S.powerOn, ph = loopU >= 0 ? (loopU % S.period) / S.period : -1;
      // text pulse: peak exactly when the head launches (ph = 0), eases off, swells back in just before the next run
      const pulse = ph < 0 ? 0 : Math.max(Math.exp(-ph / 0.2), Math.pow(clamp01((ph - 0.86) / 0.14), 2));
      const textLv = 0.5 + 0.42 * pulse;
      letters.forEach((el, li) => { const p = powerOn(u, 0.06 + li * 0.085); const v = p * (ph < 0 ? 0.8 : textLv); el.forEach((e) => set(e, v)); });
      const head = ph < 0 ? -10 : (ph / 0.72) * (nd + 2.5) - 1;       // head index (runs top -> bottom in 72% of the period)
      line.forEach((e, i) => {
        const on = powerOn(u, 0.62 + i * 0.03), base = 0.16;
        let v = ph < 0 ? 0.7 * (1 - clamp01((u - 0.62 - i * 0.03 - 0.25) / 0.25) * 0.6) : base;
        if (ph >= 0) { const d = head - i; if (d >= -0.5) v = Math.max(base, (d < 0.5 ? 1 : Math.exp(-(d - 0.5) / 1.3)) * (1 - clamp01((ph - 0.72) / 0.2))); }
        set(e, on * v);
      });
    };
  })();

  // ---------------------------------------------------------------- UI timing (DOM bits)
  function updateUI(t) {
    cue.classList.toggle('is-visible', t >= C.loop.scrollCueAt - 0.05 && scrollT === null);
    if (scrollT === null || FREEZE_T !== null) cueLED(t);
    hud.classList.toggle('is-visible', t >= C.loop.hudAt);
  }

  // ---------------------------------------------------------------- entry screen: key fob (config.fob)
  // The intro waits on a black screen with the key fob; T1 / audio preload meanwhile (dataset.ready = 1 as soon as the
  // layers are in). The press is a real user gesture: the AudioContext is resumed right inside it (iOS-safe), the key
  // click + central-locking chirp is synthesised on the same context and the intro starts at once, with sound.
  const FOB = C.fob || {};
  const fobOn = FREEZE_T === null && FOB.enabled !== false && !!document.getElementById('fob') && !(FOB.skipParams || []).some((p) => params.has(p));
  let fobPressed = !fobOn, fobGo = null, fobT = 0;
  function setupFob() {
    const el = document.getElementById('fob'), key = el.querySelector('.fob-key'), img = el.querySelector('.fob-img');
    const hs = Object.assign({ x: 0.5, y: 0.6, w: 0.5, h: 0.11, r: 0.02 }, FOB.hotspot || {});
    const st = el.style;
    st.setProperty('--fob-h', FOB.height || 'min(62vh, 640px)'); st.setProperty('--fob-mw', FOB.maxWidth || '72vw');
    st.setProperty('--fob-src', `url("${new URL(FOB.src, document.baseURI).href}")`);   // absolute (CSS would resolve it against css/)
    st.setProperty('--fob-glow', FOB.glow || '255, 46, 46');
    st.setProperty('--fob-pp', (FOB.pulsePeriod || 3.2) + 's');
    st.setProperty('--fob-tp', (FOB.tracerPeriod || 4.8) + 's'); st.setProperty('--fob-fl', (FOB.float == null ? 1.5 : FOB.float) + 'px');
    st.setProperty('--fob-rim', `url("${new URL(FOB.rim || FOB.src, document.baseURI).href}")`);
    buildGlow(el, hs); preloadFobSound();
    st.setProperty('--fob-in', (reducedMotion() ? 400 : FOB.enterMs || 1600) + 'ms'); st.setProperty('--fob-out', (reducedMotion() ? 300 : FOB.exitMs || 900) + 'ms');
    st.setProperty('--hx', hs.x * 100 + '%'); st.setProperty('--hy', hs.y * 100 + '%'); st.setProperty('--hw', hs.w * 100 + '%'); st.setProperty('--hh', hs.h * 100 + '%');
    el.querySelector('.fob-cap').textContent = FOB.caption || 'Press to start';
    el.querySelector('.fob-ph').hidden = !FOB.placeholder;
    el.hidden = false;
    document.documentElement.dataset.fob = 'waiting';
    const enter = () => requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('is-in')));
    img.addEventListener('load', () => {
      const ar = img.naturalWidth / Math.max(1, img.naturalHeight);
      st.setProperty('--fob-ar', String(ar));
      st.setProperty('--hr', `${hs.r / hs.w * 100}% / ${hs.r * ar / hs.h * 100}%`);   // corner radius (elliptical %, = round corners)
      enter();
    }, { once: true });
    img.addEventListener('error', () => { el.addEventListener('click', press); enter(); }, { once: true });   // no image: tap anywhere
    const refl = el.querySelector('.fob-refl');
    if (FOB.src2x) { img.srcset = `${FOB.src} 1x, ${FOB.src2x} 2x`; if (refl) refl.srcset = img.srcset; }
    img.src = FOB.src; if (refl) refl.src = FOB.src;
    let tx = 0, ty = 0;
    key.addEventListener('touchstart', (e) => { const t = e.touches[0]; tx = t.clientX; ty = t.clientY; }, { passive: true });
    key.addEventListener('touchend', (e) => {            // iOS: unlock inside touchend
      const t = e.changedTouches[0]; if (t && Math.hypot(t.clientX - tx, t.clientY - ty) > 24) return;   // a swipe is not a press
      e.preventDefault(); press();
    }, { passive: false });
    key.addEventListener('click', press);                // mouse / keyboard (Enter, Space) / no-touch-event browsers
    try { key.focus({ preventScroll: true }); } catch (e) {}
    function press() {
      if (fobPressed) return;
      fobPressed = true; fobT = performance.now();
      onGesture();                                       // resume the context synchronously in this gesture
      keyChirp();
      el.classList.remove('is-in'); el.classList.add('is-out');
      document.documentElement.dataset.fob = 'pressed';
      setTimeout(() => { el.hidden = true; document.documentElement.dataset.fob = 'done'; }, (FOB.exitMs || 900) + 400);
      if (fobGo) fobGo();
    }
  }
  /** unlock-button glow: the traced outline (config.fob.button, image px) as svg in the image's own coordinates, so it
   *  scales exactly with the fob at 1x / 2x / any size. Falls back to the hotspot rounded rect. */
  function buildGlow(el, hs) {
    const B = FOB.button;
    let w, h, edge, inner, outer, bbF = null;
    if (B && B.edge) { w = B.w; h = B.h; edge = B.edge; inner = B.inner || B.edge; outer = B.outer || B.edge; }
    else {
      w = 1000; h = 1000 / ((FOB.aspect) || 0.517);
      const rr = (dx) => { const x = (hs.x - hs.w / 2) * w - dx, y = (hs.y - hs.h / 2) * h - dx, W = hs.w * w + 2 * dx, H = hs.h * h + 2 * dx, r = hs.r * w + dx;
        return `M${x + r} ${y} H${x + W - r} A${r} ${r} 0 0 1 ${x + W} ${y + r} V${y + H - r} A${r} ${r} 0 0 1 ${x + W - r} ${y + H} H${x + r} A${r} ${r} 0 0 1 ${x} ${y + H - r} V${y + r} A${r} ${r} 0 0 1 ${x + r} ${y}Z`; };
      edge = rr(0); inner = rr(-5); outer = rr(4); bbF = [(hs.x - hs.w / 2) * w, (hs.y - hs.h / 2) * h, (hs.x + hs.w / 2) * w, (hs.y + hs.h / 2) * h];
    }
    const vb = `0 0 ${w} ${h}`;
    const bloom = el.querySelector('.fob-bloom'), glow = el.querySelector('.fob-glow');
    const bb = bbF || (() => { const n = edge.match(/-?\d+(\.\d+)?/g).map(Number); let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (let i = 0; i + 1 < n.length; i += 2) { x0 = Math.min(x0, n[i]); x1 = Math.max(x1, n[i]); y0 = Math.min(y0, n[i + 1]); y1 = Math.max(y1, n[i + 1]); } return [x0, y0, x1, y1]; })();
    const cx = (bb[0] + bb[2]) / 2, cy = (bb[1] + bb[3]) / 2, r = (bb[2] - bb[0]) * 0.62;
    for (const s of [bloom, glow]) { s.setAttribute('viewBox', vb); s.setAttribute('preserveAspectRatio', 'xMidYMid meet'); }
    bloom.innerHTML = `<path d="${edge}"/>`;
    glow.innerHTML = `<defs><radialGradient id="fobFlash" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${cy}" r="${r}" gradientTransform="translate(${cx} ${cy}) scale(1 ${((bb[3] - bb[1]) / (bb[2] - bb[0]) * 1.5).toFixed(3)}) translate(${-cx} ${-cy})">`
      + `<stop offset="0" stop-color="rgb(255,235,228)" stop-opacity=".85"/><stop offset=".35" stop-color="rgb(${FOB.glow || '255, 46, 46'})" stop-opacity=".7"/>`
      + `<stop offset="1" stop-color="rgb(${FOB.glow || '255, 46, 46'})" stop-opacity=".28"/></radialGradient></defs>`
      + `<path class="fg-flash" d="${edge}"/><path class="fg-outer fg-draw" pathLength="100" d="${outer}"/>`
      + `<path class="fg-inner fg-draw" pathLength="100" d="${inner}"/>`
      + (FOB.tracerPeriod === 0 ? '' : `<path class="fg-trace" pathLength="100" d="${edge}"/>`);
  }
  /** real unlock recording (config.fob.sound), fetched + decoded while the fob screen is up */
  let fobBuf = null;
  function preloadFobSound() {
    if (!FOB.sound || !actx) return;
    fetch(FOB.sound).then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); })
      .then((b) => decode(b)).then((b) => { fobBuf = b; }).catch((e) => console.warn('fob sound unavailable, using synth', e));
  }
  /** press sound: the recorded Mercedes central-locking actuators; synthesised click + thunk + chirp as the fallback.
   *  Plays on the engine context (follows mute). */
  function keyChirp() {
    if (!actx || !master) return;
    if (fobBuf) {
      try {
        const s = actx.createBufferSource(), g = actx.createGain();
        s.buffer = fobBuf; g.gain.value = FOB.soundGain == null ? 0.9 : FOB.soundGain;
        s.connect(g); g.connect(master); s.start(actx.currentTime + 0.005);
        return;
      } catch (e) { console.warn('fob sound failed', e); }
    }
    try {
      const t0 = actx.currentTime + 0.01, G = FOB.chirpGain == null ? 0.55 : FOB.chirpGain, sr = actx.sampleRate;
      const out = actx.createGain(); out.gain.value = G; out.connect(master);
      const noise = (dur) => { const b = actx.createBuffer(1, Math.ceil(dur * sr), sr), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; };
      const burst = (at, dur, type, f, q, peak, decay) => {
        const s = actx.createBufferSource(); s.buffer = noise(dur);
        const flt = actx.createBiquadFilter(); flt.type = type; flt.frequency.value = f; flt.Q.value = q;
        const g = actx.createGain(); g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(peak, at + 0.0015); g.gain.exponentialRampToValueAtTime(0.0008, at + decay);
        s.connect(flt); flt.connect(g); g.connect(out); s.start(at); s.stop(at + dur);
      };
      const tone = (at, dur, f0, f1, type, peak) => {
        const o = actx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, at); o.frequency.exponentialRampToValueAtTime(f1, at + dur);
        const g = actx.createGain(); g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(peak, at + 0.004); g.gain.setValueAtTime(peak, at + dur * 0.6); g.gain.exponentialRampToValueAtTime(0.0008, at + dur);
        o.connect(g); g.connect(out); o.start(at); o.stop(at + dur + 0.02);
      };
      burst(t0, 0.02, 'bandpass', 3800, 1.4, 0.55, 0.012);          // button press click
      burst(t0 + 0.085, 0.02, 'bandpass', 2600, 1.2, 0.25, 0.010);  // button release
      burst(t0 + 0.17, 0.09, 'lowpass', 700, 0.8, 0.9, 0.075);      // door-lock actuators: thunk
      tone(t0 + 0.17, 0.09, 120, 55, 'sine', 0.5);
      burst(t0 + 0.205, 0.05, 'bandpass', 1500, 2.0, 0.22, 0.04);   // latch rattle
      tone(t0 + 0.26, 0.055, 2450, 2300, 'triangle', 0.16);         // chirp chirp
      tone(t0 + 0.355, 0.07, 2450, 2250, 'triangle', 0.14);
    } catch (e) { console.warn('key chirp failed', e); }
  }

  // ---------------------------------------------------------------- main
  let running = false;
  function frame() {
    if (!M || Object.keys(IMG).length < Object.keys(M.layers).length) { if (running) requestAnimationFrame(frame); return; }
    const t = now();
    if (!window.__t1Covered) render(t);   // T1 (js/t1.js) fully covers the scene: skip the intro draw
    updateUI(t);
    if (running) requestAnimationFrame(frame);
  }

  async function boot() {
    resize();
    window.addEventListener('resize', () => { resize(); scheduleCache(false); if (!running) frame(); });
    if (FREEZE_T === null) attachGestures();       // a gesture during loading still unlocks the context
    if (fobOn) setupFob();                         // entry screen first; the layers / T1 / audio load behind it
    try {
      await Promise.all([loadLayers(() => {}), FREEZE_T !== null ? metaReady : Promise.resolve()]);
    } catch (e) { console.error(e); return; }
    document.documentElement.dataset.set = SET;
    resize(); scheduleCache(true);                 // resample every layer once to its on-screen size
    hud.hidden = false;

    if (FREEZE_T !== null) {                      // preview / debug mode: static frame, no audio
      document.documentElement.classList.add('freeze');
      frame();
      document.documentElement.dataset.ready = '1';
      return;
    }
    document.documentElement.dataset.ready = '1';   // T1 starts preloading now (also while the fob is shown)
    if (!fobPressed) await new Promise((r) => { fobGo = r; });
    // the intro clock starts at the press, a little in, so its unlock flash lands on the key chirp
    vStart = (fobOn ? Math.min(performance.now(), fobT) : performance.now()) - (fobOn ? (FOB.introOffset || 0) * 1000 : 0); started = true;
    running = true; requestAnimationFrame(frame);
    document.documentElement.dataset.autoplay = actx ? actx.state : 'none';   // 'running' = autoplay allowed
    tryStartAudio();                               // autoplay-allowed browsers (or a gesture during loading)

    muteBtn.addEventListener('click', () => {
      if (!audioOn || performance.now() - audioOnAt < 700) return;   // that click just turned the sound on
      setMuted(!muted);
    });
    replayBtn.addEventListener('click', () => replay());
    document.addEventListener('visibilitychange', () => {
      if (!actx || !audioOn) return;
      if (document.hidden) actx.suspend(); else actx.resume();   // audio clock pauses -> visuals stay in sync
    });
  }

  // expose for hand-off / testing (e.g. Playwright, the future scroll segment)
  window.AMGIntro = {
    render: (t) => render(t), now, config: C, cues: H,
    get set() { return SET; }, get manifest() { return M; }, get view() { return view; },
    get audioOn() { return audioOn; }, get scrollT() { return scrollT; }, clipPos,
    get clockError() { return audioOn ? ctxNow() - startAt - now() : null; },
    /** hook for scroll sounds / the next section */
    onScrollStart(fn) { scrollHooks.push(fn); },
    scrollStart: onScrollIntent,
    cutShort() { if (FREEZE_T !== null || !started || introCut) return; introCut = true; if (scrollT === null) onScrollIntent(); else applyIdleFade(); },
    replay,
    audio: {
      get ctx() { return actx; }, get output() { return master; },   // connect future scroll sounds to `output` (respects mute)
      get ready() { return audioReady; }, get meta() { return META; },
      get state() { return { audioOn, ctx: actx && actx.state, aT0, aOff, startAt, idleFadeT, loop: src ? [src.loopStart, src.loopEnd] : null }; },
    },
  };
  boot();
})();
