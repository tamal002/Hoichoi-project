import { Suspense } from 'react'
import Nexboard from '@/components/nexboard'

export default function Page() {
  return <Suspense fallback={<main className="loading-shell"><div className="loading-mark">N</div><span>Opening your workspace…</span></main>}><Nexboard /></Suspense>
}
