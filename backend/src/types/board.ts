export const STATUS_ORDER = ['Backlog', 'Todo', 'In Progress', 'Done'] as const
export type Status = (typeof STATUS_ORDER)[number]

export const PRIORITIES = ['low', 'medium', 'high'] as const
export type Priority = (typeof PRIORITIES)[number]

export const USERS = ['Surajit', 'Maya', 'Alex', 'Jordan'] as const
export type UserName = (typeof USERS)[number]

export interface TaskDTO {
  id: string
  title: string
  description: string
  priority: Priority
  assignee: string
  status: Status
  position: number
  updatedAt: string
  labels: string[]
  dueDate?: string
  version: number
}

export interface ActivityDTO {
  id: string
  text: string
  time: string
  user: string
}

export interface BoardDataDTO {
  tasks: TaskDTO[]
  activity: ActivityDTO[]
  profileImages: Record<string, string>
}

export type BoardEvent = {
  id: string
  type: 'CONNECTED' | 'PRESENCE' | 'TASK_CREATED' | 'TASK_UPDATED' | 'TASK_DELETED' | 'TASK_MOVED' | 'ACTIVITY'
  activeUsers?: string[]
  task?: TaskDTO
  taskId?: string
  tasks?: TaskDTO[]
  activity?: ActivityDTO
}
