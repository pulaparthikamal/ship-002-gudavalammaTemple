import { cn } from '@/utils/classNames'

interface ProgressProps {
  value: number
  className?: string
}

export function Progress({ value, className }: ProgressProps) {
  // Ensure value is between 0 and 100
  const percentage = Math.min(Math.max(value, 0), 100)

  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-neutral-100', className)}>
      <div
        className="h-full bg-primary transition-all duration-300 ease-in-out"
        style={{ width: `${percentage}%` }}
      />
    </div>
  )
}
