'use client'

// Pannelli secondari: privacy, Pro, "condividi a ONE TAP", demo.
// Tutto quello che non è l'azione principale vive qui dentro, fuori strada.

import { useEffect } from 'react'
import { DEMO_SCENARIOS, type DemoScenario } from '@/lib/onetap/demo'
import { FREE_ACTIONS_PER_MONTH } from '@/lib/onetap/storage'
import ScreenshotCard from './ScreenshotCard'
import { CloseIcon } from './icons'

export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-20 flex flex-col bg-[#08080a]/92 backdrop-blur-xl">
      <div className="ot-sheet mx-auto flex h-full w-full max-w-[460px] flex-col">
        <div className="flex items-center justify-between px-6 pt-6">
          <h2 className="ot-display text-[22px] font-bold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="ot-ghost p-2">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 pb-16 pt-5">{children}</div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */

export function PrivacySheet({
  onClose,
  onWipe,
  actionsUsed,
}: {
  onClose: () => void
  onWipe: () => void
  actionsUsed: number
}) {
  return (
    <Sheet title="Your data" onClose={onClose}>
      <ul className="space-y-5 text-[15px] leading-relaxed text-white/75">
        <li>
          <strong className="text-white">History stays on this device.</strong> Captures, actions and
          the monthly counter live in this browser’s local storage. There is no server copy and no
          endpoint that can read them back.
        </li>
        <li>
          <strong className="text-white">Images are not stored.</strong> A photo is resized in your
          browser, sent once for transcription, and dropped. It is never written to disk, to a
          database or to a log, and it is never made public.
        </li>
        <li>
          <strong className="text-white">QR codes never leave the device.</strong> When your browser
          can read them locally, nothing is sent at all.
        </li>
        <li>
          <strong className="text-white">No training.</strong> Your content is not used to train
          models.
        </li>
        <li>
          <strong className="text-white">Minimum retention.</strong> Only what is needed for the
          current action is kept, and only for as long as the action takes.
        </li>
      </ul>

      <p className="mt-8 text-[13px] text-[var(--ot-muted)]">
        {actionsUsed} action{actionsUsed === 1 ? '' : 's'} this month on this device.
      </p>

      <button
        onClick={() => {
          onWipe()
          onClose()
        }}
        className="ot-chip mt-4 border-red-400/30 text-red-300"
      >
        Delete everything
      </button>
    </Sheet>
  )
}

/* ------------------------------------------------------------------ */

export function ProSheet({ onClose, actionsUsed }: { onClose: () => void; actionsUsed: number }) {
  return (
    <Sheet title="ONE TAP Pro" onClose={onClose}>
      <p className="ot-display text-[30px] font-extrabold leading-tight">
        You’ve used {actionsUsed} of {FREE_ACTIONS_PER_MONTH} free actions this month.
      </p>
      <p className="mt-4 text-[15px] leading-relaxed text-[var(--ot-muted)]">
        Free gives you {FREE_ACTIONS_PER_MONTH} actions a month. Pro removes the limit for
        €4.99/month.
      </p>
      <div className="ot-card mt-8 px-5 py-5">
        <p className="text-[13px] uppercase tracking-[0.2em] text-[var(--ot-muted)]">Pro</p>
        <p className="ot-display mt-1 text-[28px] font-extrabold">€4.99 / month</p>
        <p className="mt-2 text-[14px] text-[var(--ot-muted)]">Unlimited actions. Everything else identical.</p>
      </div>
      <p className="mt-6 text-[13px] leading-relaxed text-[var(--ot-muted)]">
        Billing is not switched on in this MVP: nothing is charged and nothing is blocked. The
        counter is here to measure whether ONE TAP earns a place in your day.
      </p>
      <button onClick={onClose} className="ot-chip mt-8">Keep going</button>
    </Sheet>
  )
}

/* ------------------------------------------------------------------ */

export function ShareSheet({ onClose }: { onClose: () => void }) {
  return (
    <Sheet title="Share to ONE TAP" onClose={onClose}>
      <p className="text-[15px] leading-relaxed text-white/75">
        Install ONE TAP to your home screen and it shows up in the system share sheet. Then any
        screenshot becomes an action without opening the app.
      </p>

      <ol className="mt-7 space-y-5 text-[15px] leading-relaxed text-white/75">
        <li>
          <strong className="text-white">Android / Chrome.</strong> Menu → <em>Install app</em>.
          After that: screenshot → Share → ONE TAP.
        </li>
        <li>
          <strong className="text-white">iOS / Safari.</strong> Share → <em>Add to Home Screen</em>.
          Open a screenshot → Share → ONE TAP.
        </li>
        <li>
          <strong className="text-white">Desktop.</strong> Copy a screenshot and press
          <kbd className="mx-1 rounded border border-white/15 px-1.5 py-0.5 text-[12px]">⌘V</kbd>
          anywhere on the home screen.
        </li>
      </ol>

      <p className="mt-7 text-[13px] leading-relaxed text-[var(--ot-muted)]">
        Shared images are handed straight to the app on your device. They are not uploaded anywhere
        before you ask for an analysis.
      </p>
    </Sheet>
  )
}

/* ------------------------------------------------------------------ */

export function DemoSheet({
  onClose,
  onRun,
}: {
  onClose: () => void
  onRun: (scenario: DemoScenario) => void
}) {
  return (
    <Sheet title="Demo" onClose={onClose}>
      <p className="text-[15px] leading-relaxed text-[var(--ot-muted)]">
        Eight things you see every week. Tap one — the same engine runs on it.
      </p>
      <div className="mt-6 space-y-4">
        {DEMO_SCENARIOS.map((scenario) => (
          <button
            key={scenario.id}
            onClick={() => onRun(scenario)}
            className="block w-full text-left transition-transform active:scale-[0.985]"
          >
            <p className="mb-2 text-[13px] text-[var(--ot-muted)]">{scenario.caption}</p>
            <ScreenshotCard chrome={scenario.chrome} from={scenario.from} lines={scenario.lines} />
            <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">
              → {scenario.expect}
            </p>
          </button>
        ))}
      </div>
    </Sheet>
  )
}
