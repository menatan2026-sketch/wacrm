import type * as THREE from "three";

/**
 * Named points in the 3D scene (car inspection points, globe markets)
 * that DOM overlays attach to. Scenes register Object3Ds here; the HUD
 * projector reads their world positions every frame.
 */
export const sceneAnchors = new Map<string, THREE.Object3D>();
