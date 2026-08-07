import React from 'react'
import { cn } from '@/utils/classNames'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'success' | 'warning' | 'destructive' | 'secondary' | 'outline'
  className?: string
}

const variants = {
  default: 'bg-neutral-900 text-neutral-50',
  success: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-700',
  destructive: 'bg-red-100 text-red-700',
  secondary: 'bg-neutral-100 text-neutral-900',
  outline: 'border border-neutral-200 text-neutral-950',
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold',
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  )
}
