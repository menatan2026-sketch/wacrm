import * as THREE from "three";
import {
  caliperOptions,
  interiorOptions,
  paintOptions,
  trimOptions,
  wheelFinishOptions,
  type CaliperOption,
  type InteriorOption,
  type MaterialSlot,
  type PaintOption,
  type TrimOption,
  type WheelFinishOption,
} from "@/config/vehicle-models";
import {
  alcantaraMaps,
  brushedRoughnessMap,
  carbonMaps,
  carpetMaps,
  clusterTexture,
  flakeNormalMap,
  honeycombMaps,
  leatherMaps,
  perforatedMaps,
  walnutMaps,
} from "./textures";

/**
 * Shared, mutable material set for a vehicle. Scenes lerp these toward
 * targets every frame (paint and hide changes glide instead of snapping).
 * Every GLB mesh is bound to one of these through its material slot.
 */
export type VehicleMaterials = Record<MaterialSlot, THREE.MeshPhysicalMaterial>;

/** Stitching colour, shared by every leather material that shows seams. */
export const stitchColor = { value: new THREE.Color("#8d8d8d") };

/**
 * Leather shading: the texture's red channel is a stitch mask, green is
 * a shading term (grain valleys, perforation holes). The hide colour and
 * the thread colour stay live uniforms, so the configurator can restyle
 * a cabin without regenerating a single texture.
 */
function withStitching(m: THREE.MeshPhysicalMaterial) {
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uStitch = stitchColor;
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform vec3 uStitch;")
      .replace(
        "#include <map_fragment>",
        `#ifdef USE_MAP
          vec4 leatherTexel = texture2D( map, vMapUv );
          diffuseColor.rgb *= mix( 0.55, 1.08, leatherTexel.g );
          diffuseColor.rgb = mix( diffuseColor.rgb, uStitch, leatherTexel.r );
        #endif`,
      );
  };
  m.customProgramCacheKey = () => "leather-stitch";
  return m;
}

const phys = (p: THREE.MeshPhysicalMaterialParameters) => new THREE.MeshPhysicalMaterial(p);

export function createVehicleMaterials(): VehicleMaterials {
  const p = paintOptions[0];
  const w = wheelFinishOptions[0];
  const flakes = flakeNormalMap();
  const leather = leatherMaps();
  const perf = perforatedMaps();
  const alc = alcantaraMaps();
  const carpet = carpetMaps();
  const honey = honeycombMaps();

  const mats: VehicleMaterials = {
    // Two-layer automotive paint: a metallic base with flake sparkle
    // (normal map) under a smooth, glossy clear coat.
    paint: phys({
      name: "slot:paint",
      color: p.color,
      metalness: p.metalness,
      roughness: p.roughness,
      normalMap: flakes,
      normalScale: new THREE.Vector2(0.05, 0.05),
      clearcoat: 1,
      clearcoatRoughness: p.clearcoatRoughness,
      specularIntensity: 1,
      envMapIntensity: 1.1,
    }),
    // Gloss-black lower panels, sills and roof: piano-lacquer finish.
    accentPaint: phys({
      name: "slot:accentPaint",
      color: "#050506",
      metalness: 0.6,
      roughness: 0.28,
      clearcoat: 1,
      clearcoatRoughness: 0.03,
      envMapIntensity: 1,
    }),
    // Tinted laminated glass: dark, very smooth, strongly reflective at
    // grazing angles, see-through head-on.
    glass: phys({
      name: "slot:glass",
      color: "#0d1116",
      metalness: 0,
      roughness: 0,
      ior: 1.52,
      specularIntensity: 1,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      side: THREE.DoubleSide,
      clearcoat: 1,
      clearcoatRoughness: 0,
      envMapIntensity: 1.7,
    }),
    rims: phys({
      name: "slot:rims",
      color: w.color,
      metalness: w.metalness,
      roughness: w.roughness,
      clearcoat: 0.6,
      clearcoatRoughness: 0.12,
      envMapIntensity: 0.9,
    }),
    // Diamond-cut rim lip / centre: bright machined alloy.
    rimAccent: phys({ name: "slot:rimAccent", color: "#c9ccd1", metalness: 1, roughness: 0.18, envMapIntensity: 1 }),
    headlights: phys({
      name: "slot:headlights",
      color: "#dfe6ee",
      emissive: new THREE.Color("#eef4ff"),
      emissiveIntensity: 0,
      metalness: 0.2,
      roughness: 0.1,
      clearcoat: 1,
    }),
    taillights: phys({
      name: "slot:taillights",
      color: "#2a0304",
      emissive: new THREE.Color("#ff1a1a"),
      emissiveIntensity: 0,
      metalness: 0.3,
      roughness: 0.2,
      clearcoat: 1,
    }),
    signals: phys({ name: "slot:signals", color: "#2a1a05", emissive: new THREE.Color("#ff8a1a"), emissiveIntensity: 0, roughness: 0.2, clearcoat: 1 }),
    // Full-grain hide with stitched seams (colour + thread are live).
    leather: withStitching(
      phys({
        name: "slot:leather",
        color: interiorOptions[0].leather,
        roughness: 0.55,
        map: leather?.map ?? null,
        normalMap: leather?.normalMap ?? null,
        normalScale: new THREE.Vector2(0.9, 0.9),
        roughnessMap: leather?.roughnessMap ?? null,
        sheen: 0.35,
        sheenRoughness: 0.6,
        sheenColor: new THREE.Color("#3a3a3a"),
        envMapIntensity: 0.55,
      }),
    ),
    leatherAccent: withStitching(
      phys({
        name: "slot:leatherAccent",
        color: interiorOptions[0].accent,
        roughness: 0.6,
        map: leather?.map ?? null,
        normalMap: leather?.normalMap ?? null,
        normalScale: new THREE.Vector2(0.8, 0.8),
        roughnessMap: leather?.roughnessMap ?? null,
        sheen: 0.25,
        sheenRoughness: 0.6,
        sheenColor: new THREE.Color("#2e2e2e"),
        envMapIntensity: 0.5,
      }),
    ),
    // Perforated, quilted seat centres.
    seatInsert: withStitching(
      phys({
        name: "slot:seatInsert",
        color: interiorOptions[0].insert,
        roughness: 0.62,
        map: perf?.map ?? null,
        normalMap: perf?.normalMap ?? null,
        normalScale: new THREE.Vector2(1, 1),
        sheen: 0.3,
        sheenRoughness: 0.55,
        sheenColor: new THREE.Color("#333"),
        envMapIntensity: 0.5,
      }),
    ),
    carpet: phys({
      name: "slot:carpet",
      color: interiorOptions[0].carpet,
      roughness: 1,
      map: carpet?.map ?? null,
      normalMap: carpet?.normalMap ?? null,
      normalScale: new THREE.Vector2(0.8, 0.8),
      sheen: 1,
      sheenRoughness: 0.9,
      sheenColor: new THREE.Color("#2b2b2e"),
      envMapIntensity: 0.3,
    }),
    // Soft-touch Alcantara dash with a live digital cluster.
    dashboard: phys({
      name: "slot:dashboard",
      color: "#0b0b0c",
      roughness: 0.95,
      normalMap: alc?.normalMap ?? null,
      normalScale: new THREE.Vector2(0.5, 0.5),
      sheen: 1,
      sheenRoughness: 0.8,
      sheenColor: new THREE.Color("#3a3a3e"),
      emissive: new THREE.Color("#ffffff"),
      emissiveMap: clusterTexture(),
      emissiveIntensity: 1.2,
      envMapIntensity: 0.3,
    }),
    trim: phys({ name: "slot:trim", color: "#ffffff", metalness: 0.2, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 0.9 }),
    hardware: phys({
      name: "slot:hardware",
      color: "#8e9094",
      metalness: 1,
      roughness: 0.32,
      roughnessMap: brushedRoughnessMap(),
      envMapIntensity: 0.9,
    }),
    // Anodised dark titanium for the underbody / mechanical parts.
    mechanical: phys({ name: "slot:mechanical", color: "#2a2c30", metalness: 0.85, roughness: 0.5, envMapIntensity: 0.7 }),
    // Satin black EPDM: gaskets, seals, wiper blades, cage.
    rubber: phys({ name: "slot:rubber", color: "#0c0c0d", metalness: 0, roughness: 0.72, sheen: 0.4, sheenRoughness: 0.7, sheenColor: new THREE.Color("#1e1e20"), envMapIntensity: 0.45 }),
    // Tyres: deep black compound, matte tread, satin sidewall lettering.
    tireSide: phys({ name: "slot:tireSide", color: "#9a9a9a", metalness: 0, roughness: 0.78, envMapIntensity: 0.4, sheen: 0.4, sheenRoughness: 0.8, sheenColor: new THREE.Color("#222") }),
    tireTread: phys({ name: "slot:tireTread", color: "#0e0e0f", metalness: 0, roughness: 0.9, normalScale: new THREE.Vector2(1.6, 1.6), envMapIntensity: 0.35 }),
    caliper: phys({ name: "slot:caliper", color: caliperOptions[0].color, metalness: 0.3, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 0.9 }),
    disc: phys({ name: "slot:disc", color: "#7c7d80", metalness: 1, roughness: 0.55, envMapIntensity: 0.8 }),
    mirror: phys({ name: "slot:mirror", color: "#e8ecf0", metalness: 1, roughness: 0.02, envMapIntensity: 1.2 }),
    // Front intake: dark honeycomb mesh with real depth cues.
    grille: phys({
      name: "slot:grille",
      color: "#ffffff",
      map: honey?.map ?? null,
      normalMap: honey?.normalMap ?? null,
      normalScale: new THREE.Vector2(1.4, 1.4),
      metalness: 0.5,
      roughness: 0.42,
      envMapIntensity: 0.8,
    }),
    plate: phys({ name: "slot:plate", color: "#ffffff", roughness: 0.45, metalness: 0, clearcoat: 0.6, envMapIntensity: 0.6 }),
  };
  applyTrim(mats.trim, trimOptions[0]);
  return mats;
}

/** Trim finish: swaps maps on the shared trim material. */
export function applyTrim(m: THREE.MeshPhysicalMaterial, t: TrimOption) {
  m.map = null;
  m.normalMap = null;
  m.roughnessMap = null;
  m.color.set("#ffffff");
  if (t.id === "carbon") {
    const cm = carbonMaps();
    m.map = cm?.map ?? null;
    m.normalMap = cm?.normalMap ?? null;
    m.normalScale.set(0.6, 0.6);
    m.metalness = 0.3;
    m.roughness = 0.35;
    m.clearcoat = 1;
    m.clearcoatRoughness = 0.04;
  } else if (t.id === "aluminium") {
    m.color.set("#b9bcc1");
    m.roughnessMap = brushedRoughnessMap();
    m.metalness = 1;
    m.roughness = 0.34;
    m.clearcoat = 0;
  } else if (t.id === "piano") {
    m.color.set("#050506");
    m.metalness = 0;
    m.roughness = 0.08;
    m.clearcoat = 1;
    m.clearcoatRoughness = 0.02;
  } else {
    const wm = walnutMaps();
    m.map = wm?.map ?? null;
    m.roughnessMap = wm?.roughnessMap ?? null;
    m.metalness = 0;
    m.roughness = 0.55;
    m.clearcoat = 0.25;
    m.clearcoatRoughness = 0.3;
  }
  m.userData.trim = t.id;
  const uvm = m.userData.uvMetres as number | undefined;
  if (uvm) {
    for (const key of ["map", "normalMap", "roughnessMap"] as const) {
      const tex = m[key];
      const tile = tex?.userData.tile as [number, number] | undefined;
      if (!tex || !tile) continue;
      const c = tex.clone();
      c.repeat.set(uvm / tile[0], uvm / tile[1]);
      c.userData = { ...tex.userData, retiled: true };
      c.needsUpdate = true;
      m[key] = c;
    }
  }
  m.needsUpdate = true;
}

const tmp = new THREE.Color();

/** Frame-rate independent approach toward a paint target. */
export function lerpPaint(m: THREE.MeshPhysicalMaterial, target: PaintOption, k: number) {
  tmp.set(target.color);
  m.color.lerp(tmp, k);
  m.metalness += (target.metalness - m.metalness) * k;
  m.roughness += (target.roughness - m.roughness) * k;
  m.clearcoatRoughness += (target.clearcoatRoughness - m.clearcoatRoughness) * k;
  // Flake sparkle only belongs to metallic paints; solids stay smooth.
  const flake = 0.01 + 0.05 * target.metalness;
  m.normalScale.x += (flake - m.normalScale.x) * k;
  m.normalScale.y = m.normalScale.x;
}

export function lerpWheel(m: THREE.MeshPhysicalMaterial, target: WheelFinishOption, k: number) {
  tmp.set(target.color);
  m.color.lerp(tmp, k);
  m.metalness += (target.metalness - m.metalness) * k;
  m.roughness += (target.roughness - m.roughness) * k;
  m.clearcoat += ((target.roughness < 0.2 ? 1 : 0.5) - m.clearcoat) * k;
}

/** Cabin colours glide too; the thread colour follows the hide. */
export function lerpInterior(mats: VehicleMaterials, target: InteriorOption, k: number) {
  mats.leather.color.lerp(tmp.set(target.leather), k);
  mats.leatherAccent.color.lerp(tmp.set(target.accent), k);
  mats.seatInsert.color.lerp(tmp.set(target.insert), k);
  mats.carpet.color.lerp(tmp.set(target.carpet), k);
  stitchColor.value.lerp(tmp.set(target.stitch), k);
}

export function lerpCaliper(m: THREE.MeshPhysicalMaterial, target: CaliperOption, k: number) {
  m.color.lerp(tmp.set(target.color), k);
}

/** Applies every live configuration value in one call. */
export function updateVehicleMaterials(
  mats: VehicleMaterials,
  cfg: { paint: string; wheel: string; interior?: string; trim?: string; caliper?: string },
  k: number,
) {
  lerpPaint(mats.paint, findPaint(cfg.paint), k);
  lerpWheel(mats.rims, findWheel(cfg.wheel), k);
  lerpInterior(mats, findInterior(cfg.interior), k);
  lerpCaliper(mats.caliper, findCaliper(cfg.caliper), k);
  const trim = findTrim(cfg.trim);
  if (mats.trim.userData.trim !== trim.id) applyTrim(mats.trim, trim);
}

export function findPaint(id: string) {
  return paintOptions.find((p) => p.id === id) ?? paintOptions[0];
}
export function findWheel(id: string) {
  return wheelFinishOptions.find((w) => w.id === id) ?? wheelFinishOptions[0];
}
export function findInterior(id: string | undefined) {
  return interiorOptions.find((o) => o.id === id) ?? interiorOptions[0];
}
export function findTrim(id: string | undefined) {
  return trimOptions.find((o) => o.id === id) ?? trimOptions[0];
}
export function findCaliper(id: string | undefined) {
  return caliperOptions.find((o) => o.id === id) ?? caliperOptions[0];
}
