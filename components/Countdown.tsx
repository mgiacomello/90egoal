'use client'

import { useState, useEffect } from 'react'

export default function Countdown({ deadline }: { deadline: string }) {
  const [now, setNow] = useState<number | null>(null)

  useEffect(() => {
    setNow(Date.now())
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  if (now === null) return null
  const diff = new Date(deadline).getTime() - now
  if (diff <= 0) return <span className="text-red-300/90 text-xs font-semibold">Scaduta</span>

  const d = Math.floor(diff / 86400000)
  const h = Math.floor((diff % 86400000) / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  const urgent = diff < 3600000 * 6 // < 6h

  const Box = ({ v, l }: { v: number; l: string }) => (
    <span className="inline-flex flex-col items-center">
      <span className={`font-display font-extrabold tabular-nums text-sm leading-none ${urgent ? 'text-[var(--gold)]' : 'text-white'}`}>{String(v).padStart(2, '0')}</span>
      <span className="text-[8px] text-[var(--muted)] uppercase">{l}</span>
    </span>
  )

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ${urgent ? 'bg-[var(--gold)]/15 border border-[var(--gold)]/40 animate-pulse-glow' : 'bg-black/40 border border-white/15'} backdrop-blur`}>
      <span className="text-xs">⏳</span>
      {d > 0 && <><Box v={d} l="g" /><span className="text-[var(--muted)]">:</span></>}
      <Box v={h} l="h" /><span className="text-[var(--muted)]">:</span>
      <Box v={m} l="m" /><span className="text-[var(--muted)]">:</span>
      <Box v={s} l="s" />
    </span>
  )
}
