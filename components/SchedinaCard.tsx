import Link from 'next/link'
import { Schedina, Pronostico, Risultato, MatchDetail } from '@/lib/types'
import Flag from '@/components/Flag'
import { stadiumImage } from '@/lib/stadiums'
import Countdown from '@/components/Countdown'

interface Props {
  schedina: Schedina
  pronostico?: Pronostico
  risultato?: Risultato
  now: Date
}

export default function SchedinaCard({ schedina: s, pronostico, risultato, now }: Props) {
  const isKnockout = s.fase !== 'gironi'
  const deadline = new Date(s.deadline)
  const isScaduta = now > deadline
  const isCompilata = !!pronostico
  const giorni = Math.ceil((deadline.getTime() - now.getTime()) / 86400000)

  const dett = (risultato?.dettagli as MatchDetail[] | undefined) ?? []
  const dettMap = new Map(dett.map(d => [`${d.home}__${d.away}`, d]))
  const giocate = s.partite.filter(p => dettMap.has(`${p.home}__${p.away}`)).length

  return (
    <div className="glass glass-hover rounded-2xl overflow-hidden">
      {/* Banner stadio */}
      <div className="relative h-40 sm:h-44">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={stadiumImage(s.id)} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0d1117] via-[#0d1117]/60 to-[#0d1117]/10" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0d1117]/80 to-transparent" />

        <div className="absolute top-4 left-5 flex items-center gap-2">
          {isKnockout && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--gold)] bg-black/40 backdrop-blur border border-[var(--gold)]/40 px-2.5 py-1 rounded-full">
              ⚔️ Eliminazione
            </span>
          )}
          {isCompilata && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent-soft)] bg-black/40 backdrop-blur border border-[var(--accent)]/40 px-2.5 py-1 rounded-full">
              ✓ Compilata
            </span>
          )}
          {!isScaduta && !isCompilata && giorni <= 3 && (
            <span className="text-xs font-semibold text-[var(--gold)] bg-black/40 backdrop-blur border border-[var(--gold)]/40 px-2.5 py-1 rounded-full animate-pulse-glow">
              ⏳ {giorni === 1 ? 'Ultimo giorno' : `${giorni} giorni rimasti`}
            </span>
          )}
          {isScaduta && (
            <span className="text-xs font-semibold text-red-300 bg-black/40 backdrop-blur border border-red-500/40 px-2.5 py-1 rounded-full">
              Chiusa
            </span>
          )}
        </div>

        <div className="absolute bottom-0 inset-x-0 p-5">
          <h2 className="font-display font-bold text-2xl sm:text-3xl drop-shadow-lg leading-tight">{s.nome.replace(' — Mondiali FIFA 2026', '')}</h2>
        </div>
      </div>

      {/* Riga azione: scadenza + countdown + CTA (nel corpo, niente sovrapposizioni) */}
      <div className="px-5 sm:px-6 pt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <p className="text-sm">
            {isScaduta ? (
              <span className="text-red-300/90">Chiusa il {deadline.toLocaleDateString('it-IT', { day: '2-digit', month: 'long', timeZone: 'Europe/Rome' })}</span>
            ) : (
              <span className="text-white/70">Scadenza <span className="text-white font-medium">{deadline.toLocaleDateString('it-IT', { day: '2-digit', month: 'long', timeZone: 'Europe/Rome' })} · {deadline.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' })}</span></span>
            )}
          </p>
          {!isScaduta && !isCompilata && (
            <div className="mt-1.5"><Countdown deadline={s.deadline} /></div>
          )}
        </div>
        <div className="shrink-0">
          {isCompilata ? (
            <span className="inline-flex items-center gap-1.5 text-sm text-[var(--accent-soft)] bg-[var(--accent)]/10 border border-[var(--accent)]/40 px-4 py-2 rounded-lg">
              🔒 Inviato
            </span>
          ) : !isScaduta ? (
            <Link href={`/schedine/${s.id}`} className="btn-primary px-5 py-2.5 text-sm">
              Compila ora →
            </Link>
          ) : (
            <span className="text-white/60 text-sm">Non giocata</span>
          )}
        </div>
      </div>

      {/* Partite & risultati */}
      <div className="px-5 sm:px-6 pt-5 pb-5 sm:pb-6">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">Partite &amp; risultati</p>
          <span className="text-xs text-[var(--muted)]">
            <span className="text-[var(--accent-soft)] font-semibold">{giocate}</span>/{s.partite.length} giocate
          </span>
        </div>

        <div className="space-y-1.5">
          {s.partite.map((p, i) => {
            const d = dettMap.get(`${p.home}__${p.away}`)
            const giocata = !!d
            return (
              <div key={i} className={`rounded-xl border px-3 py-2.5 transition-colors ${giocata ? 'bg-[var(--accent)]/[0.07] border-[var(--accent)]/25' : 'bg-white/[0.02] border-white/8'}`}>
                <div className="flex items-center gap-2 text-sm">
                  <span className={`text-[10px] font-bold w-9 shrink-0 ${giocata ? 'text-[var(--accent-soft)]' : 'text-[var(--muted)]'}`}>
                    {giocata ? 'FT' : new Date(p.date + 'T12:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}
                  </span>
                  <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end text-right">
                    <span className={`truncate ${giocata ? 'font-semibold text-white' : 'text-white/80'}`}>{p.home}</span>
                    <Flag team={p.home} w={40} className="w-5 h-3.5 shrink-0" />
                  </div>
                  {giocata ? (
                    <span className="font-display font-extrabold text-base px-2 tabular-nums text-white">{d!.score}</span>
                  ) : (
                    <span className="text-white/25 text-xs px-2.5">vs</span>
                  )}
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <Flag team={p.away} w={40} className="w-5 h-3.5 shrink-0" />
                    <span className={`truncate ${giocata ? 'font-semibold text-white' : 'text-white/80'}`}>{p.away}</span>
                  </div>
                </div>
                {giocata && d!.minuti.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1 mt-2 pl-11">
                    <span className="text-[11px] mr-0.5">⚽</span>
                    {d!.minuti.map((m, j) => (
                      <span key={j} className="text-[11px] font-mono bg-white/8 text-white/80 px-1.5 py-0.5 rounded">{m}</span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Esito supplementari (eliminazione) */}
        {isKnockout && risultato?.extra_time != null && (
          <p className="text-xs text-[var(--muted)] mt-3">
            ⏱️ Supplementari: <span className="text-white font-medium">{risultato.extra_time ? 'Sì, almeno una partita' : 'No, decise nei 90′'}</span>
          </p>
        )}
      </div>

      {/* Il tuo pronostico (sola lettura) */}
      {pronostico && (
        <div className="mx-6 mb-6 pt-4 border-t border-white/8 space-y-3">
          <p className="text-xs text-[var(--accent)] uppercase tracking-wider font-semibold">
            Il tuo pronostico {risultato ? '· minuti azzeccati in verde' : '· definitivo 🔒'}
          </p>

          <div className="flex flex-wrap gap-1.5">
            {pronostico.minuti.map((m: number) => {
              const miss = !!risultato && !risultato.minuti_gol.includes(m)
              return (
                <span key={m} className={`tag-static ${miss ? 'is-miss' : ''} px-2.5 py-1 text-xs`}>
                  {m}&apos;
                </span>
              )
            })}
          </div>

          {(pronostico.recupero || pronostico.first_goal || pronostico.last_goal || pronostico.extra_time != null) && (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
              {pronostico.extra_time != null && (
                <span className="text-[var(--muted)]">
                  ⏱️ Supplementari: <span className="text-white font-medium">{pronostico.extra_time ? 'Sì' : 'No'}</span>
                  {risultato?.extra_time != null && (
                    <span className={pronostico.extra_time === risultato.extra_time ? 'text-[var(--accent-soft)]' : 'text-red-300/80'}>
                      {' '}{pronostico.extra_time === risultato.extra_time ? '✓ +5' : '✗'}
                    </span>
                  )}
                </span>
              )}
              {pronostico.recupero && (
                <span className="text-[var(--muted)]">
                  ➕ Recupero: <span className="text-white font-medium">{pronostico.recupero === 'primo' ? '1° tempo' : '2° tempo'}</span>
                </span>
              )}
              {pronostico.first_goal && (
                <span className="flex items-center gap-1.5 text-[var(--muted)]">
                  🥇 Prima: <Flag team={pronostico.first_goal} w={40} className="w-5 h-3.5" />
                  <span className="text-white font-medium">{pronostico.first_goal}</span>
                </span>
              )}
              {pronostico.last_goal && (
                <span className="flex items-center gap-1.5 text-[var(--muted)]">
                  🏁 Ultima: <Flag team={pronostico.last_goal} w={40} className="w-5 h-3.5" />
                  <span className="text-white font-medium">{pronostico.last_goal}</span>
                </span>
              )}
            </div>
          )}

          {risultato && (
            <p className="text-xs text-[var(--muted)]">
              Minuti dei gol reali: <span className="text-white/80 font-mono">{[...risultato.minuti_gol].sort((a, b) => a - b).map(m => `${m}'`).join(', ') || '—'}</span>
            </p>
          )}
        </div>
      )}
    </div>
  )
}
