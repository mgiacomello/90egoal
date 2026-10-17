import Link from 'next/link'
import { Schedina, Pronostico, Risultato, MatchDetail } from '@/lib/types'
import Flag from '@/components/Flag'
import Countdown from '@/components/Countdown'
import { nomeBreve } from '@/lib/teams'

interface Props {
  schedina: Schedina
  pronostico?: Pronostico
  risultato?: Risultato
  now: Date
  punti?: number   // punti del giocatore su questa schedina (dalla classifica), anche durante il live
}

// Una schedina in una scheda: stato in alto, azione a destra, partite sotto.
// Niente foto: su telefono pesano e non dicono niente.
export default function SchedinaCard({ schedina: s, pronostico, risultato, now, punti }: Props) {
  const deadline = new Date(s.deadline)
  const isScaduta = now > deadline
  const isCompilata = !!pronostico

  const dett = (risultato?.dettagli as MatchDetail[] | undefined) ?? []
  const dettMap = new Map(dett.map(d => [`${d.home}__${d.away}`, d]))
  const statoDi = (d?: MatchDetail) => (d ? d.stato ?? 'finita' : 'da_giocare')
  const giocate = s.partite.filter(p => statoDi(dettMap.get(`${p.home}__${p.away}`)) === 'finita').length
  const live = s.partite.filter(p => statoDi(dettMap.get(`${p.home}__${p.away}`)) === 'in_corso').length
  const conclusa = giocate === s.partite.length

  const stato = live > 0 ? 'live' : conclusa && risultato ? 'finita' : isScaduta ? 'chiusa' : isCompilata ? 'giocata' : 'aperta'
  const quando = deadline.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Rome' }) + ' · ' + deadline.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' })

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="px-4 pt-4 pb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {stato === 'live' && <span className="inline-flex items-center gap-1 text-[10px] font-bold text-white bg-red-500/80 px-2 py-0.5 rounded-full"><span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse-glow" />LIVE</span>}
            {stato === 'giocata' && <span className="text-[10px] font-semibold text-[var(--accent)] border border-[var(--accent)]/40 px-2 py-0.5 rounded-full">giocata</span>}
            {stato === 'finita' && <span className="text-[10px] font-semibold text-[var(--muted)] border border-white/15 px-2 py-0.5 rounded-full">finita</span>}
            {stato === 'chiusa' && <span className="text-[10px] font-semibold text-[var(--muted)] border border-white/15 px-2 py-0.5 rounded-full">chiusa</span>}
            <span className="text-[11px] text-[var(--muted)]">{quando}</span>
          </div>
          <h2 className="font-display font-bold text-lg leading-tight truncate">{nomeBreve(s.nome)}</h2>
          {stato === 'aperta' && <div className="mt-1"><Countdown deadline={s.deadline} /></div>}
        </div>
        <div className="shrink-0">
          {stato === 'aperta' ? (
            <Link href={`/schedine/${s.id}`} className="btn-primary px-4 py-2.5 text-sm">Gioca →</Link>
          ) : isCompilata && punti != null ? (
            <div className="text-right">
              <div className="font-display font-extrabold text-2xl text-[var(--accent-soft)] tabular-nums leading-none">{punti}<span className="text-xs font-normal text-[var(--muted)] ml-0.5">pt</span></div>
              <div className="text-[10px] text-[var(--muted)] mt-0.5">{conclusa ? 'finali' : 'finora'}</div>
            </div>
          ) : isCompilata ? (
            <span className="text-xs text-[var(--muted)]">in attesa</span>
          ) : (
            <span className="text-xs text-[var(--muted)]">non giocata</span>
          )}
        </div>
      </div>

      {/* I miei minuti */}
      {pronostico && (
        <div className="px-4 pb-3 flex flex-wrap gap-1">
          {pronostico.minuti.map(m => {
            const hit = !!risultato && risultato.minuti_gol.includes(m)
            const doppio = hit && (m === risultato?.minuto_primo_gol || m === risultato?.minuto_ultimo_gol)
            const miss = !!risultato && !hit && conclusa
            return (
              <span key={m} className={`tag-static ${miss ? 'is-miss' : risultato && !hit ? 'is-pending' : ''} px-2 py-0.5 text-[11px]`}>
                {m}&apos;{doppio && <span className="text-[var(--gold)] ml-0.5">×2</span>}
              </span>
            )
          })}
          {(pronostico.recupero || pronostico.first_goal || pronostico.last_goal) && (
            <span className="text-[11px] text-[var(--muted)] self-center ml-1">
              {pronostico.recupero && `Rec. ${pronostico.recupero === 'primo' ? '1°T' : '2°T'} · `}
              {pronostico.first_goal && `Primo: ${pronostico.first_goal} · `}
              {pronostico.last_goal && `Ultimo: ${pronostico.last_goal}`}
            </span>
          )}
        </div>
      )}

      {/* Partite, compatte */}
      <details className="border-t border-white/8 group" open={stato === 'live'}>
        <summary className="cursor-pointer list-none flex items-center justify-between px-4 py-2.5 text-xs text-[var(--muted)] select-none">
          <span>{s.partite.length} partite{live > 0 && <span className="text-red-300 font-semibold"> · {live} live</span>}{giocate > 0 && ` · ${giocate} finite`}</span>
          <span className="transition-transform group-open:rotate-90">▶</span>
        </summary>
        <div className="px-4 pb-3 space-y-1.5">
          {s.partite.map((p, i) => {
            const d = dettMap.get(`${p.home}__${p.away}`)
            const st = statoDi(d)
            return (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className={`text-[10px] font-bold w-10 shrink-0 ${st === 'in_corso' ? 'text-red-300' : st === 'finita' ? 'text-[var(--accent-soft)]' : 'text-[var(--muted)]'}`}>
                  {st === 'in_corso' ? '● LIVE' : st === 'finita' ? 'FT' : p.ora ?? ''}
                </span>
                <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
                  <span className="truncate">{p.home}</span>
                  <Flag team={p.home} w={40} className="w-5 h-3.5 shrink-0" />
                </div>
                <span className={`px-1.5 tabular-nums ${d ? 'font-display font-extrabold' : 'text-white/25 text-xs'}`}>{d ? d.score : '–'}</span>
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <Flag team={p.away} w={40} className="w-5 h-3.5 shrink-0" />
                  <span className="truncate">{p.away}</span>
                </div>
              </div>
            )
          })}
        </div>
      </details>
    </div>
  )
}
