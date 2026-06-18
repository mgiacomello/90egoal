import { Schedina, Risultato, ClassificaRow, MatchDetail } from '@/lib/types'

interface Props {
  schedine: Schedina[]
  risultatiMap: Record<number, Risultato>
  classifica: ClassificaRow[]
}

export default function AdminPredictions({ schedine, risultatiMap, classifica }: Props) {
  return (
    <div>
      <div className="mb-6">
        <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#22d3ee' }}>Previsioni</span>
        <h2 className="font-display font-bold text-2xl sm:text-3xl mt-1">📈 Stime sull&apos;andamento</h2>
        <p className="text-[var(--muted)] text-sm mt-1">Proiezioni indicative calcolate sui dati attuali (non sono certezze).</p>
      </div>

      <div className="space-y-4">
        {schedine.map(s => {
          const ris = risultatiMap[s.id]
          const dett = (ris?.dettagli as MatchDetail[] | undefined) ?? []
          const tot = s.partite.length
          const giocate = dett.length
          const golFinora = dett.reduce((acc, d) => acc + d.minuti.length, 0)
          const golPerPartita = giocate > 0 ? golFinora / giocate : 0
          const golAttesi = Math.round(golPerPartita * tot)
          const minutiCoperti = ris?.minuti_gol?.length ?? 0
          const completa = giocate >= tot
          // leader della schedina
          const rows = classifica.filter(c => c.schedina_id === s.id).sort((a, b) => b.totale - a.totale)
          const leader = rows[0]
          const nome = s.nome.replace(' — Mondiali FIFA 2026', '')

          return (
            <div key={s.id} className="glass rounded-2xl p-5">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
                <h3 className="font-display font-bold text-lg">{nome}</h3>
                <span className="text-xs text-[var(--muted)]">{giocate}/{tot} partite giocate</span>
              </div>

              {giocate === 0 ? (
                <p className="text-sm text-[var(--muted)]">Nessuna partita giocata: previsioni non disponibili.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Mini big={golPerPartita.toFixed(1)} l="Gol per partita (finora)" />
                  {!completa
                    ? <Mini big={`~${golAttesi}`} l="Gol attesi a fine schedina" hot />
                    : <Mini big={golFinora} l="Gol totali (finita)" />}
                  <Mini big={`${minutiCoperti}/90`} l="Minuti già 'coperti' da gol" />
                  <Mini big={leader ? `${leader.totale}` : '—'} l={completa ? `Vincitore: ${leader?.username ?? '—'}` : `In testa: ${leader?.username ?? '—'}`} />
                </div>
              )}

              {!completa && giocate > 0 && (
                <p className="text-xs text-[var(--muted)] mt-3">
                  📊 Al ritmo attuale di <strong className="text-white">{golPerPartita.toFixed(1)} gol/partita</strong>, a fine schedina ci si attendono circa <strong className="text-[var(--accent-cyan)]">{golAttesi} gol</strong>: i minuti &quot;coperti&quot; cresceranno, quindi chi ha scelto più minuti diversi avrà più chance.
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Mini({ big, l, hot }: { big: number | string; l: string; hot?: boolean }) {
  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/8 p-3 text-center">
      <div className={`font-display font-extrabold text-2xl tabular-nums ${hot ? 'text-[var(--accent-cyan)]' : 'text-white'}`}>{big}</div>
      <div className="text-[11px] text-[var(--muted)] mt-1 leading-tight">{l}</div>
    </div>
  )
}
