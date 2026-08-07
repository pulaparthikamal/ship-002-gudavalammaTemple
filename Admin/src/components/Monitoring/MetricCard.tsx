import { useMemo } from 'react'
import type { ElementType, ReactNode } from 'react'

export function TrendChart({
  data,
  getValue,
  color,
}: {
  data: any[]
  getValue: (item: any) => number
  color: string
}) {
  const points = useMemo(() => {
    const ordered = [...data].reverse().slice(-12)
    if (ordered.length < 2) return ''

    return ordered
      .map((item, index) => {
        const x = (index / (ordered.length - 1)) * 100
        const val = getValue(item) || 0
        const y = 40 - (Math.min(val, 100) / 100) * 36
        return `${x},${y}`
      })
      .join(' ')
  }, [data, getValue])

  const areaPoints = useMemo(() => {
    if (!points) return ''
    return `${points} 100,40 0,40`
  }, [points])

  // Use a stable ID for gradient to avoid hydration mismatches, 
  // but allow multiple charts. We'll use the color string to create a unique-ish ID.
  const gradientId = `grad-${color.replace(/[^a-zA-Z0-9]/g, '')}`

  return (
    <div className="relative h-16 w-full">
      <svg viewBox="0 0 100 40" className="h-full w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={areaPoints} fill={`url(#${gradientId})`} />
        <polyline fill="none" stroke={color} strokeWidth="1.8" points={points} strokeLinejoin="round" />
      </svg>
    </div>
  )
}

export function MetricCard({
  label,
  value,
  data: _data,
  getValue: _getValue,
  icon: Icon,
  colorClass,
  strokeColor: _strokeColor,
  detail,
  badge,
  iconTone = 'bg-blue-50 text-blue-600',
  live = false,
}: {
  label: string
  value: ReactNode
  data: any[]
  getValue: (item: any) => number
  icon: ElementType
  colorClass: string
  strokeColor: string
  detail?: ReactNode
  badge?: ReactNode
  iconTone?: string
  live?: boolean
}) {
  return (
    <article className="group relative min-h-[170px] overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-[var(--color-text-strong)] shadow-sm transition-all hover:bg-[var(--color-hover)]">
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${colorClass}`} />
      <div className="flex items-start justify-between gap-4">
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${iconTone}`}>
          <Icon className="h-5 w-5" />
        </div>
        {badge && (
          <div className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700 ring-1 ring-emerald-200">
            {badge}
          </div>
        )}
      </div>

      <div className="mt-4">
        <div className="flex items-baseline gap-1">
          <p className="text-4xl font-black leading-none tracking-normal text-[var(--color-text-strong)]">{value}</p>
          {live && <span className="h-2 w-2 rounded-full bg-emerald-400" title="Live telemetry active" />}
        </div>
        <div className="mt-2 text-sm font-bold text-[var(--color-text-muted)]">
          {label}
          {detail && <span className="ml-1 font-semibold text-[var(--color-text-muted)]">{detail}</span>}
        </div>
      </div>

      {/* <div className="mt-5">
        <TrendChart data={data} getValue={getValue} color={strokeColor} />
      </div> */}
    </article>
  )
}
