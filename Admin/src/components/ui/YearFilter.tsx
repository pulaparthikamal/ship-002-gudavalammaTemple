import { Dropdown } from 'primereact/dropdown'

interface YearFilterProps {
  value: number | null
  onChange: (year: number | null) => void
  yearsBack?: number
  className?: string
  allLabel?: string
}

/**
 * Quick-pick year dropdown for date-heavy staff lists (Donations, Bookings,
 * Expense Entries, Events). Selecting a year maps to a from/to date range for
 * the caller to pass to its list query; "All years" clears the range.
 */
export function YearFilter({ value, onChange, yearsBack = 6, className, allLabel = 'All years' }: YearFilterProps) {
  const currentYear = new Date().getFullYear()
  const options = [
    { label: allLabel, value: null as number | null },
    ...Array.from({ length: yearsBack + 1 }, (_, i) => currentYear - i).map((year) => ({
      label: String(year),
      value: year as number | null,
    })),
  ]

  return (
    <Dropdown
      value={value}
      options={options}
      onChange={(e) => onChange(e.value)}
      className={className ?? 'w-40'}
      placeholder={allLabel}
    />
  )
}

export function yearToDateRange(year: number | null): { from?: string; to?: string } {
  if (!year) return {}
  return {
    from: new Date(year, 0, 1).toISOString(),
    to: new Date(year, 11, 31, 23, 59, 59, 999).toISOString(),
  }
}
