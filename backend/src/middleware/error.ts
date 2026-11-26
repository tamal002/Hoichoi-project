import type { NextFunction, Request, Response } from 'express'
import { ZodError } from 'zod'
import { env } from '../config/env.js'

export class HttpError extends Error {
  statusCode: number

  constructor(statusCode: number, message: string) {
    super(message)
    this.statusCode = statusCode
    this.name = 'HttpError'
  }
}

export function maybeSimulateFailure(req: Request, res: Response, next: NextFunction): void {
  const forceFailure = req.header('x-simulate-failure') === 'true'
  const randomFailure = env.SIMULATE_FAILURE_RATE > 0 && Math.random() < env.SIMULATE_FAILURE_RATE

  if (forceFailure || randomFailure) {
    res.status(503).json({ error: 'Simulated transient server error' })
    return
  }

  next()
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Route not found' })
}

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (error instanceof ZodError) {
    res.status(400).json({ error: error.issues[0]?.message || 'Invalid request payload' })
    return
  }

  if (error instanceof HttpError) {
    res.status(error.statusCode).json({ error: error.message })
    return
  }

  console.error('Unhandled error:', error)
  res.status(500).json({ error: 'Internal server error' })
}
