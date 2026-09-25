import * as THREE from "three";

/**
 * Small procedural textures generated on the client — no downloads.
 * Cached so every material shares one GPU texture.
 */

const cache = new Map<string, THREE.Texture>();

function canvas(size: number) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  return [c, c.getContext("2d")!] as const;
}

/**
 * Metallic-flake normal map: every texel is a randomly tilted micro-mirror.
 * Under the clear coat it reads as the sparkle of real metallic paint.
 */
export function flakeNormalMap(): THREE.Texture | null {
  if (typeof document === "undefined") return null;
  const hit = cache.get("flake");
  if (hit) return hit;
  const size = 256;
  const [c, g] = canvas(size);
  const img = g.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    // Mostly facing up, occasionally strongly tilted — like real flakes.
    const strong = Math.random() < 0.12;
    const spread = strong ? 0.6 : 0.15;
    const x = (Math.random() * 2 - 1) * spread;
    const y = (Math.random() * 2 - 1) * spread;
    const z = Math.sqrt(Math.max(0, 1 - x * x - y * y));
    img.data[i * 4] = (x * 0.5 + 0.5) * 255;
    img.data[i * 4 + 1] = (y * 0.5 + 0.5) * 255;
    img.data[i * 4 + 2] = (z * 0.5 + 0.5) * 255;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(180, 180);
  t.colorSpace = THREE.NoColorSpace;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.anisotropy = 8;
  cache.set("flake", t);
  return t;
}

/** Fine directional streaks for brushed / machined metal (roughness map). */
export function brushedRoughnessMap(): THREE.Texture | null {
  if (typeof document === "undefined") return null;
  const hit = cache.get("brushed");
  if (hit) return hit;
  const size = 512;
  const [c, g] = canvas(size);
  g.fillStyle = "#6a6a6a";
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < 2600; i++) {
    const y = Math.random() * size;
    const v = 70 + Math.random() * 90;
    g.strokeStyle = `rgba(${v},${v},${v},${0.25 + Math.random() * 0.35})`;
    g.lineWidth = Math.random() * 1.4;
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(size, y + (Math.random() - 0.5) * 3);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(4, 4);
  t.colorSpace = THREE.NoColorSpace;
  t.anisotropy = 8;
  tileSize(t, 0.12);
  cache.set("brushed", t);
  return t;
}

/** Subtle grain for leather and rubber (bump map). */
export function grainMap(): THREE.Texture | null {
  if (typeof document === "undefined") return null;
  const hit = cache.get("grain");
  if (hit) return hit;
  const size = 256;
  const [c, g] = canvas(size);
  const img = g.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const v = 110 + Math.random() * 40;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  g.filter = "blur(1px)";
  g.drawImage(c, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(10, 10);
  t.colorSpace = THREE.NoColorSpace;
  cache.set("grain", t);
  return t;
}

/** Carbon-fibre twill, loaded from /textures (three.js example asset). */
export function carbonMaps(): { map: THREE.Texture; normalMap: THREE.Texture } | null {
  if (typeof document === "undefined") return null;
  const hit = cache.get("carbon");
  const hitN = cache.get("carbon_n");
  if (hit && hitN) return { map: hit, normalMap: hitN };
  const loader = new THREE.TextureLoader();
  const map = loader.load("/textures/carbon.png");
  const normalMap = loader.load("/textures/carbon_normal.png");
  for (const t of [map, normalMap]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(10, 10);
    t.anisotropy = 8;
  }
  map.colorSpace = THREE.SRGBColorSpace;
  tileSize(map, 0.05);
  tileSize(normalMap, 0.05);
  cache.set("carbon", map);
  cache.set("carbon_n", normalMap);
  return { map, normalMap };
}

/* ── Procedural surface library ────────────────────────────────────
 * Heightfields are built on the CPU (seamlessly tiling), then turned
 * into normal maps. Colour-ish data is packed for the leather shader:
 * R = stitch mask, G = shading (1 = open surface, 0 = pore / hole).
 */

function hash2(x: number, y: number, seed: number) {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/** Tiling value noise with `period` cells across the tile. */
function valueNoise(u: number, v: number, period: number, seed: number) {
  const x = u * period;
  const y = v * period;
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const w = (i: number) => ((i % period) + period) % period;
  const a = hash2(w(xi), w(yi), seed);
  const b = hash2(w(xi + 1), w(yi), seed);
  const c = hash2(w(xi), w(yi + 1), seed);
  const d = hash2(w(xi + 1), w(yi + 1), seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

function fbm(u: number, v: number, period: number, octaves: number, seed: number) {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += valueNoise(u, v, period << o, seed + o * 17) * amp;
    norm += amp;
    amp *= 0.5;
  }
  return sum / norm;
}

/** Tiling cellular noise: returns F2 - F1 (0 on cell borders). */
function cellular(u: number, v: number, period: number, seed: number) {
  const x = u * period;
  const y = v * period;
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  let f1 = 9;
  let f2 = 9;
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const cx = xi + i;
      const cy = yi + j;
      const wx = ((cx % period) + period) % period;
      const wy = ((cy % period) + period) % period;
      const px = cx + hash2(wx, wy, seed);
      const py = cy + hash2(wx, wy, seed + 7);
      const d = Math.hypot(px - x, py - y);
      if (d < f1) {
        f2 = f1;
        f1 = d;
      } else if (d < f2) f2 = d;
    }
  }
  return f2 - f1;
}

function heightToNormal(h: Float32Array, w: number, hh: number, strength: number) {
  const out = new Uint8ClampedArray(w * hh * 4);
  for (let y = 0; y < hh; y++) {
    for (let x = 0; x < w; x++) {
      const l = h[y * w + ((x - 1 + w) % w)];
      const r = h[y * w + ((x + 1) % w)];
      const u = h[((y - 1 + hh) % hh) * w + x];
      const d = h[((y + 1) % hh) * w + x];
      const nx = (l - r) * strength;
      const ny = (d - u) * strength;
      const len = Math.hypot(nx, ny, 1);
      const i = (y * w + x) * 4;
      out[i] = (nx / len * 0.5 + 0.5) * 255;
      out[i + 1] = (ny / len * 0.5 + 0.5) * 255;
      out[i + 2] = (1 / len * 0.5 + 0.5) * 255;
      out[i + 3] = 255;
    }
  }
  return out;
}

/** Physical size of one texture tile, metres (used to retile per model UV density). */
export function tileSize(t: THREE.Texture, w: number, h = w) {
  t.userData.tile = [w, h];
  return t;
}

function dataTexture(data: Uint8ClampedArray, w: number, h: number, repeat: number, srgb = false) {
  const [c, g] = canvas(1);
  c.width = w;
  c.height = h;
  g.putImageData(new ImageData(data as unknown as Uint8ClampedArray<ArrayBuffer>, w, h), 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  return t;
}

function cached<T>(key: string, make: () => T): T | null {
  if (typeof document === "undefined") return null;
  const hit = cache.get(key) as unknown as T | undefined;
  if (hit) return hit;
  const v = make();
  cache.set(key, v as unknown as THREE.Texture);
  return v;
}

/** Full-grain pebbled hide: cellular grain + fine pores. */
export function leatherMaps() {
  return cached("leather", () => {
    const n = 512;
    const h = new Float32Array(n * n);
    const pack = new Uint8ClampedArray(n * n * 4);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const u = x / n;
        const v = y / n;
        const cell = Math.min(1, cellular(u, v, 38, 3) * 2.2);
        const pores = fbm(u, v, 64, 2, 11);
        const hv = Math.pow(cell, 0.6) * 0.8 + pores * 0.2;
        h[y * n + x] = hv;
        const i = (y * n + x) * 4;
        pack[i] = 0;
        pack[i + 1] = 150 + hv * 105;
        pack[i + 2] = 0;
        pack[i + 3] = 255;
      }
    }
    const rough = new Uint8ClampedArray(n * n * 4);
    for (let i = 0; i < n * n; i++) {
      const r = 150 + (1 - h[i]) * 80;
      rough[i * 4] = rough[i * 4 + 1] = rough[i * 4 + 2] = r;
      rough[i * 4 + 3] = 255;
    }
    return {
      map: tileSize(dataTexture(pack, n, n, 1), 0.05),
      normalMap: tileSize(dataTexture(heightToNormal(h, n, n, 3.2), n, n, 1), 0.05),
      roughnessMap: tileSize(dataTexture(rough, n, n, 1), 0.05),
    };
  });
}

/**
 * Diamond-quilted, perforated hide with stitched seams — one diamond per
 * tile, so it lines up with the model's own quilting UVs.
 */
export function perforatedMaps() {
  return cached("perforated", () => {
    const n = 1024;
    const h = new Float32Array(n * n);
    const pack = new Uint8ClampedArray(n * n * 4);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const u = x / n;
        const v = y / n;
        // Distance to the two diagonal seams (tile = one diamond).
        const d1 = Math.abs(((u + v) % 1) - 0.5);
        const d2 = Math.abs(((u - v + 1) % 1) - 0.5);
        const e = Math.min(Math.abs(d1 - 0.5), Math.abs(d2 - 0.5));
        // Pillow: rises away from the seam.
        const pillow = Math.sqrt(Math.min(1, e / 0.18));
        // Stitch rows run 0.02 either side of each seam, dashed.
        const along = (u + v) * 40;
        const along2 = (u - v) * 40;
        const s1 = Math.abs(Math.abs(d1 - 0.5) - 0.022) < 0.0045 && ((along2 % 1) + 1) % 1 < 0.62;
        const s2 = Math.abs(Math.abs(d2 - 0.5) - 0.022) < 0.0045 && ((along % 1) + 1) % 1 < 0.62;
        const stitch = s1 || s2 ? 1 : 0;
        // Perforation grid inside the pillow.
        const gx = (u * 48) % 1;
        const gy = (v * 48 + (Math.floor(u * 48) % 2) * 0.5) % 1;
        const hole = e > 0.05 && Math.hypot(gx - 0.5, gy - 0.5) < 0.17 ? 1 : 0;
        const grain = cellular(u, v, 96, 5);
        let hv = pillow * 0.9 + Math.min(1, grain * 2) * 0.06 - hole * 0.35 + stitch * 0.08;
        if (hole) hv = pillow * 0.5;
        h[y * n + x] = hv;
        const i = (y * n + x) * 4;
        pack[i] = stitch * 235;
        pack[i + 1] = hole ? 20 : 140 + pillow * 110;
        pack[i + 2] = 0;
        pack[i + 3] = 255;
      }
    }
    return { map: tileSize(dataTexture(pack, n, n, 1), 0.085), normalMap: tileSize(dataTexture(heightToNormal(h, n, n, 5), n, n, 1), 0.085) };
  });
}

/** Alcantara / suede: dense, directionless micro-fibre. */
export function alcantaraMaps() {
  return cached("alcantara", () => {
    const n = 512;
    const h = new Float32Array(n * n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) h[y * n + x] = fbm(x / n, y / n, 128, 2, 21);
    return { normalMap: dataTexture(heightToNormal(h, n, n, 1.6), n, n, 6) };
  });
}

/** Loop-pile carpet. */
export function carpetMaps() {
  return cached("carpet", () => {
    const n = 512;
    const h = new Float32Array(n * n);
    const pack = new Uint8ClampedArray(n * n * 4);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const u = x / n;
        const v = y / n;
        const loops = Math.min(1, cellular(u, v, 90, 31) * 1.8);
        const hv = loops * 0.7 + fbm(u, v, 32, 3, 33) * 0.3;
        h[y * n + x] = hv;
        const g = 90 + hv * 165;
        const i = (y * n + x) * 4;
        pack[i] = pack[i + 1] = pack[i + 2] = g;
        pack[i + 3] = 255;
      }
    }
    return { map: tileSize(dataTexture(pack, n, n, 6), 0.1), normalMap: tileSize(dataTexture(heightToNormal(h, n, n, 3), n, n, 6), 0.1) };
  });
}

/** Honeycomb intake mesh: raised walls, deep dark cells. */
export function honeycombMaps() {
  return cached("honeycomb", () => {
    const w = 512;
    const r = w / (4 * Math.sqrt(3));
    const hh = Math.round(6 * r);
    const h = new Float32Array(w * hh);
    const col = new Uint8ClampedArray(w * hh * 4);
    const sq3 = Math.sqrt(3);
    for (let y = 0; y < hh; y++) {
      for (let x = 0; x < w; x++) {
        // Nearest centre on a pointy-top hex lattice (periodic in the tile).
        let best = 1e9;
        for (let row = -1; row <= 4; row++) {
          const cy = row * 1.5 * r;
          const off = (row & 1) * sq3 * r * 0.5;
          for (let k = -1; k <= 4; k++) {
            const cx = k * sq3 * r + off;
            const dx = x - cx;
            const dy = y - cy;
            // Hex distance (pointy top): 1 on the cell's flat sides.
            const ax = Math.abs(dx);
            const ay = Math.abs(dy);
            const hd = Math.max(ax, ax * 0.5 + ay * sq3 * 0.5) / (r * sq3 * 0.5);
            if (hd < best) best = hd;
          }
        }
        const t = best; // 0 centre → 1 wall
        const wall = t > 0.86 ? 1 : 0;
        const depth = wall ? 1 : Math.max(0, (t - 0.55) / 0.31) * 0.35;
        h[y * w + x] = depth;
        const i = (y * w + x) * 4;
        const c = wall ? 70 : 10 + depth * 40;
        col[i] = col[i + 1] = col[i + 2] = c;
        col[i + 3] = 255;
      }
    }
    const map = dataTexture(col, w, hh, 8, true);
    const normalMap = dataTexture(heightToNormal(h, w, hh, 4), w, hh, 8);
    map.repeat.set(8, 8 * (w / hh));
    normalMap.repeat.copy(map.repeat);
    tileSize(map, 0.06, (0.06 * hh) / w);
    tileSize(normalMap, 0.06, (0.06 * hh) / w);
    return { map, normalMap };
  });
}

/** Open-pore walnut: ring figure + pore streaks. */
export function walnutMaps() {
  return cached("walnut", () => {
    const w = 1024;
    const hh = 256;
    const col = new Uint8ClampedArray(w * hh * 4);
    const rough = new Uint8ClampedArray(w * hh * 4);
    for (let y = 0; y < hh; y++) {
      for (let x = 0; x < w; x++) {
        const u = x / w;
        const v = y / hh;
        const warp = fbm(u, v, 4, 3, 41) * 3.5;
        const rings = 0.5 + 0.5 * Math.sin((v * 10 + warp) * Math.PI * 2);
        const pores = valueNoise(u, v, 512, 43) > 0.82 ? 1 : 0;
        const t = rings * 0.6 + fbm(u, v, 16, 2, 45) * 0.4;
        const i = (y * w + x) * 4;
        col[i] = 58 + t * 60 - pores * 25;
        col[i + 1] = 34 + t * 36 - pores * 15;
        col[i + 2] = 20 + t * 20 - pores * 8;
        col[i + 3] = 255;
        const r = 110 + pores * 120 + (1 - t) * 20;
        rough[i] = rough[i + 1] = rough[i + 2] = r;
        rough[i + 3] = 255;
      }
    }
    const map = dataTexture(col, w, hh, 2, true);
    const roughnessMap = dataTexture(rough, w, hh, 2);
    map.repeat.set(2, 6);
    roughnessMap.repeat.copy(map.repeat);
    tileSize(map, 0.7, 0.175);
    tileSize(roughnessMap, 0.7, 0.175);
    return { map, roughnessMap };
  });
}

/** Digital instrument cluster, laid out on the model's own screen UVs. */
export function clusterTexture() {
  return cached("cluster", () => {
    const [c, g] = canvas(1);
    c.width = 1024;
    c.height = 256;
    g.fillStyle = "#000";
    g.fillRect(0, 0, 1024, 256);
    // Screen glass with a faint gradient.
    const grd = g.createLinearGradient(0, 30, 0, 240);
    grd.addColorStop(0, "#0b0d10");
    grd.addColorStop(1, "#050607");
    g.fillStyle = grd;
    g.beginPath();
    g.moveTo(150, 22);
    g.lineTo(874, 22);
    g.lineTo(1000, 236);
    g.lineTo(24, 236);
    g.closePath();
    g.fill();
    // Tachometer arc.
    const cx = 300;
    const cy = 150;
    g.lineCap = "round";
    g.lineWidth = 10;
    g.strokeStyle = "#1c2026";
    g.beginPath();
    g.arc(cx, cy, 88, Math.PI * 0.8, Math.PI * 2.2);
    g.stroke();
    g.strokeStyle = "#e3c49a";
    g.beginPath();
    g.arc(cx, cy, 88, Math.PI * 0.8, Math.PI * 1.05);
    g.stroke();
    g.strokeStyle = "#b8352b";
    g.beginPath();
    g.arc(cx, cy, 88, Math.PI * 1.95, Math.PI * 2.2);
    g.stroke();
    g.fillStyle = "#e9e4da";
    g.textAlign = "center";
    g.font = "600 64px Helvetica, Arial, sans-serif";
    g.fillText("P", cx, cy + 22);
    g.font = "500 16px Helvetica, Arial, sans-serif";
    g.fillStyle = "#8b8f96";
    g.fillText("RPM × 1000", cx, cy + 58);
    // Speed.
    g.fillStyle = "#f4efe6";
    g.font = "300 110px Helvetica, Arial, sans-serif";
    g.fillText("0", 580, 170);
    g.font = "500 18px Helvetica, Arial, sans-serif";
    g.fillStyle = "#8b8f96";
    g.fillText("KM/H", 580, 204);
    // Right: range + drive mode.
    g.textAlign = "left";
    g.fillStyle = "#e3c49a";
    g.font = "600 20px Helvetica, Arial, sans-serif";
    g.fillText("GT", 760, 96);
    g.fillStyle = "#c8c3ba";
    g.font = "400 18px Helvetica, Arial, sans-serif";
    g.fillText("21°C   ·   512 km", 760, 132);
    g.fillStyle = "#1c2026";
    g.fillRect(760, 156, 150, 6);
    g.fillStyle = "#e3c49a";
    g.fillRect(760, 156, 118, 6);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  });
}

/** Engine-bay surfaces: ribbed cam covers, crinkled gold foil, sand-cast alloy. */
export function engineMaps() {
  return cached("engine", () => {
    const n = 256;
    const ribs = new Float32Array(n * n);
    const foil = new Float32Array(n * n);
    const cast = new Float32Array(n * n);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const u = x / n;
        const v = y / n;
        const i = y * n + x;
        ribs[i] = Math.pow(Math.abs(Math.sin(v * Math.PI * 12)), 0.5) * 0.8 + fbm(u, v, 32, 2, 51) * 0.2;
        foil[i] = Math.min(1, cellular(u, v, 10, 53) * 1.6) * 0.7 + fbm(u, v, 16, 3, 55) * 0.3;
        cast[i] = fbm(u, v, 48, 3, 57);
      }
    }
    return {
      ribs: dataTexture(heightToNormal(ribs, n, n, 3), n, n, 1),
      foil: dataTexture(heightToNormal(foil, n, n, 6), n, n, 2),
      cast: dataTexture(heightToNormal(cast, n, n, 2.5), n, n, 2),
    };
  });
}

/* ── Set surfaces (showroom + port) ─────────────────────────────── */

function toRGBA(fn: (u: number, v: number) => [number, number, number], w: number, h: number) {
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b] = fn(x / w, y / h);
      const i = (y * w + x) * 4;
      out[i] = r;
      out[i + 1] = g;
      out[i + 2] = b;
      out[i + 3] = 255;
    }
  }
  return out;
}

/**
 * Polished charcoal concrete: cloudy trowel mottling, exposed fine
 * aggregate, a saw-cut joint at the tile edge (tile = one 4 m bay).
 */
export function concreteMaps() {
  return cached("concrete", () => {
    const n = 1024;
    const h = new Float32Array(n * n);
    const rough = new Uint8ClampedArray(n * n * 4);
    const col = toRGBA((u, v) => {
      const cloud = fbm(u, v, 6, 5, 61);
      const trowel = fbm(u * 0.5 + v * 0.2, v, 3, 3, 63);
      const agg = cellular(u, v, 220, 65);
      const speck = agg < 0.08 ? 1 : 0;
      const joint = Math.min(u, 1 - u, v, 1 - v) < 0.0025 ? 1 : 0;
      const i = Math.floor(v * n) * n + Math.floor(u * n);
      h[i] = speck * 0.3 - joint + cloud * 0.2;
      const r = 0.2 + (1 - cloud) * 0.28 + speck * 0.35 + joint * 0.5;
      rough[i * 4] = rough[i * 4 + 1] = rough[i * 4 + 2] = Math.min(255, r * 255);
      rough[i * 4 + 3] = 255;
      const base = 48 + cloud * 30 + trowel * 10 + speck * 26 - joint * 34;
      return [base, base, base * 1.02];
    }, n, n);
    return {
      map: dataTexture(col, n, n, 1, true),
      roughnessMap: dataTexture(rough, n, n, 1),
      normalMap: dataTexture(heightToNormal(h, n, n, 2), n, n, 1),
    };
  });
}

/** Weathered asphalt: bitumen, exposed aggregate, patching, hairline cracks. */
export function asphaltMaps() {
  return cached("asphalt", () => {
    const n = 1024;
    const h = new Float32Array(n * n);
    const rough = new Uint8ClampedArray(n * n * 4);
    const col = toRGBA((u, v) => {
      const agg = cellular(u, v, 160, 71);
      const stone = Math.min(1, agg * 3);
      const tar = fbm(u, v, 4, 4, 73);
      const fine = valueNoise(u, v, 512, 75);
      const crack = cellular(u, v, 5, 77) < 0.012 && fbm(u, v, 8, 2, 79) > 0.5 ? 1 : 0;
      const i = Math.floor(v * n) * n + Math.floor(u * n);
      h[i] = stone * 0.6 + fine * 0.2 - crack * 0.8;
      const rr = 0.78 + fine * 0.15 - (tar < 0.35 ? 0.2 : 0);
      rough[i * 4] = rough[i * 4 + 1] = rough[i * 4 + 2] = Math.min(255, rr * 255);
      rough[i * 4 + 3] = 255;
      const light = 46 + (1 - stone) * 40 + fine * 26 + (tar - 0.5) * 30 - crack * 30;
      return [light, light * 0.99, light * 0.97];
    }, n, n);
    return {
      map: dataTexture(col, n, n, 1, true),
      roughnessMap: dataTexture(rough, n, n, 1),
      normalMap: dataTexture(heightToNormal(h, n, n, 3), n, n, 1),
    };
  });
}

/** Vertical fluting for wall panels (tile = one flute). */
export function flutedNormal() {
  return cached("fluted", () => {
    const n = 128;
    const h = new Float32Array(n * n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) h[y * n + x] = Math.sqrt(Math.max(0, Math.sin((x / n) * Math.PI))) + fbm(x / n, y / n, 16, 2, 81) * 0.04;
    return dataTexture(heightToNormal(h, n, n, 6), n, n, 1);
  });
}

/**
 * Shipping-container skin: trapezoidal corrugation (normal) plus a grime
 * map (rust streaks from the top rail, dirt along the bottom) that the
 * per-instance colour multiplies.
 */
export function containerMaps() {
  return cached("container", () => {
    const w = 512;
    const hh = 256;
    const h = new Float32Array(w * hh);
    const col = toRGBA((u, v) => {
      const p = (u * 24) % 1;
      const corr = p < 0.2 ? p / 0.2 : p < 0.5 ? 1 : p < 0.7 ? 1 - (p - 0.5) / 0.2 : 0;
      const i = Math.floor(v * hh) * w + Math.floor(u * w);
      h[i] = corr;
      const streak = Math.pow(fbm(u * 8, v * 0.3, 8, 3, 91), 2) * (1 - v) * 1.4;
      const dirt = Math.max(0, v - 0.75) * 2.4 * fbm(u, v, 16, 2, 93);
      const rail = v < 0.035 || v > 0.965 ? 0.6 : 1;
      const g = Math.max(0, Math.min(1, (1 - streak * 0.55 - dirt * 0.6) * rail * (0.88 + fbm(u, v, 32, 2, 95) * 0.12)));
      return [g * 255, g * 240, g * 225];
    }, w, hh);
    return {
      map: dataTexture(col, w, hh, 1, true),
      normalMap: dataTexture(heightToNormal(h, w, hh, 2.5), w, hh, 1),
    };
  });
}

/** Painted markings for the delivery bay (yellow box, hatching, arrow). */
export function bayMarkings() {
  return cached("bay", () => {
    const [c, g] = canvas(1);
    c.width = 512;
    c.height = 1024;
    g.clearRect(0, 0, 512, 1024);
    g.strokeStyle = "rgba(226,182,40,0.92)";
    g.lineWidth = 16;
    g.strokeRect(40, 40, 432, 944);
    g.lineWidth = 10;
    g.save();
    g.beginPath();
    g.rect(48, 850, 416, 126);
    g.clip();
    for (let x = -200; x < 600; x += 44) {
      g.beginPath();
      g.moveTo(x, 976);
      g.lineTo(x + 126, 850);
      g.stroke();
    }
    g.restore();
    g.fillStyle = "rgba(235,235,230,0.85)";
    g.beginPath();
    g.moveTo(256, 140);
    g.lineTo(316, 240);
    g.lineTo(278, 240);
    g.lineTo(278, 380);
    g.lineTo(234, 380);
    g.lineTo(234, 240);
    g.lineTo(196, 240);
    g.closePath();
    g.fill();
    // Wear: knock the paint back with noise.
    const img = g.getImageData(0, 0, 512, 1024);
    for (let y = 0; y < 1024; y++) {
      for (let x = 0; x < 512; x++) {
        const i = (y * 512 + x) * 4 + 3;
        if (img.data[i]) img.data[i] *= 0.55 + 0.45 * fbm(x / 512, y / 1024, 24, 3, 97);
      }
    }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  });
}

/** Brushed-metal wall lettering. */
export function letteringTexture(text: string) {
  return cached(`letters:${text}`, () => {
    const [c, g] = canvas(1);
    c.width = 2048;
    c.height = 256;
    g.clearRect(0, 0, 2048, 256);
    g.fillStyle = "#fff";
    g.font = "600 170px 'Helvetica Neue', Helvetica, Arial, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    (g as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = "60px";
    g.fillText(text, 1024, 136);
    const t = new THREE.CanvasTexture(c);
    t.anisotropy = 8;
    return t;
  });
}
