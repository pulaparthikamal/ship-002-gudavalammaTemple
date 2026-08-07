import { apiSlice } from '@/services/api/apiSlice'
import { normalizeCrudListResponse } from '@/services/api/listResponse'
import { readResponsePath } from '@/services/api/responseTransform'
import { taskApiDetails } from '@/models/taskModel'
import type { EntityId } from '@/types/common'
import type { CrudListQuery, CrudListResponse } from '@/types/crud'
import type { Task, TaskCreatePayload, TaskUpdatePayload } from '@/types/task'

export function normalizeOptionalString(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

export function normalizeOptionalNumber(value: unknown) {
  return typeof value === 'number' ? value : undefined
}

export function normalizeDateString(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

export function normalizeStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function normalizeTask(response: unknown): Task | null {
  if (typeof response !== 'object' || response === null) {
    return null
  }

  const item = response as Record<string, unknown>

  if (typeof item._id !== 'string') {
    return null
  }

  return {
    _id: item._id,
    taskId:
      typeof item.taskId === 'string'
        ? item.taskId
        : typeof item.taskId === 'object' && item.taskId !== null && '_id' in item.taskId
          ? String((item.taskId as { _id?: string })._id ?? '')
          : '',
    entityId: normalizeOptionalString(item.entityId),
    entityType: normalizeOptionalString(item.entityType),
    workflowStage: normalizeOptionalString(item.workflowStage),
    assignedTo: normalizeOptionalString(item.assignedTo),
    assignedTeam: normalizeOptionalString(item.assignedTeam),
    priority: normalizeOptionalString(item.priority),
    status: normalizeOptionalString(item.status),
    dueDate: normalizeDateString(item.dueDate),
    slaTimer: normalizeDateString(item.slaTimer),
    escalationFlag: Boolean(item.escalationFlag),
    notes: normalizeOptionalString(item.notes),
    active: typeof item.active === 'boolean' ? item.active : true,
    createdAt:
      normalizeDateString(item.createdAt) ??
      normalizeDateString(item.created) ??
      new Date().toISOString(),
    updatedAt:
      normalizeDateString(item.updatedAt) ??
      normalizeDateString(item.updated) ??
      new Date().toISOString(),
    createdBy: normalizeOptionalString(item.createdBy),
    updatedBy: normalizeOptionalString(item.updatedBy),
    isDeleted: typeof item.isDeleted === 'boolean' ? item.isDeleted : undefined,
    deletedAt: normalizeDateString(item.deletedAt),
    __v: typeof item.__v === 'number' ? item.__v : undefined,
  }
}

const taskListDataPaths = [taskApiDetails.responseDataPath, 'data.data', 'items']
const taskListTotalPaths = [
  taskApiDetails.responseTotalPath,
  'meta.totalRecords',
  'data.total',
  'data.totalRecords',
  'total',
  'totalRecords',
]

function normalizeTaskListResponse(
  response: unknown,
  query: CrudListQuery,
): CrudListResponse<Task> {
  return normalizeCrudListResponse<unknown, Task>({
    response,
    query,
    dataPaths: taskListDataPaths,
    totalPaths: taskListTotalPaths,
    mapItem: normalizeTask,
  })
}

export const tasksApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getTasks: builder.query<CrudListResponse<Task>, CrudListQuery>({
      query: (query) => ({
        url: taskApiDetails.endpoint,
        method: 'GET',
        params: {
          [taskApiDetails.filterQueryParam]: JSON.stringify(query),
        },
      }),
      transformResponse: (response: unknown, _meta: unknown, query: CrudListQuery) => normalizeTaskListResponse(response, query),
      providesTags: (result) =>
        result
          ? [
              ...result.data.map((item) => ({ type: 'Task' as const, id: item._id })),
              { type: 'Task' as const, id: 'LIST' },
            ]
          : [{ type: 'Task' as const, id: 'LIST' }],
    }),
    getTask: builder.query<Task, EntityId>({
      query: (id) => ({
        url: `${taskApiDetails.endpoint}/${id}`,
        method: 'GET',
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeTask(readResponsePath<unknown>(response, taskApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Task response is invalid.')
        }

        return item
      },
      providesTags: (_result, _error, id) => [{ type: 'Task', id }],
    }),
    createTask: builder.mutation<Task, TaskCreatePayload>({
      query: (payload) => ({
        url: taskApiDetails.endpoint,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeTask(readResponsePath<unknown>(response, taskApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Task response is invalid.')
        }

        return item
      },
      invalidatesTags: [{ type: 'Task', id: 'LIST' }],
    }),
    updateTask: builder.mutation<Task, { id: EntityId; data: TaskUpdatePayload }>({
      query: ({ id, data }) => ({
        url: `${taskApiDetails.endpoint}/${id}`,
        method: 'PUT',
        data,
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeTask(readResponsePath<unknown>(response, taskApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Task response is invalid.')
        }

        return item
      },
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Task', id },
        { type: 'Task', id: 'LIST' },
      ],
    }),
    deleteTask: builder.mutation<EntityId, EntityId>({
      query: (id) => ({
        url: `${taskApiDetails.endpoint}/${id}`,
        method: 'DELETE',
      }),
      transformResponse: (_response: unknown, _meta: unknown, id: EntityId) => id,
      invalidatesTags: (_result, _error, id) => [
        { type: 'Task', id },
        { type: 'Task', id: 'LIST' },
      ],
    }),
    bulkDeleteTasks: builder.mutation<EntityId[], { ids: EntityId[] }>({
      query: (payload) => ({
        url: `${taskApiDetails.endpoint}/bulk-delete`,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (_response: unknown, _meta: unknown, payload) => payload.ids,
      invalidatesTags: (_result, _error, payload) => [
        ...payload.ids.map((id) => ({ type: 'Task' as const, id })),
        { type: 'Task' as const, id: 'LIST' },
      ],
    }),
  }),
})

export const {
  useBulkDeleteTasksMutation,
  useCreateTaskMutation,
  useDeleteTaskMutation,
  useGetTaskQuery,
  useGetTasksQuery,
  useUpdateTaskMutation,
} = tasksApi
