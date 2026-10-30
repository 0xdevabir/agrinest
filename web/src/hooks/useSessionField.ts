'use client'

import { useEffect, useState } from 'react'
import { loadSession } from '../api'

export function useSessionField() {
  const [fieldId, setFieldId] = useState<string | null>(null)
  const [farmerId, setFarmerId] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const sync = () => {
      const session = loadSession()
      setFieldId(session.fieldId)
      setFarmerId(session.farmerId)
      setReady(true)
    }
    sync()
    window.addEventListener('agrisathi-session', sync)
    return () => window.removeEventListener('agrisathi-session', sync)
  }, [])

  return { fieldId, farmerId, ready, setFieldId, setFarmerId }
}
