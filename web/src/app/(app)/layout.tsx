'use client'

import { useRouter } from 'next/navigation'
import { useEffect, type ReactNode } from 'react'
import { FieldBackdrop } from '@/components/FieldBackdrop'
import { TabBar } from '@/components/ui'
import { useApp } from '@/lib/app'

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, ready } = useApp()
  const router = useRouter()

  useEffect(() => { if (ready && !user) router.replace('/login') }, [ready, user, router])

  if (!user) return <div className="login"><FieldBackdrop /></div>
  return <><div className="app-main">{children}</div><TabBar /></>
}

