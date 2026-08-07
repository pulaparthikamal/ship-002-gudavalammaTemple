import { cn } from '@/utils/classNames'

interface PlatformIconProps {
  icon?: string
  svg?: string
  color?: string
  size?: number | string
  className?: string
  style?: React.CSSProperties
}

export function PlatformIcon({ icon, svg, color, size = '1em', className, style }: PlatformIconProps) {
  if (svg) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className={className}
        style={{ width: size, height: size, color, ...style }}
      >
        <path d={svg} />
      </svg>
    )
  }
  return (
    <i 
      className={cn(icon || 'pi pi-globe', className)} 
      style={{ fontSize: size, color, ...style }} 
    />
  )
}
