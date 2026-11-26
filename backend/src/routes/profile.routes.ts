import { Router } from 'express'
import { z } from 'zod'
import { updateProfileImage } from '../services/board.service.js'
import { USERS } from '../types/board.js'

export const profileRouter = Router()

const profileSchema = z.object({
  user: z.enum(USERS),
  image: z
    .string()
    .max(500_000)
    .regex(/^data:image\/webp;base64,[A-Za-z0-9+/]+={0,2}$/)
    .nullable(),
})

profileRouter.put('/', async (req, res, next) => {
  try {
    const input = profileSchema.parse(req.body)
    const profileImages = await updateProfileImage(input.user, input.image)
    res.setHeader('Cache-Control', 'no-store')
    res.json({ profileImages })
  } catch (error) {
    next(error)
  }
})
