export interface Task {
  _id: string
  taskId: string
  entityId?: string
  entityType?: string
  workflowStage?: string
  assignedTo?: string
  assignedTeam?: string
  priority?: string
  status?: string
  dueDate?: string | Date
  slaTimer?: string | Date
  escalationFlag: boolean
  notes?: string
  active: boolean
  createdAt: string
  updatedAt: string
  createdBy?: string
  updatedBy?: string
  isDeleted?: boolean
  deletedAt?: string | null
  __v?: number
}

export interface TaskFormValues {
  _id?: string
  entityId: string
  entityType: string
  workflowStage: string
  assignedTo: string
  assignedTeam: string
  priority: string
  status: string
  dueDate: Date | null
  slaTimer: Date | null
  escalationFlag: boolean
  notes: string
  active: boolean
}

export interface TaskCreatePayload {
  entityId?: string
  entityType?: string
  workflowStage?: string
  assignedTo?: string
  assignedTeam?: string
  priority?: string
  status?: string
  dueDate?: Date
  slaTimer?: Date
  escalationFlag: boolean
  notes?: string
  active: boolean
}

export type TaskUpdatePayload = TaskCreatePayload
