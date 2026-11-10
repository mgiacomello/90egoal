import type { Metadata } from 'next'

export const metadata: Metadata = { title: '90 & Goal · accesso riservato', robots: { index: false, follow: false } }

// Il cancello della pagina investitori: una password sola, data a mano a chi la deve vedere.
export default async function AccessoInvestitori({ searchParams }: { searchParams: Promise<{ errore?: string }> }) {
  const { errore } = await searchParams
  return (
    <main className="min-h-dvh flex items-center justify-center px-4 py-10">
      <form method="post" action="/api/investitori/accesso" className="w-full max-w-sm bg-[var(--surface)] rounded-[28px] p-7 shadow-[0_30px_80px_-30px_rgba(11,31,77,0.45)] space-y-5">
        <div className="flex items-center gap-3 font-display font-bold text-xl">
          <span className="w-10 h-10 rounded-xl bg-[var(--accent)] text-white grid place-items-center text-base">90</span>
          <span><span className="text-[var(--accent)]">&amp;</span> Goal</span>
        </div>
        <div>
          <h1 className="font-display font-semibold text-2xl leading-tight">Pagina riservata</h1>
          <p className="text-sm text-[var(--muted)] mt-1">Inserisci la password che hai ricevuto per vedere la presentazione e la demo.</p>
          <p className="text-sm text-[var(--muted)] mt-1" lang="en">Enter the password you were given to view the presentation and the demo.</p>
        </div>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Password</span>
          <input id="password" name="password" type="password" autoComplete="current-password" autoFocus required
            className="mt-1.5 w-full rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--ink)] caret-[var(--accent)] outline-none focus:ring-2 focus:ring-[var(--accent)]" style={{ color: "var(--ink)", WebkitTextFillColor: "var(--ink)" }} />
        </label>
        {errore && <p className="text-sm font-semibold text-[var(--danger)]">Password non corretta. Riprova. · Wrong password, try again.</p>}
        <button type="submit" className="btn-primary w-full py-3">Entra · Enter</button>
      </form>
    </main>
  )
}
