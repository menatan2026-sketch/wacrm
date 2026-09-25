/**
 * Photographic environments (HDRIs) used as grounded backdrops and as
 * the base of the reflection/lighting environment.
 *
 * Each one is projected onto a "grounded skybox": the lower hemisphere is
 * flattened into a floor at y = 0, so the car stands *in* the photograph
 * rather than in front of it. `groundHeight` is roughly the height (m) the
 * panorama was shot from; `groundRadius` how far the floor extends before
 * it curves into the sky.
 *
 * The key/sun light is found automatically from the brightest texels, so
 * shadows fall the way the photograph is lit.
 *
 * Sources (CC0, Poly Haven, via the three.js / drei example assets):
 * Studio Small 03, Spruit Sunrise, Moonless Golf, Royal Esplanade.
 */

export type BackdropId = "studio" | "sunrise" | "night" | "city";

/** Built 3D sets layered over (or replacing) the photograph. */
export type SetId = "showroom" | "port";

export interface BackdropDef {
  id: BackdropId;
  url: string;
  format: "hdr" | "ultrahdr";
  groundHeight: number;
  groundRadius: number;
  /** Rotates the panorama (radians) to put its best side behind the car. */
  rotationY: number;
  /** Brightness of the visible backdrop (tone-mapped). */
  background: number;
  /** Strength of the panorama in reflections / image-based light. */
  lighting: number;
  sun: { color: string; intensity: number };
  shadowOpacity: number;
  /** How much the procedural studio strips still contribute (0–1). */
  studioStrips: number;
  /** Highlight ceiling for the panorama (tames softboxes that would bloom). */
  maxRadiance?: number;
  /** A 3D set built around the car (the photo then only lights / fills the sky). */
  set?: SetId;
  /** Hide the photographed backdrop entirely (the set encloses the car). */
  hideSkybox?: boolean;
  /** Key-light direction override (else found from the panorama). */
  sunDir?: [number, number, number];
}

export const backdrops: Record<BackdropId, BackdropDef> = {
  studio: {
    id: "studio",
    url: "/hdri/studio_1k.hdr",
    format: "hdr",
    groundHeight: 1.6,
    // Larger than the real room so the camera always stays inside the
    // projection; the seamless white floor stretches gracefully.
    groundRadius: 28,
    rotationY: Math.PI,
    background: 0.24,
    lighting: 0.6,
    sun: { color: "#fff6ec", intensity: 1 },
    shadowOpacity: 0.6,
    studioStrips: 0.18,
    maxRadiance: 16,
    // The delivery hall: the studio photo only fills the reflections.
    set: "showroom",
    hideSkybox: true,
    sunDir: [-0.18, 1, 0.12],
  },
  sunrise: {
    id: "sunrise",
    url: "/hdri/sunrise_2k.hdr.jpg",
    format: "ultrahdr",
    groundHeight: 3,
    groundRadius: 110,
    rotationY: -0.35,
    background: 0.85,
    lighting: 1.05,
    sun: { color: "#ffd2a1", intensity: 3.6 },
    shadowOpacity: 0.72,
    studioStrips: 0.2,
    // Arrival at the port: asphalt, containers and cranes under the dawn sky.
    set: "port",
  },
  city: {
    id: "city",
    url: "/hdri/city_2k.hdr.jpg",
    format: "ultrahdr",
    groundHeight: 2.6,
    groundRadius: 70,
    rotationY: 0.6,
    background: 0.7,
    lighting: 1,
    sun: { color: "#fff5e8", intensity: 3.2 },
    shadowOpacity: 0.7,
    studioStrips: 0.25,
  },
  night: {
    id: "night",
    url: "/hdri/night_2k.hdr.jpg",
    format: "ultrahdr",
    groundHeight: 2.6,
    groundRadius: 70,
    rotationY: 1.2,
    background: 0.5,
    lighting: 1.5,
    sun: { color: "#aebfff", intensity: 0.45 },
    shadowOpacity: 0.4,
    studioStrips: 0.35,
  },
};

export const BACKDROP_IDS = Object.keys(backdrops) as BackdropId[];
