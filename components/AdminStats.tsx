import { Schedina, Pronostico, Profile } from '@/lib/types'

interface Props {
  schedine: Schedina[]
  profiles: Profile[]
  pronostici: Pronostico[]
}

export default function AdminStats({ schedine, profiles, pronostici }: Props) {
  const totUtenti = profiles.filter(p => !p.is_admin).length
  const totPronostici = pronostici.length

  return (
    <div>
      <div className="mb-6">
        <span className="text-xs font-semibold tracking-widest text-[var(--accent)] uppercase">Cruscotto</span>
        <h2 className="font-display font-bold text-2xl sm:text-3xl mt-1">Statistiche &amp; pronostici</h2>
        <p className="text-[var(--muted)] text-sm mt-1">Panoramica delle giocate. Per il dettaglio di un giocatore usa la ricerca qui sotto.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard n={totUtenti} l="Giocatori registrati" />
        <StatCard n={totPronostici} l="Pronostici totali" />
        {schedine.map(s => (
          <StatCard
            key={s.id}
            n={pronostici.filter(p => p.schedina_id === s.id).length}
            l={`Compilati · ${s.nome.replace(' — Mondiali FIFA 2026', '')}`}
          />
        ))}
      </div>
    </div>
  )
}

function StatCard({ n, l }: { n: number; l: string }) {
  return (
    <div className="glass rounded-2xl p-4 text-center">
      <div className="font-display font-extrabold text-3xl text-gradient tabular-nums">{n}</div>
      <div className="text-[11px] text-[var(--muted)] mt-1 leading-tight">{l}</div>
    </div>
  )
}
