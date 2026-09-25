"use client";

import { Bloom, EffectComposer, N8AO, SMAA, ToneMapping, Vignette } from "@react-three/postprocessing";
import { useThree } from "@react-three/fiber";
import { ToneMappingMode } from "postprocessing";
import { useEffect } from "react";
import * as THREE from "three";
import type { QualityTier } from "./director";

/**
 * Photographic finishing pass:
 *  - N8AO: screen-space ambient occlusion — grounds the car, darkens
 *    wheel arches, panel gaps and the cabin (high tier only).
 *  - Bloom: only for genuinely bright pixels (headlights, sun glints).
 *  - ACES filmic tone mapping in the composer (the renderer's own tone
 *    mapping is switched off to avoid doing it twice).
 *  - A soft optical vignette.
 * The low tier skips the composer entirely.
 */
export function Effects({ quality }: { quality: QualityTier }) {
  const gl = useThree((s) => s.gl);

  useEffect(() => {
    const prev = gl.toneMapping;
    gl.toneMapping = THREE.NoToneMapping;
    return () => {
      gl.toneMapping = prev;
    };
  }, [gl]);

  if (quality === "high") {
    return (
      <EffectComposer multisampling={4} stencilBuffer={false}>
        <N8AO halfRes aoRadius={0.55} distanceFalloff={0.55} intensity={2.4} quality="performance" />
        <Bloom mipmapBlur luminanceThreshold={1.15} luminanceSmoothing={0.2} intensity={0.38} radius={0.65} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        <Vignette offset={0.28} darkness={0.5} />
      </EffectComposer>
    );
  }
  return (
    <EffectComposer multisampling={0} stencilBuffer={false}>
      <Bloom mipmapBlur luminanceThreshold={1.15} luminanceSmoothing={0.2} intensity={0.35} radius={0.65} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette offset={0.28} darkness={0.5} />
      <SMAA />
    </EffectComposer>
  );
}
