'use client'

import { Partita } from '@/lib/types'
import Flag from '@/components/Flag'

interface Props {
  partite: Partita[]
  value: string
  onChange: (team: string) => void
}

// Selezione squadra a pulsanti (al posto del <select> nativo, problematico
// su browser datati). Mostra tutte le squadre in gioco; una sola selezionabile.
export default function TeamPicker({ partite, value, onChange }: Props) {
  const teams = [...new Set(partite.flatMap(p => [p.home, p.away]))]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
      <button
        type="button"
        onClick={() => onChange('')}
        className={`team-chip justify-center ${value === '' ? 'is-on' : ''}`}
      >
        — Nessuna —
      </button>
      {teams.map(t => (
        <button
          key={t}
          type="button"
          onClick={() => onChange(value === t ? '' : t)}
          className={`team-chip ${value === t ? 'is-on' : ''}`}
        >
          <Flag team={t} w={40} className="w-5 h-3.5 shrink-0" />
          <span className="truncate">{t}</span>
        </button>
      ))}
    </div>
  )
}
