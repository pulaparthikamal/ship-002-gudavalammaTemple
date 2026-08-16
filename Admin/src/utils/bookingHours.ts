function formatTimeOfDay(value?: string): string | null {
  if (!value) return null
  const [hoursStr, minutesStr] = value.split(':')
  const hours = Number(hoursStr)
  const minutes = Number(minutesStr)
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return value
  return new Date(2000, 0, 1, hours, minutes).toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
  })
}

/**
 * Informational-only display string for a catalog item's booking window
 * (e.g. "Bookings open 6:00 AM – 9:00 PM"). Not enforced server-side.
 */
export function formatBookingHours(opensAt?: string, closesAt?: string): string | null {
  const open = formatTimeOfDay(opensAt)
  const close = formatTimeOfDay(closesAt)
  if (open && close) return `${open} – ${close}`
  if (open) return `Opens ${open}`
  if (close) return `Closes ${close}`
  return null
}
