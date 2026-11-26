import { randomUUID } from 'node:crypto'
import { Router, type Request } from 'express'
import { getSubscriberCount, publishEvent, subscribeEvents } from '../services/events.service.js'
import { USERS, type BoardEvent } from '../types/board.js'

export const eventsRouter = Router()
const connectedUsers = new Map<(event: BoardEvent) => void, string>()

eventsRouter.get('/', (req: Request, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders?.()

  const send = (event: BoardEvent) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`)
  }

  const requestedUser = req.query.user
  const user = typeof requestedUser === 'string' && (USERS as readonly string[]).includes(requestedUser)
    ? requestedUser
    : null
  const unsubscribe = subscribeEvents(send)
  if (user) connectedUsers.set(send, user)
  send({ id: 'connected', type: 'CONNECTED' })
  const publishPresence = () => {
    publishEvent({
      id: randomUUID(),
      type: 'PRESENCE',
      activeUsers: [...new Set(connectedUsers.values())],
    })
  }
  publishPresence()
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n')
  }, 20000)

  res.on('close', () => {
    unsubscribe()
    clearInterval(heartbeat)
    connectedUsers.delete(send)
    publishPresence()
  })
})
