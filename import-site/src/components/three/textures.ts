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
  cache.set("carbon", map);
  cache.set("carbon_n", normalMap);
  return { map, normalMap };
}
