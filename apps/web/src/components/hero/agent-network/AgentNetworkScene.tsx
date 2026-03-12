"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { AgentNode } from "./AgentNode";
import { AgentConnection } from "./AgentConnection";
import { ParticleField } from "./ParticleField";
import { FlowParticles } from "./FlowParticles";

const AGENTS = [
  { id: "intent", name: "Intent Agent", color: "#8b5cf6" },
  { id: "codebase", name: "Codebase Analysis Agent", color: "#a78bfa" },
  { id: "product", name: "Product Manager Agent", color: "#c4b5fd" },
  { id: "techlead", name: "Tech Lead Agent", color: "#7c3aed" },
  { id: "task", name: "Task Breakdown Agent", color: "#6d28d9" },
  { id: "impl", name: "Implementation Agent", color: "#00d4ff" },
  { id: "review", name: "Code Review Agent", color: "#22d3ee" },
  { id: "test", name: "Test & Security Agent", color: "#06b6d4" },
  { id: "release", name: "Release Analytics Agent", color: "#0ea5e9" },
];

const RADIUS = 2.2;
const CENTER: [number, number, number] = [0, 0, 0];

type AgentNetworkSceneProps = {
  hoveredId: string | null;
  setHoveredId: (id: string | null) => void;
};

export function AgentNetworkScene({ hoveredId, setHoveredId }: AgentNetworkSceneProps) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y = state.clock.elapsedTime * 0.15;
  });

  const positions = AGENTS.map((_, i) => {
    const angle = (i / AGENTS.length) * Math.PI * 2;
    return [
      Math.cos(angle) * RADIUS,
      Math.sin(angle) * RADIUS * 0.6,
      0,
    ] as [number, number, number];
  });

  return (
    <>
      <ParticleField />
      <ambientLight intensity={0.2} />
      <pointLight position={[0, 0, 5]} intensity={1} color="#00d4ff" />
      <pointLight position={[3, 3, 2]} intensity={0.5} color="#8b5cf6" />

      <group ref={groupRef}>
        <AgentNode
          position={CENTER}
          scale={1.2}
          isOrchestrator
          isHovered={false}
        />

        {AGENTS.map((agent, i) => {
          const pos = positions[i];
          const isHovered = hoveredId === agent.id;
          return (
            <group key={agent.id}>
              <AgentConnection
                start={CENTER}
                end={pos}
                pulsePhase={(i / AGENTS.length) * Math.PI * 2}
                isHovered={isHovered}
              />
              <FlowParticles start={CENTER} end={pos} count={8} />
              <AgentNode
                position={pos}
                scale={1}
                color={agent.color}
                isHovered={isHovered}
                onPointerOver={() => setHoveredId(agent.id)}
                onPointerOut={() => setHoveredId(null)}
              />
            </group>
          );
        })}
      </group>
    </>
  );
}

export { AGENTS };
