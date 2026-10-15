import { Schedina, Pronostico, Risultato, MatchDetail } from '@/lib/types'
import { cronologiaGol, type DettaglioLive } from '@/lib/live'
import Flag from '@/components/Flag'

interface Props {
  schedina: Schedina
  risultato: Risultato
  pronostico?: Pronostico
  punti?: number
  posizione?: { pos: number; su: number }
}

// Il secondo schermo: durante le partite si apre l'app e si vedono i gol
// arrivare, dal più recente, con il minuto grande. Se il minuto è tuo, si accende.
export default function LiveFeed({ schedina, risultato, pronostico, punti, posizione }: Props) {
  const dettagli = ((risultato.dettagli as MatchDetail[] | undefined) ?? []).map(d => ({
    home: d.home, away: d.away, score: d.score, minuti: d.minuti, gol: d.gol ?? [], stato: d.stato ?? 'finita',
  })) as DettaglioLive[]
  const gol = cronologiaGol(schedina.partite, dettagli).reverse()
  const miei = new Set(pronostico?.minuti ?? [])
  const statoDi = (p: { home: string; away: string }) => dettagli.find(d => d.home === p.home && d.away === p.away)?.stato ?? 'da_giocare'
  const inCorso = schedina.partite.filter(p => statoDi(p) === 'in_corso').length
  const finite = schedina.partite.filter(p => statoDi(p) === 'finita').length
  const conclusa = finite === schedina.partite.length
  const azzeccati = pronostico ? pronostico.minuti.filter(m => risultato.minuti_gol.includes(m)) : []

  return (
    <div className="space-y-4">
      {/* Il mio stato, in una riga */}
      {pronostico && (
        <div className="glass rounded-2xl px-5 py-4 flex items-center justify-between gap-4">
          <div>
            <div className="font-display font-extrabold text-4xl text-[var(--accent-soft)] tabular-nums leading-none">
              {punti ?? 0}<span className="text-sm font-normal text-[var(--muted)] ml-1">pt</span>
            </div>
            <div className="text-xs text-[var(--muted)] mt-1.5">
              {azzeccati.length}/{pronostico.minuti.length} minuti presi{conclusa ? ' · finale' : ''}
            </div>
          </div>
          {posizione && (
            <div className="text-right">
              <div className="font-display font-extrabold text-3xl text-gradient-gold tabular-nums leading-none">{posizione.pos}°</div>
              <div className="text-xs text-[var(--muted)] mt-1.5">su {posizione.su}</div>
            </div>
          )}
        </div>
      )}

      {/* I miei minuti: quelli usciti si accendono */}
      {pronostico && (
        <div className="flex flex-wrap gap-1.5">
          {pronostico.minuti.map(m => {
            const hit = risultato.minuti_gol.includes(m)
            const doppio = hit && (m === risultato.minuto_primo_gol || m === risultato.minuto_ultimo_gol)
            return (
              <span key={m} className={`tag-static ${hit ? '' : conclusa ? 'is-miss' : 'is-pending'} px-2.5 py-1.5 text-sm`}>
                {m}&apos;{doppio && <span className="text-[var(--gold)] ml-0.5">×2</span>}
              </span>
            )
          })}
        </div>
      )}

      {/* Stato delle partite */}
      <div className="flex items-center justify-between text-xs text-[var(--muted)] px-1">
        <span>
          {inCorso > 0 && <span className="text-red-300 font-semibold">● {inCorso} in corso · </span>}
          {finite}/{schedina.partite.length} finite
        </span>
        <span>{gol.length} gol</span>
      </div>

      {/* I gol, dal più recente */}
      {gol.length === 0 ? (
        <div className="glass rounded-2xl py-10 text-center text-[var(--muted)] text-sm">
          Ancora nessun gol. Appena arriva, lo vedi qui.
        </div>
      ) : (
        <div className="space-y-1.5">
          {gol.map((g, i) => {
            const mio = g.minuto !== null && miei.has(g.minuto)
            return (
              <div key={i} className={`rounded-xl border px-3 py-2.5 flex items-center gap-3 ${mio ? 'bg-[var(--accent)]/[0.12] border-[var(--accent)]/50' : 'bg-white/[0.03] border-white/8'}`}>
                <div className={`font-display font-extrabold text-xl tabular-nums w-14 shrink-0 ${mio ? 'text-[var(--accent-soft)]' : 'text-white/80'}`}>
                  {g.min}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 text-sm">
                    <Flag team={g.team} w={40} className="w-5 h-3.5 shrink-0" />
                    <span className="font-semibold truncate">{g.team}</span>
                    {g.doppio && <span className="text-[10px] font-bold text-[var(--gold)] border border-[var(--gold)]/50 rounded px-1">×2</span>}
                  </div>
                  <div className="text-xs text-[var(--muted)] truncate">{g.home} {g.score} {g.away}</div>
                </div>
                {mio && <span className="text-[10px] font-bold text-[var(--accent-ink)] bg-[var(--accent)] rounded-full px-2 py-0.5 shrink-0">TUO</span>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
