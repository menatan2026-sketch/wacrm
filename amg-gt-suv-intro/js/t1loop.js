/* S1 road loop — an endless, procedurally driven 2.5D shot built from T1's last frame (no generated video).
 * The plate (car, markings and lamps removed by LaMa) is split into lighting L (blurred, camera-locked: sky / lamp
 * reflections / taillight glow stay put) and detail (plate / L), which flows along the real road geometry: a
 * calibrated camera gives homographies for the road plane, the guardrail plane and the cliff wall, and the detail is
 * advected along each plane's v axis with two-phase flow + shutter blur. On top: procedural dashed lane / edge lines
 * (box-filtered for motion blur), passing guardrail lamps with wet-road streaks and light pools, rear-wheel spray,
 * drifting valley mist and clouds, the BiRefNet-cut car with spinning wheels (rotational blur) and suspension bob.
 * Every moving term is periodic in 24 m of travel or in its own phase, so it loops forever with no seam or reversal.
 * Output: an FBO texture in T1 frame space, consumed by t1.js's FX pass as if it were the next video frame. */
(function () {
  'use strict';
  const VS = `attribute vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }`;
  const FS = `precision highp float;
uniform sampler2D plate, light, zone, car, nz;
uniform vec2 kf;
uniform mat3 Hg, Hgi, Hr, Hri, Hw, Hwi;
uniform float off, tm, ph, LF, BL, ug, hy;
uniform vec4 carR; uniform vec2 bob;
uniform vec4 wF, wR; uniform float wA, wS;
uniform vec4 lp[8]; uniform vec4 lr[8]; uniform vec4 lg[8];
uniform vec4 spr;  uniform vec2 sprD;
const vec2 S = vec2(1920., 1080.);
vec2 pj(mat3 H, vec2 a){ vec3 q = H * vec3(a, 1.); return q.xy / q.z; }
vec3 pl(vec2 q){ return texture2D(plate, clamp(q / S, vec2(.0005), vec2(.9995))).rgb; }
vec3 lt(vec2 q){ return texture2D(light, clamp(q / S, vec2(.002), vec2(.998))).rgb; }
float inb(vec2 q){ vec2 e = min(q, S - q); return clamp(min(e.x, e.y) / 30. + 1., 0., 1.); }
float lum(vec3 c){ return dot(c, vec3(.2126, .7152, .0722)); }
// detail ratio of the plate, advected along a plane's b axis (two phases, 3-tap shutter each)
vec3 flow(mat3 H, vec2 ab, out float ok){
  vec3 acc = vec3(0.); ok = 1.;
  float pa = ph, pb = fract(ph + .5);
  float wa = 1. - abs(2. * pa - 1.);
  for (int k = 0; k < 2; k++) {
    float phs = k == 0 ? pa : pb, w = k == 0 ? wa : 1. - wa;
    vec3 s = vec3(0.);
    for (int j = 0; j < 3; j++) {
      float d = phs * LF + (float(j) - 1.) * BL * .5;
      vec2 q = pj(H, vec2(ab.x, ab.y - d));
      ok = min(ok, mix(1., inb(q), w));
      s += pl(q) / max(lt(q), vec3(.012));
    }
    acc += s / 3. * w;
  }
  return clamp(acc, 0., 3.);
}
float sqw(float x, float duty){ return floor(x) * duty + min(fract(x), duty); }   // integral of a square wave
float dash(float v, float per, float len, float w){                                  // box-filtered dash coverage
  float a = (v - w * .5) / per, b = (v + w * .5) / per;
  return (sqw(b, len / per) - sqw(a, len / per)) * per / w;
}
float lineC(float u, float c, float hw, float du){ return clamp((hw - abs(u - c)) / du + .5, 0., 1.); }
void main(){
  vec2 p = gl_FragCoord.xy * kf;                  // T1 frame px, y down (FBO row 0 = image top, like an uploaded frame)
  vec3 base = pl(p), L = lt(p);
  vec3 zn = texture2D(zone, p / S).rgb;
  vec3 col = base;
  float isG = 0.;
  vec2 g = pj(Hgi, p);
  if (p.y > hy + 1.5 && g.x < ug) {               // ---- road plane
    isG = 1.;
    float ok; vec3 det = flow(Hg, g, ok);
    vec2 nt = vec2(g.x / 6.4, (g.y - off) / 24.);
    vec4 n = texture2D(nz, nt);
    float D = .86 + .28 * n.r;
    vec3 rd = L * mix(base / max(L, vec3(.012)), det, ok) * D;
    // light pools of the passing lamps
    float pool = 0.;
    for (int i = 0; i < 8; i++) { vec2 dd = (g - lg[i].xy) / vec2(2.2, 4.5); pool += lg[i].z * exp(-dot(dd, dd)); }
    rd += vec3(1., .58, .28) * pool * (.10 + .25 * smoothstep(.45, .8, n.g));
    // wet-road reflections of the lamps: tall soft streaks under each
    for (int i = 0; i < 8; i++) {
      vec2 dd = (p - lr[i].xy) / vec2(lr[i].z * 1.6, lr[i].z * 9.);
      rd += vec3(1., .6, .3) * lr[i].w * exp(-dot(dd, dd)) * (.55 + .45 * n.g);
    }
    // markings: dashed centre line, solid edge lines. Footprint-aware AA + shutter blur along v.
    float du = max(fwidthApprox(g.x), .004);
    float dv = BL + max(fwidthApprox(g.y), .01);
    float cm = lineC(g.x, 0., .075, du) * dash(g.y - off, 12., 4.5, dv);
    cm += lineC(g.x, 3.55, .08, du) + lineC(g.x, -3.55, .08, du) * .8;
    vec3 paint = vec3(.70, .71, .73) * (.35 + 1.7 * lum(L)) * (.85 + .3 * n.r);
    rd = mix(rd, paint, clamp(cm, 0., 1.) * .88 * smoothstep(hy + 2., hy + 14., p.y));
    col = rd;
  } else {
    vec2 r = pj(Hri, p);                          // ---- guardrail plane (rail, posts, verge behind it)
    if (r.x > -3. && r.y < .84 && p.y > hy - 400.) {
      float ok; vec3 det = flow(Hr, r, ok);
      float A = (1. - smoothstep(40., 120., r.x)) * ok;
      col = L * mix(base / max(L, vec3(.012)), det, A);
    } else if (zn.g > .003) {                     // ---- near cliff wall
      vec2 w = pj(Hwi, p);
      float ok; vec3 det = flow(Hw, w, ok);
      col = L * mix(base / max(L, vec3(.012)), det, zn.g * ok);
    }
  }
  // sky / valley: slow cloud drift (domain warp) and moving mist banks
  if (zn.r > .01) {
    vec2 o = (texture2D(nz, p / S * vec2(1.3, 2.) + vec2(tm * .004, 0.)).aa - .5) * vec2(9., 3.);
    col = mix(col, pl(p + o + vec2(tm * 1.2 - 6., 0.) * .0), zn.r);
  }
  if (zn.b > .01) {
    float m1 = texture2D(nz, p / S * vec2(1.6, 3.) + vec2(tm * .010, tm * .001)).a;
    float m2 = texture2D(nz, p / S * vec2(3.1, 5.) - vec2(tm * .017, 0.)).a;
    float m = (m1 * .65 + m2 * .35) - .5;
    col += vec3(.55, .60, .68) * m * .16 * zn.b;
  }
  // lamps (warm guardrail lights) with soft halo
  for (int i = 0; i < 8; i++) {
    vec2 dd = (p - lp[i].xy) / lp[i].z; float d2 = dot(dd, dd);
    col += vec3(1., .66, .34) * lp[i].w * (exp(-d2 * 1.6) * 1.2 + exp(-d2 * .05) * .10);
  }
  // rear-wheel spray: a thin plume streaming back toward the vanishing point
  {
    vec2 d = p - spr.xy; float a = dot(d, sprD), b = dot(d, vec2(-sprD.y, sprD.x));
    if (a > -20. && a < 900.) {
      float wd = 18. + a * .16;
      float sh = exp(-pow((b + a * .05) / wd, 2.)) * smoothstep(-20., 60., a) * exp(-a / 360.);
      float n = texture2D(nz, vec2(a / 900. - tm * 1.7, b / 220. + .3)).a;
      float n2 = texture2D(nz, vec2(a / 420. - tm * 2.9, b / 120. + .7)).r;
      col += (L * 1.4 + vec3(.05, .055, .06)) * sh * smoothstep(.35, .8, n * .7 + n2 * .3) * spr.z;
    }
  }
  // the car
  vec2 cp = p - bob; float ca = 0.;
  vec2 cu = (cp - carR.xy) / carR.zw;
  if (cu.x > 0. && cu.y > 0. && cu.x < 1. && cu.y < 1.) {
    vec4 cc = texture2D(car, cu);
    for (int k = 0; k < 2; k++) {
      vec4 W = k == 0 ? wF : wR;
      vec2 q = (cp - W.xy) / W.zw; float rr = length(q);
      if (rr < 1.) {
        vec3 acc = vec3(0.);
        for (int j = 0; j < 7; j++) {
          float an = wA + (float(j) / 6. - .5) * wS; float cs = cos(an), sn = sin(an);
          vec2 qq = vec2(cs * q.x - sn * q.y, sn * q.x + cs * q.y) * W.zw + W.xy;
          acc += texture2D(car, (qq - carR.xy) / carR.zw).rgb;
        }
        cc.rgb = mix(cc.rgb, acc / 7., 1. - smoothstep(.86, .97, rr));
      }
    }
    col = mix(col, cc.rgb, cc.a); ca = cc.a;
  }
  gl_FragColor = vec4(clamp(col, 0., 1.), ca);
}`;

  function m3cols(M) { return new Float32Array([M[0][0], M[1][0], M[2][0], M[0][1], M[1][1], M[2][1], M[0][2], M[1][2], M[2][2]]); }
  function inv3(m) {
    const [a, b, c] = m[0], [d, e, f] = m[1], [g, h, i] = m[2];
    const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g, det = a * A + b * B + c * C;
    return [[A / det, -(b * i - c * h) / det, (b * f - c * e) / det], [B / det, (a * i - c * g) / det, -(a * f - c * d) / det], [C / det, -(a * h - b * g) / det, (a * e - b * d) / det]];
  }
  function noiseTex(N) {                 // tileable value-noise channels: r road streaks, g puddles, b rock, a fbm
    const out = new Uint8Array(N * N * 4);
    let seed = 1234567;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const layer = (nx, ny) => { const g = new Float32Array(nx * ny); for (let i = 0; i < g.length; i++) g[i] = rnd(); return { nx, ny, g }; };
    const sm = (t) => t * t * (3 - 2 * t);
    const val = (L, x, y) => {            // x,y in [0,1)
      const fx = x * L.nx, fy = y * L.ny, ix = Math.floor(fx), iy = Math.floor(fy), tx = sm(fx - ix), ty = sm(fy - iy);
      const i0 = ix % L.nx, i1 = (ix + 1) % L.nx, j0 = iy % L.ny, j1 = (iy + 1) % L.ny;
      const a = L.g[j0 * L.nx + i0], b = L.g[j0 * L.nx + i1], c = L.g[j1 * L.nx + i0], d = L.g[j1 * L.nx + i1];
      return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
    };
    const ch = [[[64, 4, .5], [128, 8, .3], [256, 16, .2]], [[8, 4, .55], [16, 8, .3], [32, 16, .15]],
      [[32, 4, .5], [64, 8, .3], [128, 16, .2]], [[4, 4, .5], [8, 8, .25], [16, 16, .15], [32, 32, .1]]]
      .map((oc) => oc.map(([nx, ny, w]) => ({ L: layer(nx, ny), w })));
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      for (let k = 0; k < 4; k++) {
        let v = 0; for (const o of ch[k]) v += val(o.L, x / N, y / N) * o.w;
        v = k === 0 ? Math.pow(v, 1.6) * 1.6 : v;
        out[(y * N + x) * 4 + k] = Math.max(0, Math.min(255, Math.round(v * 255)));
      }
    }
    return out;
  }

  window.AMGLoop = function (gl, opt) {
    const mobile = !!opt.mobile, base = opt.base || 'assets/loop/';
    const FW = mobile ? 1280 : 1920, FH = mobile ? 720 : 1080;
    const st = { ready: false, tex: null, err: null };
    let prog, U = {}, fbo, meta, buf;
    const T = {};
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o);
      if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
    function mkTex(unit, src, w, h, data, repeat) {
      const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      if (src) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
      else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
      if (repeat) { gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); }
      else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      const wr = repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wr); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wr);
      return t;
    }
    const img = (u) => new Promise((res, rej) => { const i = new Image(); i.decoding = 'async'; i.onload = () => res(i); i.onerror = rej; i.src = base + u; });
    async function load() {
      meta = await (await fetch(base + 'loop.json')).json();
      const [ip, il, iz, ic] = await Promise.all([img(mobile ? 'loop_plate_m.webp' : 'loop_plate.webp'), img('loop_light.png'),
        img('loop_zone.png'), img(mobile ? 'loop_car_m.webp' : 'loop_car.webp')]);
      const fs = FS.replace(/fwidthApprox/g, 'fw');
      const fsx = fs.replace('void main(){', 'float fw(float x){ return 0.; }\nvoid main(){');
      // footprint terms: computed analytically instead of OES derivatives (WebGL1 baseline)
      prog = gl.createProgram();
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, derivSrc(fsx)));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      gl.useProgram(prog);
      for (const n of ['plate', 'light', 'zone', 'car', 'nz', 'kf', 'Hg', 'Hgi', 'Hr', 'Hri', 'Hw', 'Hwi', 'off', 'tm', 'ph', 'LF', 'BL', 'ug', 'hy',
        'carR', 'bob', 'wF', 'wR', 'wA', 'wS', 'lp', 'lr', 'lg', 'spr', 'sprD']) U[n] = gl.getUniformLocation(prog, n);
      buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      T.plate = mkTex(3, ip); T.light = mkTex(4, il); T.zone = mkTex(5, iz); T.car = mkTex(6, ic);
      T.nz = mkTex(7, null, 256, 256, noiseTex(256), true);
      st.tex = gl.createTexture(); gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, st.tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, FW, FH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      fbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, st.tex, 0);
      const okF = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      if (!okF) throw new Error('loop fbo incomplete');
      const P = meta.P, col = (j) => [P[0][j], P[1][j], P[2][j]];
      const fromCols = (a, b, c) => [[a[0], b[0], c[0]], [a[1], b[1], c[1]], [a[2], b[2], c[2]]];
      const P1 = col(0), P2 = col(1), P3 = col(2), P4 = col(3);
      const comb = (u) => [u * P1[0] + P4[0], u * P1[1] + P4[1], u * P1[2] + P4[2]];
      const Hg = fromCols(P1, P2, P4), Hr = fromCols(P2, P3, comb(meta.ug)), Hw = fromCols(P2, P3, comb(meta.uw));
      gl.uniformMatrix3fv(U.Hg, false, m3cols(Hg)); gl.uniformMatrix3fv(U.Hgi, false, m3cols(inv3(Hg)));
      gl.uniformMatrix3fv(U.Hr, false, m3cols(Hr)); gl.uniformMatrix3fv(U.Hri, false, m3cols(inv3(Hr)));
      gl.uniformMatrix3fv(U.Hw, false, m3cols(Hw)); gl.uniformMatrix3fv(U.Hwi, false, m3cols(inv3(Hw)));
      meta.HgiM = inv3(Hg);
      const ci = { plate: 3, light: 4, zone: 5, car: 6, nz: 7 };
      for (const k in ci) gl.uniform1i(U[k], ci[k]);
      gl.uniform2f(U.kf, 1920 / FW, 1080 / FH); gl.uniform1f(U.ug, meta.ug); gl.uniform1f(U.hy, meta.vp[1]);
      const c = meta.car; gl.uniform4f(U.carR, c[0], c[1], c[2], c[3]);
      const w = meta.wheels; gl.uniform4f(U.wF, w[0][0], w[0][1], w[0][2], w[0][3]); gl.uniform4f(U.wR, w[1][0], w[1][1], w[1][2], w[1][3]);
      const sx = 1236, sy = 712, vx = meta.vp[0] - sx, vy = meta.vp[1] - sy, vl = Math.hypot(vx, vy);
      gl.uniform4f(U.spr, sx, sy, 0.10, 0); gl.uniform2f(U.sprD, vx / vl, vy / vl);
      st.ready = true;
    }
    // footprint (metres per px) of the ground coords, computed on the CPU-free path: finite differences of Hgi
    function derivSrc(s) {
      return s.replace('float fw(float x){ return 0.; }', '')
        .replace('float du = max(fw(g.x), .004);', 'vec2 gx = pj(Hgi, p + vec2(1.5, 0.)) - g, gy = pj(Hgi, p + vec2(0., 1.5)) - g;\n    float du = max(max(abs(gx.x), abs(gy.x)) / 1.5 * kf.x, .004);')
        .replace('float dv = BL + max(fw(g.y), .01);', 'float dv = BL + max(max(abs(gx.y), abs(gy.y)) / 1.5 * kf.x, .01);');
    }
    const SPEED = opt.speed || 17;                      // m/s of travel
    const LAMP = 24, NL = 8, lpA = new Float32Array(32), lrA = new Float32Array(32), lgA = new Float32Array(32);
    function proj(X) { const P = meta.P; const x = P[0][0] * X[0] + P[0][1] * X[1] + P[0][2] * X[2] + P[0][3];
      const y = P[1][0] * X[0] + P[1][1] * X[1] + P[1][2] * X[2] + P[1][3]; const z = P[2][0] * X[0] + P[2][1] * X[1] + P[2][2] * X[2] + P[2][3];
      return [x / z, y / z, z]; }
    st.render = function (t) {
      if (!st.ready) return false;
      const dist = t * SPEED, off = dist % LAMP;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.viewport(0, 0, FW, FH);
      gl.useProgram(prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf); const loc = gl.getAttribLocation(prog, 'p');
      gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      for (const [u, k] of [[3, 'plate'], [4, 'light'], [5, 'zone'], [6, 'car'], [7, 'nz']]) { gl.activeTexture(gl.TEXTURE0 + u); gl.bindTexture(gl.TEXTURE_2D, T[k]); }
      gl.uniform1f(U.off, off); gl.uniform1f(U.tm, t % 5000);   // every drift rate × 5000 s is a whole texture period: seamless wrap
      const rate = 2.2, LF = SPEED / rate;                // two-phase flow: 2.2 Hz cycle, 7.7 m stroke
      gl.uniform1f(U.ph, (t * rate) % 1); gl.uniform1f(U.LF, LF); gl.uniform1f(U.BL, SPEED / 60);
      for (let i = 0; i < NL; i++) {
        const v = i * LAMP + off - 6, f = Math.min(1, Math.max(0, (v + 2) / 6)) * Math.min(1, Math.max(0, (180 - v) / 30));
        const a = proj([meta.ug, v, 0.92]), b = proj([meta.ug, v, -0.92]);
        const ok = a[2] > 0.5 ? f : 0, r = 0.055 * 2400 / Math.max(0.5, a[2]);
        lpA.set([a[0], a[1], Math.max(1.2, r), ok * 0.9], i * 4);
        lrA.set([b[0], b[1], Math.max(1.2, r), ok * 0.22], i * 4);
        lgA.set([meta.ug - 0.6, v, ok, 0], i * 4);
      }
      gl.uniform4fv(U.lp, lpA); gl.uniform4fv(U.lr, lrA); gl.uniform4fv(U.lg, lgA);
      const bob = 0.9 * Math.sin(t * 7.3) * Math.sin(t * 2.1 + 1) + 0.5 * Math.sin(t * 13.7 + 2) + 0.3 * Math.sin(t * 23.1);
      gl.uniform2f(U.bob, 0.25 * Math.sin(t * 5.1), bob);
      gl.uniform1f(U.wA, -(t * 9.0) % (Math.PI * 2)); gl.uniform1f(U.wS, 0.7);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return true;
    };
    load().catch((e) => { st.err = e; console.warn('[loop] init failed, falling back to the frame hold', e); });
    return st;
  };
})();
