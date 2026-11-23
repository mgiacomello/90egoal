'use client'

import { useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { Schedina } from '@/lib/types'
import { PROVA_KEY, type PronosticoProva } from '@/lib/demo'
import ScedinaForm from '@/components/ScedinaForm'
import Flag from '@/components/Flag'
import InstallButton from '@/components/InstallButton'
import { useLingua, useTx } from '@/components/Lingua'
import { nomeSchedina } from '@/lib/lingua'

// Lo stato vive nel telefono: letto una volta, servito neutro al server.
const noSubscribe = () => () => {}
function leggi(): string | null {
  try { return localStorage.getItem(PROVA_KEY) } catch { return null }
}

export default function ProvaClient({ schedina }: { schedina: Schedina }) {
  const tx = useTx()
  const lingua = useLingua()
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
        <span className="text-xs font-semibold tracking-widest text-[var(--accent)] uppercase">{tx('La tua schedina di prova', 'Your trial ticket')}</span>
        <h1 className="font-display font-bold text-2xl mt-1 leading-tight">{nomeSchedina(salvato.nome, lingua)}</h1>
      </div>

      <div className="glass rounded-2xl p-5">
        <div className="flex flex-wrap gap-1.5">
          {salvato.minuti.map(m => <span key={m} className="tag-static px-2.5 py-1.5 text-sm">{m}&apos;</span>)}
        </div>
        {(salvato.recupero || salvato.first_goal || salvato.last_goal) && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-[var(--muted)] mt-3">
            {salvato.recupero && <span>{tx('Recupero', 'Stoppage time')} {salvato.recupero === 'primo' ? tx('1° tempo', '1st half') : tx('2° tempo', '2nd half')}</span>}
            {salvato.first_goal && <span className="flex items-center gap-1">{tx('Primo:', 'First:')} <Flag team={salvato.first_goal} w={40} className="w-4 h-3" /> {salvato.first_goal}</span>}
            {salvato.last_goal && <span className="flex items-center gap-1">{tx('Ultimo:', 'Last:')} <Flag team={salvato.last_goal} w={40} className="w-4 h-3" /> {salvato.last_goal}</span>}
          </div>
        )}
        <p className="text-xs text-[var(--muted)] mt-4">{tx('È salvata solo su questo telefono. Per entrare in classifica e vedere i tuoi minuti accendersi in diretta, serve un account: ci vuole mezzo minuto.', 'It\'s saved on this phone only. To enter the standings and watch your minutes light up live, you need an account: it takes half a minute.')}</p>
      </div>

      <div className="space-y-3">
        <Link href="/auth/register" className="btn-primary w-full py-4 text-base">{tx('Crea l\'account e gioca davvero →', 'Create an account and play for real →')}</Link>
        <Link href="/auth/login" className="btn-ghost w-full py-3.5 text-sm">{tx('Ho già un account', 'I already have an account')}</Link>
        <button type="button" onClick={() => setRifai(true)} className="w-full text-sm text-[var(--muted)] hover:text-[var(--ink)] py-2">{tx('Rifai la schedina', 'Redo the ticket')}</button>
        <InstallButton />
      </div>
    </div>
  )
}
