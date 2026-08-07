export function normalizePlatformValue(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '').replace('(x)', '')
}
