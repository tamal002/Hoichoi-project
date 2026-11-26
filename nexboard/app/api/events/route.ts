import { subscribe } from '@/lib/board-events'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export async function GET() {
  const encoder = new TextEncoder()
  let heartbeat: ReturnType<typeof setInterval>
  let unsubscribe = () => {}
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
      send({ id: 'connected', type: 'CONNECTED' })
      unsubscribe = subscribe(send)
      heartbeat = setInterval(() => controller.enqueue(encoder.encode(': heartbeat\n\n')), 20000)
    },
    cancel() { unsubscribe(); clearInterval(heartbeat) },
  })
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' } })
}
