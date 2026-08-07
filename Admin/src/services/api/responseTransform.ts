function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function readResponsePath<T>(response: unknown, path?: string): T {
  if (!path) {
    return response as T
  }

  const value = path.split('.').reduce<unknown>((current, key) => {
    if (!isRecord(current)) {
      return undefined
    }

    return current[key]
  }, response)

  return value as T
}
