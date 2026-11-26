import { randomUUID } from 'node:crypto'
import { ActivityModel } from '../models/Activity.js'
import { ProfileModel } from '../models/Profile.js'
import { TaskModel } from '../models/Task.js'
import {
  STATUS_ORDER,
  type ActivityDTO,
  type BoardDataDTO,
  type Priority,
  type Status,
  type TaskDTO,
} from '../types/board.js'
import { HttpError } from '../middleware/error.js'
import { publishEvent } from './events.service.js'

const MAX_ACTIVITY_ITEMS = 30

function toTaskDTO(doc: {
  id: string
  title: string
  description?: string | null
  priority: Priority
  assignee: string
  status: Status
  position: number
  updatedAt: string
  labels?: string[] | null
  dueDate?: string | null
  version: number
}): TaskDTO {
  const dto: TaskDTO = {
    id: doc.id,
    title: doc.title,
    description: doc.description ?? '',
    priority: doc.priority,
    assignee: doc.assignee,
    status: doc.status,
    position: doc.position,
    updatedAt: doc.updatedAt,
    labels: Array.isArray(doc.labels) ? doc.labels : [],
    version: doc.version,
  }
  if (doc.dueDate) dto.dueDate = doc.dueDate
  return dto
}

function sortTasks(tasks: TaskDTO[]): TaskDTO[] {
  return [...tasks].sort(
    (a, b) =>
      STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) ||
      a.position - b.position
  )
}

async function recordActivity(text: string, user = 'Surajit'): Promise<ActivityDTO> {
  const activity: ActivityDTO = {
    id: randomUUID(),
    text,
    time: new Date().toISOString(),
    user,
  }
  await ActivityModel.create(activity)

  const stale = await ActivityModel.find()
    .sort({ time: -1 })
    .skip(MAX_ACTIVITY_ITEMS)
    .select({ _id: 1 })
    .lean()

  if (stale.length > 0) {
    await ActivityModel.deleteMany({ _id: { $in: stale.map((item) => item._id) } })
  }

  return activity
}

async function getProfileImagesMap(): Promise<Record<string, string>> {
  const profiles = await ProfileModel.find().lean()
  const map: Record<string, string> = {}
  for (const profile of profiles) {
    map[profile.user] = profile.image
  }
  return map
}

export async function getBoard(): Promise<BoardDataDTO> {
  const [taskDocs, activityDocs, profileImages] = await Promise.all([
    TaskModel.find().lean(),
    ActivityModel.find().sort({ time: -1 }).limit(MAX_ACTIVITY_ITEMS).lean(),
    getProfileImagesMap(),
  ])

  const tasks = sortTasks(taskDocs.map((doc) => toTaskDTO(doc as TaskDTO)))
  const activity: ActivityDTO[] = activityDocs.map((doc) => ({
    id: doc.id,
    text: doc.text,
    time: doc.time,
    user: doc.user,
  }))

  return { tasks, activity, profileImages }
}

export interface CreateTaskInput {
  title: string
  description: string
  priority: Priority
  assignee: string
  status: Status
  labels: string[]
  dueDate?: string
  user?: string
}

export async function createTask(input: CreateTaskInput): Promise<TaskDTO> {
  const position = await TaskModel.countDocuments({ status: input.status })
  const task: TaskDTO = {
    id: randomUUID(),
    title: input.title,
    description: input.description,
    priority: input.priority,
    assignee: input.assignee,
    status: input.status,
    position,
    updatedAt: new Date().toISOString(),
    labels: input.labels,
    ...(input.dueDate ? { dueDate: input.dueDate } : {}),
    version: 1,
  }

  await TaskModel.create(task)
  const activity = await recordActivity(`created “${task.title}”`, input.user || input.assignee)

  publishEvent({ id: randomUUID(), type: 'TASK_CREATED', task })
  publishEvent({ id: randomUUID(), type: 'ACTIVITY', activity })

  return task
}

export interface UpdateTaskInput {
  title?: string
  description?: string
  priority?: Priority
  assignee?: string
  status?: Status
  position?: number
  labels?: string[]
  dueDate?: string
  user?: string
}

export async function updateTask(
  id: string,
  input: UpdateTaskInput
): Promise<{ task: TaskDTO; tasks: TaskDTO[] }> {
  const allDocs = await TaskModel.find().lean()
  const tasks = allDocs.map((doc) => toTaskDTO(doc as TaskDTO))
  const task = tasks.find((item) => item.id === id)

  if (!task) {
    throw new HttpError(404, 'Task not found')
  }

  const previousStatus = task.status
  const previousPositions = new Map(
    tasks.map((item) => [item.id, { status: item.status, position: item.position }])
  )

  const { user, ...updates } = input
  const now = new Date().toISOString()

  Object.assign(task, updates, { updatedAt: now, version: task.version + 1 })

  const moving = input.status !== undefined || input.position !== undefined
  if (moving) {
    const target = task.status
    if (previousStatus !== target) {
      tasks
        .filter((item) => item.status === previousStatus)
        .sort((a, b) => a.position - b.position)
        .forEach((item, index) => {
          item.position = index
        })
    }

    const sortedTarget = tasks
      .filter((item) => item.status === target && item.id !== id)
      .sort((a, b) => a.position - b.position)

    sortedTarget.splice(Math.min(task.position, sortedTarget.length), 0, task)
    sortedTarget.forEach((item, index) => {
      item.position = index
    })

    for (const item of tasks) {
      if (item.id === task.id) continue
      const prev = previousPositions.get(item.id)
      if (prev && (prev.status !== item.status || prev.position !== item.position)) {
        item.version += 1
        item.updatedAt = now
      }
    }
  }

  const bulkOps = tasks
    .filter((item) => {
      if (item.id === task.id) return true
      const prev = previousPositions.get(item.id)
      return Boolean(prev && (prev.status !== item.status || prev.position !== item.position))
    })
    .map((item) => ({
      updateOne: {
        filter: { id: item.id },
        update: { $set: item },
      },
    }))

  if (bulkOps.length > 0) {
    await TaskModel.bulkWrite(bulkOps)
  }

  const sortedAll = sortTasks(tasks)
  const action =
    previousStatus !== task.status
      ? `moved “${task.title}” to ${task.status}`
      : `updated “${task.title}”`

  const activity = await recordActivity(action, user)
  const eventType =
    previousStatus !== task.status || input.position !== undefined ? 'TASK_MOVED' : 'TASK_UPDATED'

  publishEvent({
    id: randomUUID(),
    type: eventType,
    task,
    tasks: moving ? sortedAll : undefined,
  })
  publishEvent({ id: randomUUID(), type: 'ACTIVITY', activity })

  return { task, tasks: sortedAll }
}

export async function deleteTask(id: string, user?: string): Promise<void> {
  const existing = await TaskModel.findOne({ id }).lean()
  if (!existing) {
    throw new HttpError(404, 'Task not found')
  }

  await TaskModel.deleteOne({ id })

  const remainingInColumn = await TaskModel.find({ status: existing.status })
    .sort({ position: 1 })
    .lean()

  if (remainingInColumn.length > 0) {
    const bulkOps = remainingInColumn.map((item, index) => ({
      updateOne: {
        filter: { id: item.id },
        update: { $set: { position: index } },
      },
    }))
    await TaskModel.bulkWrite(bulkOps)
  }

  const activity = await recordActivity(`deleted “${existing.title}”`, user)

  publishEvent({ id: randomUUID(), type: 'TASK_DELETED', taskId: id })
  publishEvent({ id: randomUUID(), type: 'ACTIVITY', activity })
}

export async function updateProfileImage(
  user: string,
  image: string | null
): Promise<Record<string, string>> {
  if (image) {
    await ProfileModel.findOneAndUpdate(
      { user },
      { user, image },
      { upsert: true, new: true }
    )
  } else {
    await ProfileModel.deleteOne({ user })
  }

  return getProfileImagesMap()
}
