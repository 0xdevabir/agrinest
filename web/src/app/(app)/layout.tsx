'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Layout } from '../../components/Layout'
import { useSessionField } from '../../hooks/useSessionField'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { fieldId, ready } = useSessionField()
  const router = useRouter()

  useEffect(() => {
    if (ready && !fieldId) router.replace('/onboarding')
  }, [ready, fieldId, router])

  if (!ready || !fieldId) return null
  return <Layout>{children}</Layout>
}
