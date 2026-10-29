import { useState } from 'react'
import { loadSession } from '../api'

export function useSessionField() {
  const initial = loadSession()
  const [fieldId, setFieldId] = useState<string | null>(initial.fieldId)
  const [farmerId, setFarmerId] = useState<string | null>(initial.farmerId)

  return { fieldId, farmerId, setFieldId, setFarmerId }
}
