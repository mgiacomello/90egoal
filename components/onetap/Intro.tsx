'use client'

// La schermata d'ingresso: una sola, un solo tap per entrare.
//
// Serve a dire chi è l'app e che non chiede niente — non a insegnare a usarla.
// Chi vuole vedere il concetto in azione trova il momento magico qui sotto,
// ma non ci passa in mezzo per forza.

import Logo from './Logo'
import { ActionIcon } from './icons'
import type { ActionKind } from '@/lib/onetap/types'

const SHOWCASE: Array<{ kind: ActionKind; from: string }> = [
  { kind: 'CALL', from: 'un numero' },
  { kind: 'NAVIGATE', from: 'un indirizzo' },
  { kind: 'COPY', from: 'un IBAN' },
  { kind: 'CALENDAR', from: 'una data' },
  { kind: 'REPLY', from: 'un messaggio' },
]

export default function Intro({ onEnter, onDemo }: { onEnter: () => void; onDemo: () => void }) {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-[460px] flex-col px-6 pb-12 pt-16">
      <div className="ot-rise flex flex-col items-center">
        <Logo size={76} />
      </div>

      <h1 className="ot-rise ot-display mt-12 text-center text-[36px] font-extrabold leading-[1.08]" style={{ animationDelay: '90ms' }}>
        Lo vedi.
        <br />
        Tocchi una volta.
        <br />
        <span className="text-white/45">È fatta.</span>
      </h1>

      <p className="ot-rise mt-5 text-center text-[16px] leading-relaxed text-[var(--ot-muted)]" style={{ animationDelay: '160ms' }}>
        Fotografa, incolla o condividi qualsiasi cosa. ONE TAP capisce cosa si può farci
        e ti mette davanti una sola azione.
      </p>

      <ul className="ot-rise mt-9 space-y-2.5" style={{ animationDelay: '230ms' }}>
        {SHOWCASE.map((item) => (
          <li key={item.kind} className="flex items-center gap-3 text-[15px]">
            <ActionIcon kind={item.kind} className="h-[18px] w-[18px] shrink-0 text-[var(--ot-muted)]" />
            <span className="text-[var(--ot-muted)]">{item.from}</span>
            <span className="ml-auto ot-display text-[14px] font-bold tracking-tight text-white/90">
              {item.kind === 'CALENDAR' ? 'IN CALENDARIO' : item.kind}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-12">
        <button onClick={onEnter} className="ot-tap ot-rise" style={{ animationDelay: '300ms' }}>
          Inizia
        </button>

        <p className="mt-5 text-center text-[13px] leading-relaxed text-[var(--ot-muted)]">
          Nessun account, nessuna registrazione.
          <br />
          La cronologia resta su questo dispositivo.
        </p>

        <button
          onClick={onDemo}
          className="ot-ghost mt-6 block w-full text-center text-[13px] underline underline-offset-4"
        >
          Prima guarda come funziona
        </button>
      </div>
    </div>
  )
}
