import { flagUrl } from '@/lib/flags'

export default function Flag({ team, w = 40, className = '' }: { team: string; w?: 20 | 40 | 80 | 160; className?: string }) {
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
