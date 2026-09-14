import { Suspense } from 'react'
import { OutreachApp } from '@/components/OutreachApp'

export const metadata = { title: 'Outreach drafts — Lead Triage' }

export default function OutreachPage() {
  return <Suspense fallback={null}><OutreachApp /></Suspense>
}
