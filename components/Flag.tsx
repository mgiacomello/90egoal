import { flagCode, flagUrl } from '@/lib/flags'
import { coloreSquadra, sigla } from '@/lib/teams'

// Nazionali: la bandiera. Club (Serie A, B, C…): una sigla su fondo colorato, stabile per squadra.
export default function Flag({ team, w = 40, className = '' }: { team: string; w?: 20 | 40 | 80 | 160; className?: string }) {
  if (flagCode(team) === 'un') {
    const c = coloreSquadra(team)
    return (
      <span
        aria-hidden
        title={team}
        className={`inline-grid place-items-center rounded-[4px] font-display font-extrabold leading-none text-[#04130b] ring-1 ring-white/15 shadow-[0_2px_6px_rgba(0,0,0,0.5)] ${className}`}
        style={{ background: `linear-gradient(135deg, ${c}, ${c}b3)`, fontSize: w >= 80 ? 14 : 8, letterSpacing: '-0.02em' }}
      >
        {sigla(team)}
      </span>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={flagUrl(team, w)}
      alt={team}
      loading="lazy"
      className={`inline-block rounded-[3px] object-cover shadow-[0_2px_6px_rgba(0,0,0,0.5)] ring-1 ring-white/10 ${className}`}
    />
  )
}
