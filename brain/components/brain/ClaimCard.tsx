'use client'

import Correct from '@/components/brain/Correct'
import { CHANNEL_LABEL, type SourceKey } from '@/lib/brain/types'

/**
 * Un'affermazione con le sue fonti.
 *
 * Esisteva in tre copie — brief, risposte, incontri — e tre copie di
 * questo pezzo sono il modo più efficace di far divergere l'unica cosa
 * che in questo prodotto non deve divergere: **come si mostra da dove
 * viene una frase.** Se un giorno la fonte smettesse di comparire in
 * uno dei tre posti, la garanzia varrebbe due terzi.
 */

export type DisplaySource = {
  handle: string
  source: SourceKey
  title: string
  occurredAt: string
  url: string | null
}

export type DisplayClaim = {
  text: string
  trust?: 'verified' | 'unchecked-detail'
  unverified?: string[]
  sources: DisplaySource[]
}

function when(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function SourceChip({ handle, source, title, occurredAt, url }: DisplaySource) {
  // Fonte, data e canale: i tre pezzi che rendono una frase verificabile.
  const inner = (
    <>
      <b>{handle}</b>
      <span>
        {CHANNEL_LABEL[source]} · {when(occurredAt)}
      </span>
      {title ? <span className="brain-source-title">· {title}</span> : null}
    </>
  )
  return url ? (
    <a className="brain-source" href={url} target="_blank" rel="noreferrer">
      {inner}
    </a>
  ) : (
    <span className="brain-source">{inner}</span>
  )
}

export default function ClaimCard({ claim }: { claim: DisplayClaim }) {
  return (
    <article className="brain-claim" data-trust={claim.trust ?? 'verified'}>
      <p>{claim.text}</p>
      {claim.unverified?.length ? (
        <p className="brain-flag">
          ⚠ {claim.unverified.join(', ')} — non compare nelle fonti citate. Verificalo.
        </p>
      ) : null}
      <div className="brain-sources">
        {claim.sources.map((s) => (
          <SourceChip key={s.handle} {...s} />
        ))}
      </div>
      <Correct wrong={claim.text} about={claim.sources[0]?.title} />
    </article>
  )
}
