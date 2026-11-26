import { NextResponse } from 'next/server'
import { z } from 'zod'
import { readBoard, saveBoard } from '@/lib/board-store'

export const runtime = 'nodejs'

const schema = z.object({
  user: z.enum(['Surajit', 'Maya', 'Alex', 'Jordan']),
  image: z.string().max(500_000).regex(/^data:image\/webp;base64,[A-Za-z0-9+/]+={0,2}$/).nullable(),
})

export async function PUT(request: Request) {
  try {
    const input = schema.parse(await request.json())
    const board = await readBoard()
    if (input.image) board.profileImages[input.user] = input.image
    else delete board.profileImages[input.user]
    await saveBoard(board)
    return NextResponse.json({ profileImages: board.profileImages }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message || 'Invalid profile photo' }, { status: 400 })
    return NextResponse.json({ error: 'Unable to save profile photo' }, { status: 500 })
  }
}
