'use client'

import { useState, useEffect } from 'react'

// La scadenza detta come la direbbe una persona: "si chiude sabato alle 14:30".
// Solo nelle ultime 24 ore diventa un conto: "mancano 3 ore", "mancano 20 minuti".
// Niente cifre che scorrono: non è una bomba, è una partita.
const ROMA = 'Europe/Rome'

export function fraseScadenza(deadline: string, now: number): { testo: string; urgente: boolean; scaduta: boolean } {
  const d = new Date(deadline)
  const diff = d.getTime() - now
  if (diff <= 0) return { testo: 'Chiusa', urgente: false, scaduta: true }
  const ora = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: ROMA })
  if (diff > 24 * 3600000) {
    const oggi = new Date(now).toLocaleDateString('it-IT', { timeZone: ROMA })
    const domani = new Date(now + 86400000).toLocaleDateString('it-IT', { timeZone: ROMA })
    const giorno = d.toLocaleDateString('it-IT', { timeZone: ROMA })
    const quando = giorno === oggi ? 'oggi' : giorno === domani ? 'domani' : d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', timeZone: ROMA })
    return { testo: `Si chiude ${quando} alle ${ora}`, urgente: false, scaduta: false }
  }
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  if (h >= 2) return { testo: `Mancano ${h} ore`, urgente: h < 6, scaduta: false }
  if (h === 1) return { testo: m > 0 ? `Manca 1 ora e ${m} minuti` : 'Manca 1 ora', urgente: true, scaduta: false }
  return { testo: m <= 1 ? 'Ultimo minuto' : `Mancano ${m} minuti`, urgente: true, scaduta: false }
}

export default function Countdown({ deadline, className = '' }: { deadline: string; className?: string }) {
  // null al primo render: l'ora si legge solo nel browser, così server e client coincidono.
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    const tick = () => setNow(Date.now())
    const first = setTimeout(tick, 0)
    const t = setInterval(tick, 30000)
    return () => { clearTimeout(first); clearInterval(t) }
  }, [])
  if (now === null) return <span className={`text-sm text-[var(--muted)] ${className}`}>&nbsp;</span>
  const { testo, urgente, scaduta } = fraseScadenza(deadline, now)
  return (
    <span className={`text-sm ${scaduta ? 'text-[var(--muted)]' : urgente ? 'text-[var(--gold)] font-semibold' : 'text-[var(--muted)]'} ${className}`}>
      {testo}
    </span>
  )
}
