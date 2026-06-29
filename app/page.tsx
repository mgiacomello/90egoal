import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Schedina, Partita } from '@/lib/types'
import Flag from '@/components/Flag'
import AskAI from '@/components/AskAI'

const STADIUM = 'https://images.unsplash.com/photo-1762013315117-1c8005ad2b41?w=1920&q=70&auto=format&fit=crop'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: schedine } = await supabase.from('schedine').select('*').order('id')

  // Solo le schedine attive (fase corrente): la home mostra solo queste partite
  const attive = (schedine as Schedina[] | null)?.filter(s => s.attiva !== false) ?? []
  const partite: Partita[] = attive.flatMap(s => s.partite)
  const squadre = [...new Set(partite.flatMap(p => [p.home, p.away]))]

  return (
    <div className="flex flex-col gap-20 sm:gap-28">

      {/* ===== HERO immersivo ===== */}
      <section className="relative -mx-4 sm:-mx-6 -mt-8">
        {/* sfondo stadio */}
        <div className="absolute inset-0 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={STADIUM} alt="" className="w-full h-full object-cover object-center scale-105" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#07090d]/70 via-[#07090d]/85 to-[#07090d]" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#07090d] via-transparent to-[#07090d] opacity-60" />
          <div className="absolute inset-0" style={{ background: 'radial-gradient(600px 400px at 50% 20%, rgba(0,230,118,0.18), transparent 70%)' }} />
        </div>

        {/* contenuto hero */}
        <div className="relative px-4 sm:px-6 pt-16 pb-14 sm:pt-24 sm:pb-20 text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass text-xs font-medium text-white/80 mb-6 animate-fade-up">
            <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse-glow" />
            🏆 Fase a eliminazione diretta · Mondiali 2026
          </div>

          <h1 className="font-display font-extrabold text-5xl sm:text-7xl tracking-tight leading-[1.02] animate-fade-up drop-shadow-2xl">
            Indovina il <span className="text-gradient">minuto</span>
            <br />del <span className="text-gradient-gold">gol</span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-white/70 max-w-xl mx-auto animate-fade-up">
            La fase a gironi è andata: ora si fa sul serio coi <strong className="text-white">sedicesimi</strong>, dentro o fuori.
            Scegli 13 minuti, prevedi i supplementari e scala la classifica di <strong className="text-white">90 &amp; Goal</strong>.
          </p>

          <div className="mt-9 flex flex-col sm:flex-row gap-3 justify-center animate-fade-up">
            {user ? (
              <>
                <Link href="/schedine" className="btn-primary px-8 py-3.5 text-base">Vai alle Schedine →</Link>
                <Link href="/classifica" className="btn-ghost px-8 py-3.5 text-base">Classifica</Link>
              </>
            ) : (
              <>
                <Link href="/auth/register" className="btn-primary px-8 py-3.5 text-base">Gioca gratis →</Link>
                <Link href="/auth/login" className="btn-ghost px-8 py-3.5 text-base">Ho già un account</Link>
              </>
            )}
          </div>
        </div>

        {/* marquee bandiere */}
        {squadre.length > 0 && (
          <div className="relative overflow-hidden py-4 border-y border-white/8 bg-white/[0.02] backdrop-blur-sm">
            <div className="flex gap-8 w-max animate-marquee">
              {[...squadre, ...squadre].map((t, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-white/55 whitespace-nowrap">
                  <Flag team={t} w={40} className="w-6 h-4" />
                  <span className="font-medium">{t}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ===== STAT STRIP ===== */}
      <section className="-mt-4">
        <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto stagger">
          {[
            { n: '13', l: 'minuti da indovinare' },
            { n: '16', l: 'sfide ai sedicesimi' },
            { n: '+5', l: 'bonus supplementari' },
          ].map((s) => (
            <div key={s.l} className="glass glass-hover rounded-2xl py-6 px-2 text-center">
              <div className="font-display font-extrabold text-4xl sm:text-5xl text-gradient">{s.n}</div>
              <div className="text-xs text-[var(--muted)] mt-1.5">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ===== COME FUNZIONA ===== */}
      <section>
        <div className="text-center mb-12">
          <span className="text-xs font-semibold tracking-widest text-[var(--accent)] uppercase">Come si gioca</span>
          <h2 className="font-display font-bold text-3xl sm:text-4xl mt-2">Tre mosse per vincere</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 stagger">
          {[
            { icon: '🕐', step: '01', title: 'Scegli 13 minuti', desc: 'Indica i minuti (1–90) in cui prevedi un gol in una qualunque delle partite della schedina.', tint: 'from-[var(--accent)]/25', glow: 'rgba(0,230,118,0.25)' },
            { icon: '⏱️', step: '02', title: 'Prevedi i supplementari', desc: 'Nell’eliminazione diretta le sfide possono andare ai tempi supplementari: indovina se succederà e prendi +5 punti.', tint: 'from-[var(--accent-cyan)]/25', glow: 'rgba(34,211,238,0.25)' },
            { icon: '🏆', step: '03', title: 'Dentro o fuori', desc: 'Niente più gironi: ogni partita è decisiva. Segui la classifica live a ogni turno e arriva fino alla finale.', tint: 'from-[var(--gold)]/25', glow: 'rgba(255,210,74,0.22)' },
          ].map((c) => (
            <div key={c.step} className="group relative glass glass-hover rounded-2xl p-6 text-left overflow-hidden">
              {/* glow d'angolo */}
              <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ background: c.glow }} />
              {/* top accent line */}
              <div className={`absolute top-0 left-0 right-0 h-px bg-gradient-to-r ${c.tint} to-transparent`} />
              <div className="relative flex items-center justify-between mb-5">
                <span className={`grid place-items-center w-14 h-14 rounded-2xl bg-gradient-to-br ${c.tint} to-white/[0.02] border border-white/10 text-2xl group-hover:scale-110 transition-transform duration-300`}>{c.icon}</span>
                <span className="font-display font-extrabold text-4xl text-white/[0.07] group-hover:text-white/[0.12] transition-colors">{c.step}</span>
              </div>
              <h3 className="relative font-display font-bold text-lg mb-2">{c.title}</h3>
              <p className="relative text-sm text-[var(--muted)] leading-relaxed">{c.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== ESEMPIO PARTITE (con bandiere) ===== */}
      {partite.length > 0 && (
        <section>
          <div className="flex items-end justify-between mb-6">
            <div>
              <span className="text-xs font-semibold tracking-widest text-[var(--accent)] uppercase">Le partite</span>
              <h2 className="font-display font-bold text-3xl sm:text-4xl mt-2">Big match ad alto numero di gol</h2>
            </div>
            {user && <Link href="/schedine" className="btn-ghost px-5 py-2.5 text-sm hidden sm:inline-flex">Tutte →</Link>}
          </div>

          <div className="grid sm:grid-cols-2 gap-3 stagger">
            {partite.slice(0, 6).map((p, i) => (
              <div key={i} className="group glass glass-hover rounded-xl p-4 flex items-center gap-4">
                <span className="text-[10px] font-mono text-[var(--muted)] w-12 shrink-0 uppercase">
                  {new Date(p.date + 'T12:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}
                </span>
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  <Flag team={p.home} w={40} className="w-7 h-5 shrink-0" />
                  <span className="font-semibold text-sm truncate">{p.home}</span>
                </div>
                <span className="font-display font-bold text-xs text-white/30 px-2">VS</span>
                <div className="flex items-center gap-2.5 flex-1 min-w-0 justify-end">
                  <span className="font-semibold text-sm truncate text-right">{p.away}</span>
                  <Flag team={p.away} w={40} className="w-7 h-5 shrink-0" />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ===== PUNTEGGIO ===== */}
      <section className="relative">
        <div className="glass rounded-3xl p-8 sm:p-10 overflow-hidden">
          <div className="absolute -top-24 -right-24 w-72 h-72 bg-[var(--accent)]/12 blur-3xl rounded-full pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-[var(--accent-cyan)]/10 blur-3xl rounded-full pointer-events-none" />
          <div className="relative grid md:grid-cols-2 gap-8 items-center">
            <div>
              <span className="text-xs font-semibold tracking-widest text-[var(--accent)] uppercase">Il sistema di punti</span>
              <h2 className="font-display font-bold text-3xl sm:text-4xl mt-2 mb-4">Ogni gol vale punti</h2>
              <p className="text-[var(--muted)]">Più minuti azzecchi, più sali in classifica. Nella fase a eliminazione diretta il bonus sui supplementari può ribaltare tutto fino all’ultimo turno.</p>
            </div>
            <div className="space-y-3">
              {[
                { p: '+1', t: 'per ogni minuto esatto in cui viene segnato un gol', c: 'text-[var(--accent)]' },
                { p: '+5', t: 'se indovini se la sfida andrà ai tempi supplementari', c: 'text-[var(--accent-cyan)]' },
                { p: 'KO', t: 'eliminazione diretta: ogni partita è dentro o fuori', c: 'text-[var(--gold)]' },
              ].map((r, i) => (
                <div key={i} className="flex items-center gap-4 rounded-xl bg-white/[0.03] border border-white/8 px-4 py-3 hover:border-white/15 transition-colors">
                  <span className={`font-display font-extrabold text-2xl w-12 ${r.c}`}>{r.p}</span>
                  <span className="text-sm text-white/80">{r.t}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== AI MODE (solo utenti loggati) ===== */}
      {user && <AskAI />}

      {/* ===== CTA FINALE ===== */}
      {!user && (
        <section className="relative text-center pb-8 rounded-3xl overflow-hidden">
          <div className="absolute inset-0 -z-10" style={{ background: 'radial-gradient(500px 300px at 50% 100%, rgba(0,230,118,0.15), transparent 70%)' }} />
          <h2 className="font-display font-bold text-3xl sm:text-5xl mb-3">Pronto a scendere in campo?</h2>
          <p className="text-[var(--muted)] mb-8 text-lg">Registrati in 30 secondi e compila la tua prima schedina.</p>
          <Link href="/auth/register" className="btn-primary px-10 py-4 text-base">Crea il tuo account →</Link>
        </section>
      )}
    </div>
  )
}
