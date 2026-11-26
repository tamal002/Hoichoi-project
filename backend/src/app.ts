import cors from 'cors'
import express from 'express'
import mongoose from 'mongoose'
import { env } from './config/env.js'
import { errorHandler, notFoundHandler } from './middleware/error.js'
import { boardRouter } from './routes/board.routes.js'
import { eventsRouter } from './routes/events.routes.js'
import { profileRouter } from './routes/profile.routes.js'
import { tasksRouter } from './routes/tasks.routes.js'
import { getSubscriberCount } from './services/events.service.js'

export function createApp() {
  const app = express()

  const allowedOrigins = env.CORS_ORIGIN.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

  app.use(
    cors({
      origin: allowedOrigins.length > 0 ? allowedOrigins : true,
      credentials: true,
    })
  )

  app.use(express.json({ limit: '1mb' }))

  app.get('/health', (_req, res) => {
    const dbState = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    res.json({
      status: 'ok',
      db: dbState,
      sseClients: getSubscriberCount(),
    })
  })

  app.use('/api/board', boardRouter)
  app.use('/api/tasks', tasksRouter)
  app.use('/api/events', eventsRouter)
  app.use('/api/profile', profileRouter)

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
