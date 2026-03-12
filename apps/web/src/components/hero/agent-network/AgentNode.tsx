"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Mesh } from "three";

type AgentNodeProps = {
  position: [number, number, number];
  scale?: number;
  color?: string;
  isOrchestrator?: boolean;
  isHovered?: boolean;
  onPointerOver?: () => void;
  onPointerOut?: () => void;
};

export function AgentNode({
  position,
  scale = 1,
  color = "#8b5cf6",
  isOrchestrator = false,
  isHovered = false,
  onPointerOver,
  onPointerOut,
}: AgentNodeProps) {
  const meshRef = useRef<Mesh>(null);

  useFrame((state) => {
    if (!meshRef.current) return;
    if (!isOrchestrator) {
      meshRef.current.scale.lerp(
        { x: (isHovered ? 1.4 : 1) * scale, y: (isHovered ? 1.4 : 1) * scale, z: (isHovered ? 1.4 : 1) * scale },
        0.08
      );
    } else {
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 1.5) * 0.08;
      meshRef.current.scale.setScalar(scale * pulse);
    }
  });

  const size = isOrchestrator ? 0.5 : 0.22;
  const emissive = isOrchestrator ? "#00d4ff" : color;

  return (
    <mesh
      ref={meshRef}
      position={position}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
    >
      <sphereGeometry args={[size, 32, 32]} />
      <meshStandardMaterial
        color={isOrchestrator ? "#00d4ff" : color}
        emissive={emissive}
        emissiveIntensity={isOrchestrator ? 0.8 : isHovered ? 0.7 : 0.35}
        metalness={0.6}
        roughness={0.2}
      />
    </mesh>
  );
}
