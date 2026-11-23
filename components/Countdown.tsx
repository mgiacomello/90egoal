'use client'

import { useState, useEffect } from 'react'
import { useLingua } from '@/components/Lingua'
import { localeDi, txDi, type Lingua } from '@/lib/lingua'

// La scadenza detta come la direbbe una persona: "si chiude sabato alle 14:30".
// Solo nelle ultime 24 ore diventa un conto: "mancano 3 ore", "mancano 20 minuti".
// Niente cifre che scorrono: non è una bomba, è una partita.
const ROMA = 'Europe/Rome'

export function fraseScadenza(deadline: string, now: number, lingua: Lingua = 'it'): { testo: string; urgente: boolean; scaduta: boolean } {
  const tx = txDi(lingua)
  const loc = localeDi(lingua)
  const d = new Date(deadline)
  const diff = d.getTime() - now
  if (diff <= 0) return { testo: tx('Chiusa', 'Closed'), urgente: false, scaduta: true }
  const ora = d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit', timeZone: ROMA })
  if (diff > 24 * 3600000) {
    const oggi = new Date(now).toLocaleDateString(loc, { timeZone: ROMA })
    const domani = new Date(now + 86400000).toLocaleDateString(loc, { timeZone: ROMA })
    const giorno = d.toLocaleDateString(loc, { timeZone: ROMA })
    const quando = giorno === oggi ? tx('oggi', 'today') : giorno === domani ? tx('domani', 'tomorrow') : d.toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'long', timeZone: ROMA })
    return { testo: tx(`Si chiude ${quando} alle ${ora}`, `Closes ${quando} at ${ora}`), urgente: false, scaduta: false }
  }
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  if (h >= 2) return { testo: tx(`Mancano ${h} ore`, `${h} hours left`), urgente: h < 6, scaduta: false }
  if (h === 1) return { testo: m > 0 ? tx(`Manca 1 ora e ${m} minuti`, `1 hour and ${m} ${m === 1 ? 'minute' : 'minutes'} left`) : tx('Manca 1 ora', '1 hour left'), urgente: true, scaduta: false }
  return { testo: m <= 1 ? tx('Ultimo minuto', 'Last minute') : tx(`Mancano ${m} minuti`, `${m} minutes left`), urgente: true, scaduta: false }
}

export default function Countdown({ deadline, className = '' }: { deadline: string; className?: string }) {
  // null al primo render: l'ora si legge solo nel browser, così server e client coincidono.
  const lingua = useLingua()
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    const tick = () => setNow(Date.now())
    const first = setTimeout(tick, 0)
    const t = setInterval(tick, 30000)
    return () => { clearTimeout(first); clearInterval(t) }
  }, [])
  if (now === null) return <span className={`text-sm text-[var(--muted)] ${className}`}>&nbsp;</span>
  const { testo, urgente, scaduta } = fraseScadenza(deadline, now, lingua)
  return (
    <span className={`text-sm ${scaduta ? 'text-[var(--muted)]' : urgente ? 'text-[var(--gold)] font-semibold' : 'text-[var(--muted)]'} ${className}`}>
      {testo}
    </span>
  )
}
