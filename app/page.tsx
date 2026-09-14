import { Suspense } from 'react'
import { TriageApp } from '@/components/TriageApp'

export default function Home() {
  return <Suspense fallback={null}><TriageApp /></Suspense>
}
