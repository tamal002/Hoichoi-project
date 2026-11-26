import { NextResponse } from 'next/server'
import { readBoard } from '@/lib/board-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export async function GET() {
  const board = await readBoard()
  board.tasks.sort((a, b) => ['Backlog', 'Todo', 'In Progress', 'Done'].indexOf(a.status) - ['Backlog', 'Todo', 'In Progress', 'Done'].indexOf(b.status) || a.position - b.position)
  return NextResponse.json(board, { headers: { 'Cache-Control': 'no-store' } })
}
