"use client";

import { Canvas } from "@react-three/fiber";
import { AgentNetworkScene } from "./AgentNetworkScene";

type AgentNetworkCanvasProps = {
  hoveredId: string | null;
  setHoveredId: (id: string | null) => void;
};

export function AgentNetworkCanvas({ hoveredId, setHoveredId }: AgentNetworkCanvasProps) {
  return (
    <Canvas
      camera={{ position: [0, 0, 6], fov: 50 }}
      gl={{ antialias: true, alpha: true }}
      dpr={[1, 2]}
    >
      <AgentNetworkScene hoveredId={hoveredId} setHoveredId={setHoveredId} />
    </Canvas>
  );
}
