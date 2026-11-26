import { Router } from 'express'
import { z } from 'zod'
import { maybeSimulateFailure } from '../middleware/error.js'
import { createTask, deleteTask, updateTask } from '../services/board.service.js'
import { PRIORITIES, STATUS_ORDER, USERS } from '../types/board.js'

export const tasksRouter = Router()

const createTaskSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(100),
  description: z.string().max(500).optional().default(''),
  priority: z.enum(PRIORITIES).default('medium'),
  assignee: z.enum(USERS).default('Surajit'),
  status: z.enum(STATUS_ORDER).default('Todo'),
  labels: z.array(z.string().max(24)).max(4).optional().default([]),
  dueDate: z.string().optional(),
  user: z.string().max(40).optional(),
})

const updateTaskSchema = z.object({
  title: z.string().trim().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  priority: z.enum(PRIORITIES).optional(),
  assignee: z.enum(USERS).optional(),
  status: z.enum(STATUS_ORDER).optional(),
  position: z.number().int().min(0).optional(),
  labels: z.array(z.string().max(24)).max(4).optional(),
  dueDate: z.string().optional(),
  user: z.string().max(40).optional(),
})

tasksRouter.post('/', maybeSimulateFailure, async (req, res, next) => {
  try {
    const input = createTaskSchema.parse(req.body)
    const task = await createTask(input)
    res.status(201).json({ task })
  } catch (error) {
    next(error)
  }
})

tasksRouter.patch('/:id', maybeSimulateFailure, async (req, res, next) => {
  try {
    const id = String(req.params.id)
    const input = updateTaskSchema.parse(req.body)
    const result = await updateTask(id, input)
    res.json(result)
  } catch (error) {
    next(error)
  }
})

tasksRouter.delete('/:id', maybeSimulateFailure, async (req, res, next) => {
  try {
    const id = String(req.params.id)
    const user = typeof req.body?.user === 'string' ? req.body.user : undefined
    await deleteTask(id, user)
    res.json({ success: true })
  } catch (error) {
    next(error)
  }
})
