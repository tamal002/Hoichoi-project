import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { addActivity, readBoard, saveBoard, type Task } from '@/lib/board-store'
import { publish } from '@/lib/board-events'

export const runtime = 'nodejs'
const schema = z.object({ title: z.string().trim().min(1).max(100).optional(), description: z.string().max(500).optional(), priority: z.enum(['low', 'medium', 'high']).optional(), assignee: z.enum(['Surajit', 'Maya', 'Alex', 'Jordan']).optional(), status: z.enum(['Backlog', 'Todo', 'In Progress', 'Done']).optional(), position: z.number().int().min(0).optional(), labels: z.array(z.string().max(24)).max(4).optional(), user: z.string().max(40).optional() })
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const input = schema.parse(await request.json())
    const board = await readBoard()
    const task = board.tasks.find((item) => item.id === id)
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    const previousStatus = task.status
    const previousPositions = new Map(board.tasks.map((item) => [item.id, { status: item.status, position: item.position }]))
    Object.assign(task, input, { updatedAt: new Date().toISOString(), version: task.version + 1 })
    const moving = input.status !== undefined || input.position !== undefined
    if (moving) {
      const target = task.status
      if (previousStatus !== target) board.tasks.filter((item) => item.status === previousStatus).sort((a, b) => a.position - b.position).forEach((item, index) => { item.position = index })
      const sorted = board.tasks.filter((item) => item.status === target && item.id !== id).sort((a, b) => a.position - b.position)
      sorted.splice(Math.min(task.position, sorted.length), 0, task)
      sorted.forEach((item, index) => { item.position = index })
      const changedAt = new Date().toISOString()
      for (const item of board.tasks) {
        if (item.id === task.id) continue
        const previous = previousPositions.get(item.id)
        if (previous && (previous.status !== item.status || previous.position !== item.position)) {
          item.version += 1
          item.updatedAt = changedAt
        }
      }
    }
    const action = previousStatus !== task.status ? `moved “${task.title}” to ${task.status}` : `updated “${task.title}”`
    addActivity(board, action, input.user)
    await saveBoard(board)
    const type = previousStatus !== task.status || input.position !== undefined ? 'TASK_MOVED' : 'TASK_UPDATED'
    publish({ id: randomUUID(), type, task, tasks: moving ? board.tasks : undefined })
    publish({ id: randomUUID(), type: 'ACTIVITY', activity: board.activity[0] })
    return NextResponse.json({ task, tasks: board.tasks })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message || 'Invalid task details' }, { status: 400 })
    return NextResponse.json({ error: 'Unable to update task' }, { status: 500 })
  }
}
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const body = await request.json().catch(() => ({}))
    const board = await readBoard()
    const task = board.tasks.find((item) => item.id === id)
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    board.tasks = board.tasks.filter((item) => item.id !== id)
    board.tasks.filter((item) => item.status === task.status).sort((a, b) => a.position - b.position).forEach((item, index) => { item.position = index })
    addActivity(board, `deleted “${task.title}”`, typeof body.user === 'string' ? body.user : undefined)
    await saveBoard(board)
    publish({ id: randomUUID(), type: 'TASK_DELETED', taskId: id })
    publish({ id: randomUUID(), type: 'ACTIVITY', activity: board.activity[0] })
    return NextResponse.json({ success: true })
  } catch { return NextResponse.json({ error: 'Unable to delete task' }, { status: 500 }) }
}
