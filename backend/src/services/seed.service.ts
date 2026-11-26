import { randomUUID } from 'node:crypto'
import { ActivityModel } from '../models/Activity.js'
import { TaskModel } from '../models/Task.js'
import type { TaskDTO } from '../types/board.js'

export async function seedDatabaseIfEmpty(): Promise<void> {
  const existingCount = await TaskModel.countDocuments()
  if (existingCount > 0) return

  const now = Date.now()
  const seedTasks: TaskDTO[] = [
    { id: 'nex-101', title: 'Design system foundations', description: 'Define color tokens, type scale, and component primitives for the new product experience.', priority: 'high', assignee: 'Maya', status: 'Backlog', position: 0, updatedAt: new Date(now - 1000 * 60 * 22).toISOString(), labels: ['Design', 'Foundation'], version: 1 },
    { id: 'nex-102', title: 'Audit onboarding flow', description: 'Map the current activation journey and identify friction points.', priority: 'medium', assignee: 'Alex', status: 'Backlog', position: 1, updatedAt: new Date(now - 1000 * 60 * 60 * 3).toISOString(), labels: ['Research'], version: 1 },
    { id: 'nex-103', title: 'Set up analytics events', description: 'Instrument core product events and verify them in the dashboard.', priority: 'low', assignee: 'Surajit', status: 'Backlog', position: 2, updatedAt: new Date(now - 1000 * 60 * 60 * 5).toISOString(), labels: ['Engineering'], version: 1 },
    { id: 'nex-104', title: 'Create component library', description: 'Build reusable buttons, inputs, and navigation patterns.', priority: 'high', assignee: 'Jordan', status: 'Todo', position: 0, updatedAt: new Date(now - 1000 * 60 * 18).toISOString(), labels: ['Engineering', 'Design'], version: 1 },
    { id: 'nex-105', title: 'Review API architecture', description: 'Align on resource boundaries, validation, and error conventions.', priority: 'medium', assignee: 'Surajit', status: 'Todo', position: 1, updatedAt: new Date(now - 1000 * 60 * 60 * 1).toISOString(), labels: ['Engineering'], version: 1 },
    { id: 'nex-106', title: 'Write launch checklist', description: 'Collect release criteria, owners, and go-live dependencies.', priority: 'low', assignee: 'Maya', status: 'Todo', position: 2, updatedAt: new Date(now - 1000 * 60 * 60 * 4).toISOString(), labels: ['Planning'], version: 1 },
    { id: 'nex-107', title: 'Build workspace dashboard', description: 'Create a clean command center for teams to see what needs attention.', priority: 'high', assignee: 'Surajit', status: 'In Progress', position: 0, updatedAt: new Date(now - 1000 * 60 * 5).toISOString(), labels: ['Engineering', 'Product'], dueDate: '2026-11-23', version: 1 },
    { id: 'nex-108', title: 'Ship task detail panel', description: 'Add context, ownership, and quick actions without leaving the board.', priority: 'medium', assignee: 'Alex', status: 'In Progress', position: 1, updatedAt: new Date(now - 1000 * 60 * 42).toISOString(), labels: ['Product'], version: 1 },
    { id: 'nex-109', title: 'Document visual language', description: 'Capture the decisions behind the brand and UI system.', priority: 'low', assignee: 'Jordan', status: 'In Progress', position: 2, updatedAt: new Date(now - 1000 * 60 * 60 * 2).toISOString(), labels: ['Design'], version: 1 },
    { id: 'nex-110', title: 'Define product principles', description: 'Align the team on a concise set of product decision principles.', priority: 'medium', assignee: 'Maya', status: 'Done', position: 0, updatedAt: new Date(now - 1000 * 60 * 60 * 2).toISOString(), labels: ['Product'], version: 1 },
    { id: 'nex-111', title: 'Set up project workspace', description: 'Create the shared workspace and invite the core team.', priority: 'low', assignee: 'Surajit', status: 'Done', position: 1, updatedAt: new Date(now - 1000 * 60 * 60 * 24).toISOString(), labels: ['Planning'], version: 1 },
  ]

  await TaskModel.insertMany(seedTasks)

  const activityCount = await ActivityModel.countDocuments()
  if (activityCount === 0) {
    await ActivityModel.create({
      id: randomUUID(),
      text: 'Board created',
      time: new Date().toISOString(),
      user: 'Surajit',
    })
  }

  console.log(`Seeded ${seedTasks.length} initial tasks into MongoDB`)
}
