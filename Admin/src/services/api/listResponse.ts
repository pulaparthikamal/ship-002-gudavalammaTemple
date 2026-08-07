import type { CrudListQuery, CrudListResponse } from '@/types/crud'
import { readResponsePath } from './responseTransform'

function readArrayResponsePath<T>(response: unknown, path: string) {
  const value = readResponsePath<unknown>(response, path)
  return Array.isArray(value) ? (value as T[]) : null
}

function readNumberResponsePath(response: unknown, path: string) {
  const value = readResponsePath<unknown>(response, path)
  return typeof value === 'number' ? value : null
}

interface NormalizeCrudListResponseOptions<TRawItem, TItem = TRawItem> {
  response: unknown
  query: CrudListQuery
  dataPaths: string[]
  totalPaths: string[]
  mapItem?: (item: TRawItem) => TItem | null
}

export function normalizeCrudListResponse<TRawItem, TItem = TRawItem>({
  response,
  query,
  dataPaths,
  totalPaths,
  mapItem,
}: NormalizeCrudListResponseOptions<TRawItem, TItem>): CrudListResponse<TItem> {
  const rawData =
    (Array.isArray(response) ? (response as TRawItem[]) : null) ??
    dataPaths.reduce<TRawItem[] | null>((resolvedData, path) => {
      return resolvedData ?? readArrayResponsePath<TRawItem>(response, path)
    }, null) ??
    []

  const data = mapItem
    ? rawData
        .map(mapItem)
        .filter((item): item is TItem => item !== null)
    : (rawData as unknown as TItem[])

  const total =
    totalPaths.reduce<number | null>((resolvedTotal, path) => {
      return resolvedTotal ?? readNumberResponsePath(response, path)
    }, null) ?? data.length

  return {
    data,
    total,
    page: query.page,
    limit: query.limit,
  }
}
