import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import { useSessionField } from './useSessionField'
import type { Workbench } from '../work/types'

export function useWorkbench() {
  const { fieldId } = useSessionField()
  const [data, setData] = useState<Workbench | null>(null)
  const [err, setErr] = useState('')
  const [tick, setTick] = useState(0)

  const reload = useCallback(() => setTick((n) => n + 1), [])

  useEffect(() => {
    if (!fieldId) return
    let cancel = false
    api
      .workbench(fieldId)
      .then((d) => {
        if (!cancel) setData(d)
      })
      .catch((e) => {
        if (!cancel) setErr(e instanceof Error ? e.message : 'load failed')
      })
    return () => {
      cancel = true
    }
  }, [fieldId, tick])

  return { fieldId, data, err, reload }
}

const doneKey = (fieldId: string, taskId: string) => {
  const day = new Date().toISOString().slice(0, 10)
  return `agri_task_${fieldId}_${day}_${taskId}`
}

export function taskDone(fieldId: string, taskId: string) {
  return localStorage.getItem(doneKey(fieldId, taskId)) === '1'
}

export async function markTask(fieldId: string, taskId: string) {
  localStorage.setItem(doneKey(fieldId, taskId), '1')
  await api.followTask(fieldId, taskId)
}
