'use client'

import { useEffect, useRef, useState } from 'react'

export type MyLocation = { p: number[]; acc: number | null }

/** The user's live position. Starts by itself only if they already allowed location, so opening the map never prompts. */
export function useMyLocation() {
  const [me, setMe] = useState<MyLocation | null>(null)
  const [failed, setFailed] = useState(false)
  const watch = useRef<number | null>(null)

  const start = () => {
    setFailed(false)
    if (watch.current !== null) return
    if (!navigator.geolocation) { setFailed(true); return }
    watch.current = navigator.geolocation.watchPosition(
      (pos) => {
        setFailed(false)
        setMe({ p: [pos.coords.longitude, pos.coords.latitude], acc: Math.round(pos.coords.accuracy) || null })
      },
      (err) => {
        setFailed(true)
        // Once refused the watch is dead, so let the next tap ask again.
        if (err.code === err.PERMISSION_DENIED && watch.current !== null) {
          navigator.geolocation.clearWatch(watch.current)
          watch.current = null
        }
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    )
  }

  useEffect(() => {
    navigator.permissions?.query({ name: 'geolocation' })
      .then((s) => { if (s.state === 'granted') start() })
      .catch(() => undefined)
    return () => { if (watch.current !== null) navigator.geolocation.clearWatch(watch.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { me, failed, start }
}
