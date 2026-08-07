import { useMemo } from 'react'
import { CrudPage } from '@/components/crud/CrudPage'
import type { CrudPageConfig } from '@/types/crud'
import { createTaskFormConfig, createTaskTableColumns, mapTaskFormToPayload, mapTaskToFormValues, renderTaskDetails, renderTaskGridItem } from '@/models/taskModel'
import { useBulkDeleteTasksMutation, useCreateTaskMutation, useDeleteTaskMutation, useGetTasksQuery, useUpdateTaskMutation } from '@/services/api/endpoints/tasksApi'
import type { EntityId } from '@/types/common'
import type { RcmReferenceOptions } from '@/models/rcmReferenceOptions'
import type { Task, TaskCreatePayload, TaskFormValues, TaskUpdatePayload } from '@/types/task'

type BulkDeletePayload = {
  ids: EntityId[]
}

export function TasksPage() {
  const referenceOptions: RcmReferenceOptions = useMemo(() => ({}), [])

  const crudConfig: CrudPageConfig<
    Task,
    TaskFormValues,
    TaskCreatePayload,
    TaskUpdatePayload,
    BulkDeletePayload
  > = useMemo(
    () => ({
      title: 'Tasks / Work Queue',
      resourceName: 'Task',
      createButtonLabel: 'Add Task',
      createDialogTitle: 'Add task',
      editDialogTitle: 'Edit task',
      viewDialogTitle: 'Task details',
      deleteDialogTitle: 'Delete task?',
      emptyMessage: 'No tasks found.',
      exportFileName: 'tasks',
      pageSizeOptions: [10, 20, 50],
      defaultQuery: {
        page: 1,
        limit: 20,
        sortfield: 'updated',
        direction: 'desc',
        criteria: [],
      },
      permissions: {
        module: 'tasks',
      },
      getRowId: (item) => item._id,
      getRowLabel: (item) => renderTaskGridItem(item, referenceOptions) ? String(item._id) : String(item._id),
      table: {
        columns: createTaskTableColumns(referenceOptions),
      },
      form: createTaskFormConfig(referenceOptions),
      api: {
        useBulkDeleteMutation: useBulkDeleteTasksMutation,
        useListQuery: useGetTasksQuery,
        useCreateMutation: useCreateTaskMutation,
        useUpdateMutation: useUpdateTaskMutation,
        useDeleteMutation: useDeleteTaskMutation,
      },
      mapItemToFormValues: mapTaskToFormValues,
      mapFormValuesToCreatePayload: mapTaskFormToPayload,
      mapFormValuesToUpdatePayload: (values) => mapTaskFormToPayload(values),
      bulkDelete: {
        buttonLabel: 'Delete Selected',
        confirmTitle: 'Delete selected tasks?',
        confirmLabel: 'Delete Selected',
        confirmMessage: (items) =>
          `This will permanently delete ${items.length} selected ${items.length === 1 ? 'task' : 'tasks'}.`,
        successMessage: (items) =>
          `${items.length} ${items.length === 1 ? 'task' : 'tasks'} deleted successfully.`,
        mapSelectedItemsToPayload: (items) => ({
          ids: items.map((item) => item._id),
        }),
      },
      deleteDialogMessage: (item) => `This will permanently delete ${item._id}.`,
      slots: {
        viewContent: (item) => renderTaskDetails(item, referenceOptions),
        gridItem: (item) => renderTaskGridItem(item, referenceOptions),
      },
    }),
    [referenceOptions],
  )

  return <CrudPage config={crudConfig} />
}
