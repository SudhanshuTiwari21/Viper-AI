"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

type AgentConnectionProps = {
  start: [number, number, number];
  end: [number, number, number];
  pulsePhase?: number;
  isHovered?: boolean;
};

export function AgentConnection({
  start,
  end,
  pulsePhase = 0,
  isHovered = false,
}: AgentConnectionProps) {
  const points = useMemo(
    () => new Float32Array([...start, ...end]),
    [start, end]
  );

  const lineRef = useRef<THREE.Line>(null);
  const line = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(points, 3));
    const material = new THREE.LineBasicMaterial({
      color: isHovered ? 0x00d4ff : 0x8b5cf6,
      transparent: true,
      opacity: 0.5,
    });
    return new THREE.Line(geometry, material);
  }, [start, end]);

  useFrame((state) => {
    if (!line.material) return;
    const mat = line.material as THREE.LineBasicMaterial;
    const t = state.clock.elapsedTime * 0.8 + pulsePhase;
    mat.opacity = 0.3 + Math.sin(t) * 0.25 + (isHovered ? 0.35 : 0);
    mat.opacity = Math.max(0.2, Math.min(1, mat.opacity));
    mat.color.setHex(isHovered ? 0x00d4ff : 0x8b5cf6);
  });

  return <primitive ref={lineRef} object={line} />;
}
