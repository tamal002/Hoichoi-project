import { Schema, model, type InferSchemaType } from 'mongoose'
import { PRIORITIES, STATUS_ORDER } from '../types/board.js'

const taskSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, default: '', maxlength: 500 },
    priority: { type: String, enum: PRIORITIES, default: 'medium', required: true },
    assignee: { type: String, required: true, default: 'Surajit' },
    status: { type: String, enum: STATUS_ORDER, default: 'Todo', required: true },
    position: { type: Number, required: true, min: 0 },
    updatedAt: { type: String, required: true },
    labels: { type: [String], default: [] },
    dueDate: { type: String, required: false },
    version: { type: Number, required: true, default: 1 },
  },
  {
    versionKey: false,
  }
)

taskSchema.index({ status: 1, position: 1 })

export type TaskDocument = InferSchemaType<typeof taskSchema>
export const TaskModel = model('Task', taskSchema)
