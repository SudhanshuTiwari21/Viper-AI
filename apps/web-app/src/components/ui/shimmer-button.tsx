'use client'

import { cn } from '@/lib/utils'

interface ShimmerButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode
  className?: string
}

export default function ShimmerButton({
  children = 'Shimmer',
  className,
  ...props
}: ShimmerButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex animate-[shimmer2_2s_infinite_linear] items-center justify-center rounded-md border border-slate-800 bg-[linear-gradient(110deg,#000103,45%,#1e2631,55%,#000103)] [background-size:200%_100%] px-6 font-medium text-slate-300 transition-colors focus:ring-slate-700 focus:ring-offset-2 focus:ring-offset-slate-900 focus:outline-none focus-visible:ring-2',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
