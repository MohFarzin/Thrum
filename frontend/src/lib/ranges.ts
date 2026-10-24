export type BarRange = '10m' | '1h' | '1d' | '7d' | '30d' | '60d'

export const DETAIL_RANGES: { id: BarRange; label: string }[] = [
  { id: '10m', label: '10m' },
  { id: '1h', label: '1h' },
  { id: '1d', label: '1d' },
  { id: '7d', label: '1w' },
  { id: '30d', label: '30d' },
]

export const HISTORY_RANGES: { id: BarRange; label: string }[] = [
  { id: '1h', label: '1h' },
  { id: '1d', label: '1d' },
  { id: '7d', label: '1w' },
  { id: '30d', label: '4w' },
  { id: '60d', label: '2mo' },
]

export const RANGE_MS: Record<BarRange, number> = {
  '10m': 10 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
  '60d': 60 * 24 * 60 * 60 * 1000,
}

/** Keep results within a wall-clock window (newest-first). */
export function withinWindow<T extends { checked_at: string }>(
  results: T[] | undefined,
  ms: number,
  now = Date.now(),
): T[] {
  if (!results?.length) return []
  const cut = now - ms
  return results.filter((r) => {
    const t = Date.parse(r.checked_at)
    return Number.isFinite(t) && t >= cut
  })
}
