'use client'

import { useState, useEffect } from 'react'

const STEPS = [
  { icon: '🕐', title: 'Scegli 13 minuti', text: 'In ogni schedina indichi 13 minuti (dall’1 al 90) in cui pensi verrà segnato un gol, in una qualsiasi delle 10 partite. Ogni minuto azzeccato = 1 punto.' },
  { icon: '➕', title: 'Recupero & marcatori', text: 'Puoi prevedere un gol nel recupero (1° o 2° tempo) per +1 punto, e indovinare la prima e l’ultima squadra a segnare: bonus fino a +10!' },
  { icon: '🏆', title: 'Scala la classifica', text: 'Il pronostico è definitivo una volta inviato. Segui la classifica live mentre si giocano le partite e sfida gli amici. In bocca al lupo!' },
]
const KEY = '90goal_onboarding_v1'

export default function Onboarding({ forceOpen = false }: { forceOpen?: boolean }) {
  const [open, setOpen] = useState(false)
  const [i, setI] = useState(0)

  useEffect(() => {
    if (forceOpen) { setOpen(true); return }
    try { if (!localStorage.getItem(KEY)) setOpen(true) } catch {}
  }, [forceOpen])

  function close() {
    setOpen(false)
    if (!forceOpen) { try { localStorage.setItem(KEY, '1') } catch {} }
  }

  if (!open) return null
  const step = STEPS[i]
  const last = i === STEPS.length - 1

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center p-4" style={{ background: 'rgba(3,9,13,0.8)', backdropFilter: 'blur(6px)' }}>
      <div className="glass rounded-3xl p-7 max-w-sm w-full text-center animate-fade-up">
        <div className="text-xs font-semibold tracking-widest text-[var(--accent)] uppercase mb-4">Come si gioca · {i + 1}/3</div>
        <div className="inline-grid place-items-center w-20 h-20 rounded-3xl text-4xl mb-5" style={{ background: 'linear-gradient(135deg, rgba(0,230,118,0.22), rgba(34,211,238,0.12))', border: '1px solid rgba(255,255,255,0.1)' }}>{step.icon}</div>
        <h2 className="font-display font-bold text-2xl mb-2">{step.title}</h2>
        <p className="text-[var(--muted)] text-sm leading-relaxed mb-6">{step.text}</p>

        <div className="flex items-center justify-center gap-1.5 mb-6">
          {STEPS.map((_, idx) => (
            <span key={idx} className="h-1.5 rounded-full transition-all" style={{ width: idx === i ? 24 : 8, background: idx === i ? 'var(--accent)' : 'rgba(255,255,255,0.2)' }} />
          ))}
        </div>

        <div className="flex gap-2">
          <button onClick={close} className="btn-ghost px-4 py-2.5 text-sm flex-1">Salta</button>
          {last ? (
            <button onClick={close} className="btn-primary px-4 py-2.5 text-sm flex-1">Inizia a giocare →</button>
          ) : (
            <button onClick={() => setI(i + 1)} className="btn-primary px-4 py-2.5 text-sm flex-1">Avanti →</button>
          )}
        </div>
      </div>
    </div>
  )
}
