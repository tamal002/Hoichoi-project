import { Router } from 'express'
import { getBoard } from '../services/board.service.js'

export const boardRouter = Router()

boardRouter.get('/', async (_req, res, next) => {
  try {
    const board = await getBoard()
    res.setHeader('Cache-Control', 'no-store')
    res.json(board)
  } catch (error) {
    next(error)
  }
})
