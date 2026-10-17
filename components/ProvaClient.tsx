'use client'

import { useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { Schedina } from '@/lib/types'
import { PROVA_KEY, type PronosticoProva } from '@/lib/demo'
import ScedinaForm from '@/components/ScedinaForm'
import Flag from '@/components/Flag'
import InstallButton from '@/components/InstallButton'

// Lo stato vive nel telefono: letto una volta, servito neutro al server.
const noSubscribe = () => () => {}
function leggi(): string | null {
  try { return localStorage.getItem(PROVA_KEY) } catch { return null }
}

export default function ProvaClient({ schedina }: { schedina: Schedina }) {
  const grezzo = useSyncExternalStore(noSubscribe, leggi, () => null)
  const [rifai, setRifai] = useState(false)
  const [, setVersione] = useState(0)   // dopo il salvataggio: rileggi il telefono
  let salvato: PronosticoProva | null = null
  try { salvato = grezzo ? (JSON.parse(grezzo) as PronosticoProva) : null } catch { salvato = null }

  if (!salvato || rifai) {
    return <ScedinaForm schedina={schedina} pronosticoEsistente={null} userId="" guest onGuestSaved={() => { setRifai(false); setVersione(v => v + 1) }} />
  }

  return (
    <div className="animate-fade-up space-y-5">
      <div>
        <span className="text-xs font-semibold tracking-widest text-[var(--accent)] uppercase">La tua schedina di prova</span>
        <h1 className="font-display font-bold text-2xl mt-1 leading-tight">{salvato.nome}</h1>
      </div>

      <div className="glass rounded-2xl p-5">
        <div className="flex flex-wrap gap-1.5">
          {salvato.minuti.map(m => <span key={m} className="tag-static px-2.5 py-1.5 text-sm">{m}&apos;</span>)}
        </div>
        {(salvato.recupero || salvato.first_goal || salvato.last_goal) && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-[var(--muted)] mt-3">
            {salvato.recupero && <span>Recupero {salvato.recupero === 'primo' ? '1° tempo' : '2° tempo'}</span>}
            {salvato.first_goal && <span className="flex items-center gap-1">Primo: <Flag team={salvato.first_goal} w={40} className="w-4 h-3" /> {salvato.first_goal}</span>}
            {salvato.last_goal && <span className="flex items-center gap-1">Ultimo: <Flag team={salvato.last_goal} w={40} className="w-4 h-3" /> {salvato.last_goal}</span>}
          </div>
        )}
        <p className="text-xs text-[var(--muted)] mt-4">È salvata solo su questo telefono. Per entrare in classifica e vedere i tuoi minuti accendersi in diretta, serve un account: ci vuole mezzo minuto.</p>
      </div>

      <div className="space-y-3">
        <Link href="/auth/register" className="btn-primary w-full py-4 text-base">Crea l&apos;account e gioca davvero →</Link>
        <Link href="/auth/login" className="btn-ghost w-full py-3.5 text-sm">Ho già un account</Link>
        <button type="button" onClick={() => setRifai(true)} className="w-full text-sm text-[var(--muted)] hover:text-[var(--ink)] py-2">Rifai la schedina</button>
        <InstallButton />
      </div>
    </div>
  )
}
