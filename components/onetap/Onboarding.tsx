'use client'

// Il momento magico.
//
// Niente registrazione, niente tour, niente permessi: si vede subito il
// prodotto funzionare su un esempio vero. Le due azioni sono reali — la mappa
// si apre davvero, l'evento si scarica davvero.

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { analyze, humanDate } from '@/lib/onetap/detect'
import { actionHref, detectPlatform, runAction } from '@/lib/onetap/actions'
import { MAGIC_MOMENT } from '@/lib/onetap/demo'
import type { SuggestedAction } from '@/lib/onetap/types'
import ScreenshotCard from './ScreenshotCard'
import { ActionIcon, CheckIcon } from './icons'

type Step = 'intro' | 'reading' | 'navigate' | 'calendar' | 'outro'

export default function Onboarding({ onFinish }: { onFinish: () => void }) {
  const [step, setStep] = useState<Step>('intro')
  const [done, setDone] = useState<string[]>([])
  const platform = useMemo(() => detectPlatform(), [])

  const analysis = useMemo(() => analyze(MAGIC_MOMENT.text, { source: 'demo', lang: 'en' }), [])
  const navigateAction = analysis.primary
  const calendarAction = useMemo(
    () => analysis.secondary.find((a) => a.kind === 'CALENDAR') ?? null,
    [analysis],
  )

  useEffect(() => {
    if (step !== 'reading') return
    const id = setTimeout(() => setStep('navigate'), 1400)
    return () => clearTimeout(id)
  }, [step])

  async function takeCalendar(action: SuggestedAction) {
    await runAction(action, 'en')
    setDone((d) => [...d, 'CALENDAR'])
    setStep('outro')
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[460px] flex-col px-6 pb-16 pt-14">
      <p className="ot-wordmark text-center text-[13px] text-white/70">One Tap</p>

      {step === 'intro' && (
        <div className="ot-rise mt-12">
          <h1 className="ot-display text-[38px] font-extrabold leading-[1.05]">
            Try ONE TAP.
          </h1>
          <p className="mt-3 text-[16px] leading-relaxed text-[var(--ot-muted)]">
            Here is a message you might get today. Watch what happens.
          </p>

          <ScreenshotCard
            className="mt-8"
            chrome="chat"
            from={MAGIC_MOMENT.from}
            lines={[...MAGIC_MOMENT.lines]}
          />

          <button onClick={() => setStep('reading')} className="ot-tap mt-8">
            One Tap
          </button>
        </div>
      )}

      {step === 'reading' && (
        <div className="ot-rise mt-12">
          <ScreenshotCard
            chrome="chat"
            from={MAGIC_MOMENT.from}
            lines={[...MAGIC_MOMENT.lines]}
            scanning
          />
          <div className="mt-8 space-y-2">
            {['Address', 'Date', 'Time'].map((label, i) => (
              <p
                key={label}
                className="ot-rise text-[13px] font-semibold uppercase tracking-[0.22em] text-white/80"
                style={{ animationDelay: `${250 + i * 300}ms` }}
              >
                <span className="mr-2 text-[var(--ot-violet)]">●</span>
                {label}
              </p>
            ))}
          </div>
        </div>
      )}

      {step === 'navigate' && navigateAction && (
        <div className="ot-rise mt-12">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--ot-muted)]">
            Detected
          </p>
          <p className="ot-display mt-2 text-[22px] font-semibold">{navigateAction.subject}</p>

          <h2 className="ot-display mt-8 flex items-center gap-3 text-[34px] font-extrabold leading-none">
            <ActionIcon kind="NAVIGATE" className="h-7 w-7 text-[var(--ot-muted)]" />
            NAVIGATE
          </h2>

          <a
            href={actionHref(navigateAction, platform, 'en') ?? '#'}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              setDone((d) => [...d, 'NAVIGATE'])
              setTimeout(() => setStep('calendar'), 350)
            }}
            className="ot-tap mt-8"
          >
            One Tap
          </a>

          <p className="mt-5 text-center text-[13px] text-[var(--ot-muted)]">
            Maps opens with the destination already set.
          </p>
        </div>
      )}

      {step === 'calendar' && calendarAction?.event && (
        <div className="ot-rise mt-12">
          {done.includes('NAVIGATE') && (
            <p className="mb-8 flex items-center gap-2 text-[13px] text-white/70">
              <CheckIcon className="h-4 w-4" /> Navigation sent.
            </p>
          )}
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--ot-muted)]">
            Same message, one more thing
          </p>
          <p className="ot-display mt-2 text-[22px] font-semibold">
            {calendarAction.event.title} — {humanDate(calendarAction.event, 'en')}
          </p>

          <h2 className="ot-display mt-8 flex items-center gap-3 text-[30px] font-extrabold leading-none">
            <ActionIcon kind="CALENDAR" className="h-7 w-7 text-[var(--ot-muted)]" />
            ADD TO CALENDAR
          </h2>

          <button onClick={() => takeCalendar(calendarAction)} className="ot-tap mt-8">
            One Tap
          </button>

          <button
            onClick={() => setStep('outro')}
            className="ot-ghost mt-5 w-full text-center text-[13px] underline underline-offset-4"
          >
            Skip
          </button>
        </div>
      )}

      {step === 'outro' && (
        <div className="ot-rise mt-16 flex flex-1 flex-col">
          <h2 className="ot-display text-[34px] font-extrabold leading-[1.08]">
            That was the whole app.
          </h2>
          <p className="mt-4 text-[16px] leading-relaxed text-[var(--ot-muted)]">
            Point it at anything — a number, an address, an invoice, a message.
            ONE TAP works out what to do and does it.
          </p>

          <div className="mt-auto pt-14">
            <button onClick={onFinish} className="ot-tap">
              Start
            </button>
            <p className="mt-5 text-center text-[13px] text-[var(--ot-muted)]">
              No account needed.{' '}
              <Link href="/auth/login" className="underline underline-offset-4 hover:text-white">
                Sign in
              </Link>{' '}
              only if you want to keep Pro across devices.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
