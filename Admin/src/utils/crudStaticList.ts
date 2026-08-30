import type { CrudListQuery, CrudListResult } from '@/types/crud'

/**
 * Several catalog-style backend endpoints (sevas, darshan quotas, room types,
 * prasadam items, donation funds, facilities, announcements) return a flat,
 * unpaginated array rather than the paginated `{ data, total, page, limit }`
 * envelope that `CrudPage` expects from `CrudApiHooks.useListQuery`.
 *
 * This adapter wraps the result of a plain RTK Query list hook (that takes no
 * arguments / a `void` arg) into the shape `CrudPage` needs, without having to
 * change the underlying API endpoint. Sorting/filtering criteria from
 * `CrudListQuery` are not applied server-side since these endpoints don't
 * support them; the full list is always returned.
 */
export function toStaticCrudListResult<TItem>(
  query: CrudListQuery,
  result: {
    data?: TItem[]
    error?: unknown
    isFetching: boolean
    isLoading: boolean
    refetch: () => unknown
  },
): CrudListResult<TItem> {
  const items = result.data ?? []

  return {
    data: {
      data: items,
      total: items.length,
      page: query.page,
      limit: query.limit,
    },
    error: result.error,
    isFetching: result.isFetching,
    isLoading: result.isLoading,
    refetch: result.refetch,
  }
}
