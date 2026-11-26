import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { addActivity, createTask, readBoard, saveBoard, type Status, type Task } from '@/lib/board-store'
import { publish } from '@/lib/board-events'

export const runtime = 'nodejs'
const schema = z.object({ title: z.string().trim().min(1).max(100), description: z.string().max(500).optional().default(''), priority: z.enum(['low', 'medium', 'high']).default('medium'), assignee: z.enum(['Surajit', 'Maya', 'Alex', 'Jordan']).default('Surajit'), status: z.enum(['Backlog', 'Todo', 'In Progress', 'Done']).default('Todo'), labels: z.array(z.string().max(24)).max(4).optional().default([]), user: z.string().max(40).optional() })
export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json())
    const board = await readBoard()
    const position = board.tasks.filter((task) => task.status === input.status).length
    const task = createTask({ title: input.title, description: input.description, priority: input.priority, assignee: input.assignee, status: input.status, position, labels: input.labels })
    board.tasks.push(task)
    addActivity(board, `created “${task.title}”`, input.user)
    await saveBoard(board)
    publish({ id: randomUUID(), type: 'TASK_CREATED', task })
    publish({ id: randomUUID(), type: 'ACTIVITY', activity: board.activity[0] })
    return NextResponse.json({ task }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message || 'Invalid task details' }, { status: 400 })
    return NextResponse.json({ error: 'Unable to create task' }, { status: 500 })
  }
}
