// Pagine legali di ONE TAP: stesso vestito dell'app, testo leggibile, niente
// altro. Sono server component: nessun JavaScript per leggere un'informativa.

import Link from 'next/link'
import type { ReactNode } from 'react'
import { CloseIcon } from './icons'

export function LegalPage({
  title,
  updated,
  intro,
  children,
}: {
  title: string
  updated: string
  intro: ReactNode
  children: ReactNode
}) {
  return (
    <div className="ot">
      <div className="relative mx-auto w-full max-w-[560px] px-6 pb-24">
        <header className="flex items-center justify-between pt-6">
          <Link href="/onetap" aria-label="Torna all'app" className="ot-ghost -ml-2 p-2">
            <CloseIcon className="h-5 w-5" />
          </Link>
          <span className="ot-wordmark text-[13px] text-white/40">One Tap</span>
          <span className="w-9" />
        </header>

        <article className="ot-rise pt-12">
          <h1 className="ot-display text-[34px] font-extrabold leading-[1.06]">{title}</h1>
          <p className="mt-3 text-[13px] uppercase tracking-[0.18em] text-[var(--ot-muted)]">
            Aggiornata il {updated}
          </p>
          <div className="mt-6 text-[16px] leading-relaxed text-white/80">{intro}</div>
          <div className="mt-10 space-y-10">{children}</div>
        </article>

        <footer className="mt-16 flex gap-5 text-[12px] text-white/30">
          <Link href="/onetap/privacy" className="ot-ghost underline underline-offset-4">Privacy</Link>
          <Link href="/onetap/terms" className="ot-ghost underline underline-offset-4">Termini</Link>
          <Link href="/onetap/install" className="ot-ghost underline underline-offset-4">Installa</Link>
        </footer>
      </div>
    </div>
  )
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="ot-display text-[20px] font-bold tracking-tight">{title}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-white/70 [&_strong]:text-white [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
        {children}
      </div>
    </section>
  )
}
