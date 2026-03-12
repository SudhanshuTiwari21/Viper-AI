"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

type FlowParticlesProps = {
  start: [number, number, number];
  end: [number, number, number];
  count?: number;
};

export function FlowParticles({ start, end, count = 12 }: FlowParticlesProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const { positions, initialOffsets } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const initialOffsets = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const t = i / count;
      initialOffsets[i] = t;
      positions[i * 3] = start[0] + (end[0] - start[0]) * t;
      positions[i * 3 + 1] = start[1] + (end[1] - start[1]) * t;
      positions[i * 3 + 2] = start[2] + (end[2] - start[2]) * t;
    }
    return { positions, initialOffsets };
  }, [start, end, count]);

  useFrame((state) => {
    if (!pointsRef.current?.geometry) return;
    const pos = pointsRef.current.geometry.attributes.position
      .array as Float32Array;
    const time = state.clock.elapsedTime * 0.5;
    for (let i = 0; i < count; i++) {
      const offset = (initialOffsets[i] + time) % 1;
      pos[i * 3] = start[0] + (end[0] - start[0]) * offset;
      pos[i * 3 + 1] = start[1] + (end[1] - start[1]) * offset;
      pos[i * 3 + 2] = start[2] + (end[2] - start[2]) * offset;
    }
    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  const points = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      size: 0.06,
      color: 0x00d4ff,
      transparent: true,
      opacity: 0.8,
      sizeAttenuation: true,
      depthWrite: false,
    });
    return new THREE.Points(geometry, material);
  }, [positions]);

  return <primitive ref={pointsRef} object={points} />;
}
