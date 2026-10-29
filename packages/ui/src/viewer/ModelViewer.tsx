"use client";
import { Bounds, Grid, OrbitControls, useGLTF } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Suspense, useMemo } from "react";
import * as THREE from "three";

function Model({ url, highlight }: { url: string; highlight: string }) {
  const { scene } = useGLTF(url);
  const object = useMemo(() => {
    const copy = scene.clone(true);
    copy.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        (o as THREE.Mesh).material = new THREE.MeshStandardMaterial({
          color: highlight,
          roughness: 0.55,
          metalness: 0.05,
        });
      }
    });
    return copy;
  }, [scene, highlight]);
  return <primitive object={object} />;
}

/**
 * Interactive preview (ADR-0015). Loads a server-decimated GLB, never the customer's source file.
 * Axes are never mirrored in RTL; no auto-rotation (reduced-motion safe). Keyboard: arrows rotate
 * via OrbitControls' listenToKeyEvents; a static image + dimensions remain the non-visual fallback.
 */
export default function ModelViewer({
  url,
  label,
  color = "#5B82FF",
}: {
  url: string;
  label: string;
  color?: string;
}) {
  return (
    <div
      role="img"
      aria-label={label}
      className="relative aspect-[4/3] w-full overflow-hidden rounded-m bg-viewer-canvas"
      dir="ltr"
    >
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [120, 90, 120], fov: 35, near: 0.1, far: 5000 }}
        gl={{ antialias: true, powerPreference: "low-power" }}
      >
        <color attach="background" args={["#0C0E11"]} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[100, 200, 100]} intensity={1.2} />
        <directionalLight position={[-120, 80, -60]} intensity={0.4} />
        <Suspense fallback={null}>
          <Bounds fit clip observe margin={1.4}>
            <Model url={url} highlight={color} />
          </Bounds>
        </Suspense>
        <Grid
          infiniteGrid
          cellSize={10}
          sectionSize={50}
          cellColor="#2A2F36"
          sectionColor="#3D444D"
          fadeDistance={600}
          position={[0, -0.01, 0]}
        />
        <OrbitControls makeDefault enableDamping dampingFactor={0.12} />
      </Canvas>
    </div>
  );
}
