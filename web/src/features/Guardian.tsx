'use client'

import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useLocation } from '../lib/router'
import { api, resizeImageFile, type Dashboard, type DiagnoseResult, type EventRow } from '../api'
import { useSessionField } from '../hooks/useSessionField'
import { useI18n } from '../i18n/I18nProvider'
import { GuardianDesk } from './GuardianDesk'

type Impact = {
  yield: NonNullable<Dashboard['yield_estimate']>
  market: NonNullable<Dashboard['market']>
}

export function Guardian() {
  const { fieldId, ready } = useSessionField()
  const { pathname } = useLocation()
  const { t, disease, tr } = useI18n()
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [preview, setPreview] = useState<string | null>(null)
  const [result, setResult] = useState<DiagnoseResult | null>(null)
  const [impact, setImpact] = useState<Impact | null>(null)
  const [history, setHistory] = useState<EventRow[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [force, setForce] = useState('rice_blast')
  const [camOn, setCamOn] = useState(false)
  const [streamTick, setStreamTick] = useState(0)
  const [facing, setFacing] = useState<'environment' | 'user'>('environment')
  const [treated, setTreated] = useState(false)

  useEffect(() => {
    if (!fieldId) return
    api
      .dashboard(fieldId)
      .then((d) => {
        setHistory(d.events.filter((e) => e.type === 'diagnosis' || e.type === 'treatment_logged'))
      })
      .catch(() => {})
  }, [fieldId])

  useEffect(() => {
    const video = videoRef.current
    const stream = streamRef.current
    if (!camOn || !video || !stream) return
    video.srcObject = stream
    void video.play().catch(() => setErr(t('guardian.camFail')))
  }, [camOn, streamTick, t])

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  if (!ready) return null
  if (!fieldId) return <Navigate to="/onboarding" replace />

  function stopCam() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setCamOn(false)
  }

  async function startCam(mode: 'environment' | 'user' = facing) {
    setErr('')
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: mode }, width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      streamRef.current = stream
      setFacing(mode)
      setPreview(null)
      setStreamTick((n) => n + 1)
      setCamOn(true)
    } catch {
      streamRef.current = null
      setCamOn(false)
      setErr(t('guardian.camFail'))
    }
  }

  async function analyze(file: File) {
    if (!fieldId) return
    setBusy(true)
    setErr('')
    setResult(null)
    setTreated(false)
    try {
      const resized = await resizeImageFile(file)
      if (preview) URL.revokeObjectURL(preview)
      setPreview(URL.createObjectURL(resized))
      stopCam()
      const res = await api.diagnose(fieldId, resized, force || undefined)
      setResult(res)
      const [y, m, dash] = await Promise.all([
        api.yieldEst(fieldId),
        api.marketHint(fieldId),
        api.dashboard(fieldId),
      ])
      setImpact({ yield: y, market: m })
      setHistory(dash.events.filter((e) => e.type === 'diagnosis' || e.type === 'treatment_logged'))
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('guardian.fail'))
    } finally {
      setBusy(false)
    }
  }

  async function shutter() {
    const video = videoRef.current
    if (!video || !video.videoWidth) {
      setErr(t('guardian.camFail'))
      return
    }
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9))
    if (!blob) return
    await analyze(new File([blob], 'leaf-capture.jpg', { type: 'image/jpeg' }))
  }

  async function logTreatment() {
    if (!fieldId) return
    setBusy(true)
    try {
      await api.logTreatment(fieldId)
      const [y, dash] = await Promise.all([api.yieldEst(fieldId), api.dashboard(fieldId)])
      setImpact((prev) => (prev ? { ...prev, yield: y } : prev))
      setHistory(dash.events.filter((e) => e.type === 'diagnosis' || e.type === 'treatment_logged'))
      setTreated(true)
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('guardian.logFail'))
    } finally {
      setBusy(false)
    }
  }

  const dx = result
    ? disease(result.disease_id, result.name_bn, result.name_en, result.steps_bn, result.chemical_note_bn)
    : null
  const pct = result ? Math.round(result.confidence * 100) : 0

  const view = pathname.endsWith('/history') ? 'history' : pathname.endsWith('/treatment') ? 'treatment' : 'scan'

  if (view === 'history' || view === 'treatment') {
    return <GuardianDesk view={view} fieldId={fieldId} />
  }

  return (
    <div className="guardian">
      {view === 'scan' && <section className="viewfinder">
        {camOn ? (
          <video ref={videoRef} className="viewfinder-media" playsInline muted autoPlay />
        ) : preview ? (
          <img className="viewfinder-media" src={preview} alt={t('guardian.leafAlt')} />
        ) : (
          <div className="viewfinder-empty">
            <span className="reticle" aria-hidden="true" />
            <p>{t('guardian.ready')}</p>
          </div>
        )}
        {camOn && <span className="reticle live" aria-hidden="true" />}
        {busy && <p className="viewfinder-status pulse">{t('guardian.analyzing')}</p>}
      </section>}

      {view === 'scan' && <div className="shutter-row">
        {!camOn ? (
          <button type="button" onClick={() => startCam(facing)}>
            {t('guardian.live')}
          </button>
        ) : (
          <>
            <button type="button" className="shutter" onClick={shutter} disabled={busy} aria-label={t('guardian.capture')}>
              <span />
            </button>
            <button type="button" className="secondary" onClick={() => startCam(facing === 'environment' ? 'user' : 'environment')}>
              {t('guardian.flip')}
            </button>
            <button type="button" className="secondary" onClick={stopCam}>
              {t('guardian.stop')}
            </button>
          </>
        )}
        <label className="gallery-btn">
          {t('guardian.gallery')}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void analyze(file)
              e.target.value = ''
            }}
          />
        </label>
      </div>}

      {view === 'scan' && <div className="field demo-force">
        <label htmlFor="force">{t('guardian.force')}</label>
        <select id="force" value={force} onChange={(e) => setForce(e.target.value)}>
          <option value="">{t('guardian.auto')}</option>
          <option value="rice_blast">{t('guardian.blast')}</option>
          <option value="bacterial_leaf_blight">{t('guardian.blb')}</option>
          <option value="brown_spot">{t('guardian.brown')}</option>
          <option value="sheath_blight">{t('guardian.sheath')}</option>
          <option value="healthy">{t('guardian.healthy')}</option>
        </select>
      </div>}

      {err && <p className="panel" style={{ color: 'var(--danger)' }}>{err}</p>}

      {view === 'scan' && result && dx && (
        <section className="panel dx-card">
          <div className="dx-head">
            <div
              className="conf-ring"
              style={{ background: `conic-gradient(var(--sage-deep) ${pct}%, rgba(168,188,161,.25) 0)` }}
              aria-label={`${t('guardian.conf')} ${pct}%`}
            >
              <span>{pct}%</span>
            </div>
            <div>
              <h2>{dx.name}</h2>
              <p className="muted">
                {result.name_en} · {t('guardian.source', { source: result.source })}
              </p>
            </div>
          </div>
          <ol className="steps">
            {dx.steps.map((s, i) => (
              <li key={`${i}-${s}`}>{s}</li>
            ))}
          </ol>
          <p className="chem-note">{dx.note}</p>
          <div className="row">
            <button type="button" disabled={busy || treated} onClick={logTreatment}>
              {treated ? t('guardian.logOk') : t('guardian.done')}
            </button>
            <button type="button" className="secondary" onClick={() => startCam(facing)}>
              {t('guardian.retake')}
            </button>
          </div>
        </section>
      )}

      {view === 'scan' && impact && (
        <section className="sync-grid" aria-label={t('guardian.synced')}>
          <p className="sync-kicker">{t('guardian.synced')}</p>
          <Link className="sync-card" to="/yield">
            <span>{t('guardian.yieldNow')}</span>
            <strong>
              {impact.yield.mid.toFixed(2)} {impact.yield.unit}
            </strong>
            <small>
              {impact.yield.low.toFixed(2)}–{impact.yield.high.toFixed(2)}
            </small>
          </Link>
          <Link className="sync-card" to="/market">
            <span>{t('guardian.marketNow')}</span>
            <strong>{impact.market.action === 'wait' ? t('market.wait') : t('market.sell')}</strong>
            <small>{tr(impact.market.reason_bn)}</small>
          </Link>
          <p className="muted sync-note">{t('guardian.eventSaved')}</p>
        </section>
      )}

      {false && <section className="panel">
        <h2>{t('guardian.history')}</h2>
        {!history.length && <p className="muted">{t('guardian.emptyHist')}</p>}
        <ul className="dx-timeline">
          {history.map((ev) => {
            const name = String(ev.payload.name_bn ?? ev.payload.disease_id ?? ev.type)
            return (
              <li key={ev.id}>
                <span className={`badge ${ev.type === 'treatment_logged' ? '' : 'warn'}`}>
                  {ev.type === 'treatment_logged' ? t('guardian.done') : t('nav.guardian')}
                </span>
                <span>{ev.type === 'treatment_logged' ? t('guardian.logOk') : tr(name, String(ev.payload.name_en ?? name))}</span>
              </li>
            )
          })}
        </ul>
      </section>}
    </div>
  )
}





