"use client";

import dynamic from "next/dynamic";

const VehicleViewer = dynamic(() => import("@/components/three/VehicleViewer"), {
  ssr: false,
  loading: () => null,
});

/** Client boundary so the detail page can lazy-load the WebGL viewer. */
export function DetailViewer({ modelId }: { modelId: string }) {
  return <VehicleViewer modelId={modelId} />;
}
