'use client'

import { useApp } from '@/lib/app'
import type { LandIssue } from '@/lib/landGeo'
import { StepBar } from './ui'
import type { LandDraft } from './useLandDraft'

type Props = {
  draft: LandDraft
  step: { steps: string[]; at: number } | null
  title: string
  hideHint: boolean
  busy: boolean
  cancelLabel: string
  doneLabel: string
  canFinish: boolean
  onDone: () => void
  onCancel: () => void
  onFit: () => void
}

export function LandDrawHud({ draft, step, title, hideHint, busy, cancelLabel, doneLabel, canFinish, onDone, onCancel, onFit }: Props) {
  const { t, num } = useApp()
  const { points, closed, selected, area, length, issue, overlapping, walk } = draft
  const n = points.length

  const issueText: Record<NonNullable<LandIssue>, string> = {
    crossing: t('সীমানার রেখা একে অপরকে কেটেছে। লাল অংশের কোনা সরান', 'The boundary crosses itself. Move a corner on the red part'),
    small: t('জমিটি খুব ছোট। সঠিকভাবে আঁকুন', 'This land is too small. Please draw it again'),
    large: t('জমিটি অস্বাভাবিক বড়। আবার দেখুন', 'This land looks too big. Please check it'),
    outside: t('সীমানা বাংলাদেশের বাইরে চলে গেছে', 'The boundary goes outside Bangladesh'),
    many: t('কোনা অনেক বেশি (সর্বোচ্চ ২০০টি)', 'Too many corners (200 at most)'),
  }

  const hint = walk
    ? t(`সীমানা ধরে হাঁটুন · ${num(n)}টি বিন্দু · নির্ভুলতা ±${num(walk.acc)} মি`, `Walk along the boundary · ${n} points · accuracy ±${walk.acc} m`)
    : issue ? issueText[issue]
      : selected !== null ? t('কোনাটি টেনে সরান, অথবা নিচে থেকে মুছুন', 'Drag this corner to move it, or delete it below')
        : closed ? t('কোনা টেনে ঠিক করুন · ছোট বিন্দু টেনে নতুন কোনা যোগ করুন', 'Drag corners to adjust · drag a small dot to add a corner')
          : n >= 3 ? t('আরও কোনা দিন, অথবা প্রথম কোনায় ট্যাপ করে শেষ করুন', 'Add more corners, or tap the first corner to finish')
            : n ? t(`আরও কোনায় ট্যাপ করুন (কমপক্ষে ৩টি) · ${num(n)} দেওয়া হয়েছে`, `Keep tapping corners (at least 3) · ${n} placed`)
              : t('জমিটি খুঁজে বের করুন (গ্রাম খুঁজুন বা 📍), তারপর প্রতিটি কোনায় ট্যাপ করুন, অথবা 🚶 সীমানা ধরে হাঁটুন', 'Find the land (search the village or press 📍), then tap each corner, or press 🚶 to walk the boundary')

  return (
    <>
      {!hideHint && (
        <div className={`draw-hint steps glass${issue ? ' bad' : ''}`} style={{ top: 'calc(env(safe-area-inset-top) + 68px)' }} aria-live="polite">
          {step
            ? <StepBar steps={step.steps} step={step.at} title={title} hint={hint} />
            : <div className="small">{hint}</div>}
        </div>
      )}

      {!walk && (
        <div className="draw-tools">
          {n >= 3 && <button className="round glass" aria-label={t('পুরো জমি দেখুন', 'Show the whole land')} title={t('পুরো জমি দেখুন', 'Show the whole land')} onClick={onFit}>⤢</button>}
          {!n && <button className="round glass" aria-label={t('সীমানা ধরে হেঁটে আঁকুন', 'Walk the boundary')} title={t('সীমানা ধরে হেঁটে আঁকুন', 'Walk the boundary')} onClick={draft.startWalk}>🚶</button>}
          {!closed && <button className="round glass" disabled={draft.gpsBusy} aria-label={t('এখানে কোনা দিন (জিপিএস)', 'Mark a corner here (GPS)')} title={t('এখানে কোনা দিন (জিপিএস)', 'Mark a corner here (GPS)')} onClick={draft.markHere}>{draft.gpsBusy ? '…' : '🎯'}</button>}
          {n > 0 && <button className="round glass" aria-label={t('সব মুছে নতুন করে আঁকুন', 'Clear and start over')} title={t('সব মুছে নতুন করে আঁকুন', 'Clear and start over')} onClick={draft.clear}>🧹</button>}
        </div>
      )}

      <div className="hud-bottom" style={{ bottom: 'calc(env(safe-area-inset-bottom) + 96px)', padding: '0 12px' }}>
        <div className="glass draw-panel">
          {n >= 3 && (
            <div className="draw-stats">
              <span><b>{num(Math.round(area * 100) / 100)}</b> {t('একর', 'acres')}</span>
              <span><b>{num(Math.round(area * 100))}</b> {t('শতক', 'decimals')}</span>
              <span><b>{draft.distance(length)}</b> {t('সীমানা', 'around')}</span>
            </div>
          )}
          {overlapping.length > 0 && !issue && (
            <div className="draw-warn small">⚠️ {t(`"${overlapping[0].name}" জমির ওপর পড়েছে`, `Overlaps "${overlapping[0].name}"`)}</div>
          )}
          {selected !== null && !walk && (
            <button className="btn danger small block" style={{ minHeight: 42 }} onClick={() => draft.removeAt(selected)}>🗑️ {t('এই কোনাটি মুছুন', 'Delete this corner')}</button>
          )}
          {walk
            ? (
              <button className="btn block" style={{ minHeight: 46 }} onClick={draft.stopWalk}>⏹ {t('হাঁটা শেষ', 'Finish walking')}</button>
            ) : (
              <div className="row">
                <button className="btn soft small grow" style={{ minHeight: 46 }} onClick={onCancel}>{cancelLabel}</button>
                <button className="btn soft small" style={{ minHeight: 46 }} disabled={!draft.canUndo} aria-label={t('আগের অবস্থায় ফিরুন', 'Undo')} title={t('আগের অবস্থায় ফিরুন', 'Undo')} onClick={draft.undo}>↩︎</button>
                <button className="btn soft small" style={{ minHeight: 46 }} disabled={!draft.canRedo} aria-label={t('আবার করুন', 'Redo')} title={t('আবার করুন', 'Redo')} onClick={draft.redo}>↪︎</button>
                <button className="btn small grow" style={{ minHeight: 46 }} disabled={busy || !canFinish} onClick={onDone}>{busy ? '…' : doneLabel}</button>
              </div>
            )}
        </div>
      </div>
    </>
  )
}
