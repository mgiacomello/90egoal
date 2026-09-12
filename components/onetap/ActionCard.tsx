'use client'

// La schermata del risultato: una sola azione grande, tutto il resto in disparte.

import { useMemo, useState } from 'react'
import { ACTION_LABEL, humanDate } from '@/lib/onetap/detect'
import {
  actionHref,
  detectPlatform,
  googleCalendarHref,
  opensInNewTab,
  runAction,
  sendReply,
} from '@/lib/onetap/actions'
import type { Analysis, SuggestedAction } from '@/lib/onetap/types'
import { ActionIcon, CheckIcon } from './icons'

interface Props {
  analysis: Analysis
  /** Chiamato ogni volta che un'azione viene davvero eseguita. */
  onPerformed: (action: SuggestedAction) => void
  onRestart: () => void
}

const COPY = {
  it: {
    detected: 'Riconosciuto',
    think: 'Credo che tu voglia…',
    ask: 'Cosa vuoi fare?',
    also: 'Oppure',
    read: 'Mostra cosa ha letto ONE TAP',
    hide: 'Nascondi il testo',
    onDevice: 'Letto sul dispositivo',
    replies: 'Tocca una risposta',
    again: 'Nuova cattura',
    gcal: 'Apri in Google Calendar',
    ics: 'Scarica il file .ics',
    draft: 'Testo pronto',
    nothing: 'Non ho trovato niente su cui agire.',
    done: 'Fatto',
  },
  en: {
    detected: 'Detected',
    think: 'I think you want to…',
    ask: 'What would you like to do?',
    also: 'Or',
    read: 'Show what ONE TAP read',
    hide: 'Hide the text',
    onDevice: 'Read on your device',
    replies: 'Tap a reply',
    again: 'New capture',
    gcal: 'Open in Google Calendar',
    ics: 'Download the .ics file',
    draft: 'Ready to send',
    nothing: 'Nothing here to act on.',
    done: 'Done',
  },
} as const

export default function ActionCard({ analysis, onPerformed, onRestart }: Props) {
  const t = COPY[analysis.lang]
  const platform = useMemo(() => detectPlatform(), [])
  const [confirmation, setConfirmation] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showText, setShowText] = useState(false)
  const [chosen, setChosen] = useState<SuggestedAction | null>(null)

  const primary = chosen ?? analysis.primary
  const lowConfidence = analysis.confidence === 'low' && !chosen

  if (!primary) {
    return (
      <div className="ot-rise px-6 pt-16 text-center">
        <p className="text-[var(--ot-muted)]">{t.nothing}</p>
        <button onClick={onRestart} className="ot-chip mt-6">{t.again}</button>
      </div>
    )
  }

  async function perform(action: SuggestedAction) {
    if (busy) return
    setBusy(true)
    const result = await runAction(action, analysis.lang)
    setBusy(false)
    if (result.ok) {
      setConfirmation(result.message)
      onPerformed(action)
    } else {
      setConfirmation(result.message)
    }
  }

  async function pickReply(reply: string) {
    if (busy) return
    setBusy(true)
    const phone = analysis.entities.find((e) => e.kind === 'phone')?.value
    const result = await sendReply(reply, analysis.lang, phone)
    setBusy(false)
    setConfirmation(result.message)
    if (result.ok) onPerformed({ ...primary!, value: reply })
  }

  const href = actionHref(primary, platform, analysis.lang)

  /* ---------- conferma ---------- */
  if (confirmation) {
    return (
      <div className="ot-rise flex flex-col items-center px-6 pt-24 text-center">
        <div className="ot-pop grid h-20 w-20 place-items-center rounded-full bg-white text-[#08080a]">
          <CheckIcon className="h-9 w-9" />
        </div>
        <p className="ot-display mt-7 text-3xl font-bold">{t.done}</p>
        <p className="mt-2 text-[15px] text-[var(--ot-muted)]">{confirmation}</p>
        <button onClick={onRestart} className="ot-chip mt-10">{t.again}</button>
      </div>
    )
  }

  /* ---------- confidenza bassa: si chiede, non si inventa ---------- */
  if (lowConfidence) {
    const options = [primary, ...analysis.secondary].slice(0, 3)
    return (
      <div className="ot-rise px-6 pt-10">
        <Detected label={t.detected} value={primary.subject} title={analysis.title} />
        <p className="ot-display mt-10 text-[28px] font-bold leading-tight">{t.ask}</p>
        <div className="mt-6 space-y-3">
          {options.map((option) => (
            <OptionRow key={`${option.kind}-${option.value}`} action={option} onPick={setChosen} />
          ))}
        </div>
        <SourceText
          text={analysis.text}
          open={showText}
          onToggle={() => setShowText((v) => !v)}
          labels={t}
          onDevice={analysis.source === 'image' && !analysis.usedAI ? t.onDevice : null}
        />
      </div>
    )
  }

  /* ---------- REPLY: tre risposte pronte ---------- */
  if (primary.kind === 'REPLY' && primary.replies?.length) {
    return (
      <div className="ot-rise px-6 pt-10">
        <Detected label={t.detected} value={primary.subject} title={analysis.title} />
        {analysis.confidence === 'medium' && <Hint text={t.think} />}
        <h2 className="ot-display mt-8 flex items-center gap-3 text-[34px] font-extrabold leading-none">
          <ActionIcon kind="REPLY" className="h-7 w-7 text-[var(--ot-muted)]" />
          {ACTION_LABEL.REPLY}
        </h2>
        <p className="mt-3 text-[13px] uppercase tracking-[0.18em] text-[var(--ot-muted)]">{t.replies}</p>

        <div className="mt-5 space-y-3">
          {primary.replies.map((reply, i) => (
            <button
              key={i}
              onClick={() => pickReply(reply)}
              disabled={busy}
              className="ot-card ot-rise block w-full px-5 py-4 text-left text-[16px] leading-snug transition-colors active:bg-white/10 disabled:opacity-50"
              style={{ animationDelay: `${i * 70}ms` }}
            >
              {reply}
            </button>
          ))}
        </div>

        <Secondary actions={analysis.secondary} label={t.also} onPick={setChosen} />
        <SourceText
          text={analysis.text}
          open={showText}
          onToggle={() => setShowText((v) => !v)}
          labels={t}
          onDevice={analysis.source === 'image' && !analysis.usedAI ? t.onDevice : null}
        />
      </div>
    )
  }

  /* ---------- azione singola ---------- */
  return (
    <div className="ot-rise px-6 pt-10">
      <Detected label={t.detected} value={primary.subject} title={analysis.title} />
      {analysis.confidence === 'medium' && <Hint text={t.think} />}

      <h2 className="ot-display mt-8 flex items-center gap-3 text-[34px] font-extrabold leading-none">
        <ActionIcon kind={primary.kind} className="h-7 w-7 text-[var(--ot-muted)]" />
        {primary.label}
      </h2>

      <div className="mt-8">
        {href ? (
          <a
            href={href}
            target={opensInNewTab(primary.kind) ? '_blank' : undefined}
            rel={opensInNewTab(primary.kind) ? 'noopener noreferrer' : undefined}
            onClick={() => onPerformed(primary)}
            className="ot-tap"
          >
            ONE TAP
          </a>
        ) : (
          <button onClick={() => perform(primary)} disabled={busy} className="ot-tap disabled:opacity-60">
            ONE TAP
          </button>
        )}
      </div>

      <DraftPreview draft={primary.draft} label={t.draft} />

      {primary.kind === 'CALENDAR' && primary.event && (
        <div className="mt-4 text-center">
          <p className="text-[13px] text-[var(--ot-muted)]">
            {humanDate(primary.event, analysis.lang)}
            {primary.event.location ? ` · ${primary.event.location}` : ''}
          </p>
          {platform === 'ios' ? (
            <a
              href={googleCalendarHref(primary.event)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onPerformed(primary)}
              className="ot-ghost mt-2 inline-block text-[13px] underline underline-offset-4"
            >
              {t.gcal}
            </a>
          ) : (
            // Qui il bottone grande apre Google Calendar: il file resta per chi
            // usa Outlook, Apple Calendar su Mac o altro.
            <button
              onClick={() => perform(primary)}
              disabled={busy}
              className="ot-ghost mt-2 inline-block text-[13px] underline underline-offset-4 disabled:opacity-50"
            >
              {t.ics}
            </button>
          )}
        </div>
      )}

      <Secondary actions={analysis.secondary} label={t.also} onPick={setChosen} />
      <SourceText text={analysis.text} open={showText} onToggle={() => setShowText((v) => !v)} labels={t} />
    </div>
  )
}

/* ------------------------------------------------------------------ */

function Detected({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--ot-muted)]">
        {title ?? label}
      </p>
      <p className="ot-display mt-2 line-clamp-3 text-[22px] font-semibold leading-snug text-white/95">{value}</p>
    </div>
  )
}

/** Anteprima del testo che partirà: l'utente vede cosa sta per mandare, non lo scopre dopo. */
function DraftPreview({ draft, label }: { draft?: { subject?: string; body: string }; label: string }) {
  if (!draft) return null
  return (
    <div className="ot-card mt-4 px-5 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--ot-muted)]">{label}</p>
      {draft.subject && <p className="mt-2 text-[15px] font-semibold text-white/90">{draft.subject}</p>}
      <p className="mt-1.5 whitespace-pre-wrap text-[15px] leading-relaxed text-white/75">{draft.body}</p>
    </div>
  )
}

function Hint({ text }: { text: string }) {
  return <p className="mt-5 text-[15px] italic text-[var(--ot-muted)]">{text}</p>
}

function OptionRow({ action, onPick }: { action: SuggestedAction; onPick: (a: SuggestedAction) => void }) {
  return (
    <button
      onClick={() => onPick(action)}
      className="ot-card flex w-full items-center gap-4 px-5 py-4 text-left transition-colors active:bg-white/10"
    >
      <ActionIcon kind={action.kind} className="h-5 w-5 shrink-0 text-[var(--ot-muted)]" />
      <span className="ot-display text-[17px] font-bold tracking-tight">{action.label}</span>
      <span className="ml-auto truncate text-[13px] text-[var(--ot-muted)]">{action.subject}</span>
    </button>
  )
}

function Secondary({
  actions,
  label,
  onPick,
}: {
  actions: SuggestedAction[]
  label: string
  onPick: (a: SuggestedAction) => void
}) {
  if (!actions.length) return null
  return (
    <div className="mt-9">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--ot-muted)]">{label}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {actions.map((action) => (
          <button
            key={`${action.kind}-${action.value}`}
            onClick={() => onPick(action)}
            className="ot-chip"
          >
            <ActionIcon kind={action.kind} className="h-4 w-4" />
            {action.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function SourceText({
  text,
  open,
  onToggle,
  labels,
  onDevice,
}: {
  text: string
  open: boolean
  onToggle: () => void
  labels: { read: string; hide: string }
  /** Etichetta discreta quando la lettura è avvenuta in locale. */
  onDevice?: string | null
}) {
  return (
    <div className="mt-10 pb-16">
      <button onClick={onToggle} className="ot-ghost text-[13px] underline underline-offset-4">
        {open ? labels.hide : labels.read}
      </button>
      {onDevice && (
        <p className="mt-2 text-[12px] text-[var(--ot-muted)]">{onDevice}</p>
      )}
      {open && (
        <pre className="ot-card mt-3 max-h-56 overflow-auto whitespace-pre-wrap px-4 py-3 font-mono text-[12px] leading-relaxed text-white/70">
          {text}
        </pre>
      )}
    </div>
  )
}
