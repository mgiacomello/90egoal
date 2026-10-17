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
        className={`inline-grid place-items-center rounded-full font-num font-bold leading-none text-white ring-1 ring-black/10 ${className}`}
        style={{ background: c, fontSize: w >= 80 ? 13 : 7.5, letterSpacing: '0' }}
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
      className={`inline-block rounded-[3px] object-cover ring-1 ring-black/10 ${className}`}
    />
  )
}
