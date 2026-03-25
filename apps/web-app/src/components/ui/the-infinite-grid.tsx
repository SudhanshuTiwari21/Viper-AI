'use client'

import React from 'react'
import { motion, useMotionValue, useMotionTemplate, useAnimationFrame } from 'framer-motion'

const GridPattern = ({ offsetX, offsetY }: { offsetX: any; offsetY: any }) => (
  <svg className="w-full h-full">
    <defs>
      <motion.pattern
        id="grid-pattern"
        width="40"
        height="40"
        patternUnits="userSpaceOnUse"
        x={offsetX}
        y={offsetY}
      >
        <path
          d="M 40 0 L 0 0 0 40"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          className="text-white"
        />
      </motion.pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#grid-pattern)" />
  </svg>
)

export function InfiniteGrid() {
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)
  const gridOffsetX = useMotionValue(0)
  const gridOffsetY = useMotionValue(0)

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const { left, top } = e.currentTarget.getBoundingClientRect()
    mouseX.set(e.clientX - left)
    mouseY.set(e.clientY - top)
  }

  useAnimationFrame(() => {
    gridOffsetX.set((gridOffsetX.get() + 0.2) % 40)
    gridOffsetY.set((gridOffsetY.get() + 0.2    ) % 40)
  })

  const maskImage = useMotionTemplate`radial-gradient(350px circle at ${mouseX}px ${mouseY}px, black, transparent)`

  return (
    <div
      className="absolute inset-0 z-0 overflow-hidden"
      onMouseMove={handleMouseMove}
    >
      {/* Static dim grid */}
      <div className="absolute inset-0 opacity-[0.04]">
        <GridPattern offsetX={gridOffsetX} offsetY={gridOffsetY} />
      </div>

      {/* Mouse-reveal bright grid */}
      <motion.div
        className="absolute inset-0 opacity-30"
        style={{ maskImage, WebkitMaskImage: maskImage }}
      >
        <GridPattern offsetX={gridOffsetX} offsetY={gridOffsetY} />
      </motion.div>
    </div>
  )
}
