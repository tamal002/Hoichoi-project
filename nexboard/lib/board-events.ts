export type BoardEvent = { id: string; type: 'TASK_CREATED' | 'TASK_UPDATED' | 'TASK_DELETED' | 'TASK_MOVED' | 'ACTIVITY'; task?: unknown; taskId?: string; tasks?: unknown; activity?: unknown }
type Listener = (event: BoardEvent) => void
const listeners = new Set<Listener>()
export function publish(event: BoardEvent) {
  for (const listener of listeners) listener(event)
}
export function subscribe(listener: Listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
