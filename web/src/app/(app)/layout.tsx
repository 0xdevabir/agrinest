'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, type ReactNode } from 'react'
import { FieldBackdrop } from '@/components/FieldBackdrop'
import { TabBar } from '@/components/ui'
import { useApp } from '@/lib/app'

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, ready } = useApp()
  const router = useRouter()
  const path = usePathname()

  useEffect(() => { if (ready && !user) router.replace('/login') }, [ready, user, router])

  if (!user) return <div className="login"><FieldBackdrop /></div>
  return <><div className="app-main" key={path}>{children}</div><TabBar /></>
}

