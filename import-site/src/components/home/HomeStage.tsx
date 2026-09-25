"use client";

import dynamic from "next/dynamic";

const StageCanvas = dynamic(() => import("@/components/three/StageCanvas"), { ssr: false });

/** Client boundary that lazy-loads the WebGL stage after first paint. */
export function HomeStage() {
  return <StageCanvas />;
}
