export const shellQuote = (value: string) => `'${value.replace(/'/g, "'\\''")}'`;

export const parseNumber = (value: string | undefined, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const toDateFromUnixSeconds = (value: string | number | undefined) => {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return new Date(0);
  }

  return new Date(parsed * 1000);
};

export const wildcardToRegExp = (pattern: string) => {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`, 'i');
};
