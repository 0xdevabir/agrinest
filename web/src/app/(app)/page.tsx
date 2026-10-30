'use client'

import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { NationalHome } from '@/components/national'
import { useApp } from '@/lib/app'

// MapLibre needs the browser, so the map screens never render on the server.
const FarmHome = dynamic(() => import('@/components/homes').then((m) => m.FarmHome), { ssr: false })
const AgentHome = dynamic(() => import('@/components/homes').then((m) => m.AgentHome), { ssr: false })
const OfficerHome = dynamic(() => import('@/components/homes').then((m) => m.OfficerHome), { ssr: false })

export default function Home() {
  const { user } = useApp()
  const router = useRouter()
  useEffect(() => { if (user?.role === 'buyer') router.replace('/market') }, [user, router])

  if (user?.role === 'farmer') return <FarmHome />
  if (user?.role === 'agent') return <AgentHome />
  if (user?.role === 'officer') return <OfficerHome />
  if (user?.role === 'admin') return <NationalHome />
  return null
}
