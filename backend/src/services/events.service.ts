import type { BoardEvent } from '../types/board.js'

type Listener = (event: BoardEvent) => void

const listeners = new Set<Listener>()

export function publishEvent(event: BoardEvent): void {
  for (const listener of listeners) {
    try {
      listener(event)
    } catch {
      // Ignore individual broken stream listeners; cleanup happens on close.
    }
  }
}

export function subscribeEvents(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getSubscriberCount(): number {
  return listeners.size
}
