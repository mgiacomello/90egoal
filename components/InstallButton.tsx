'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { IconInstall } from '@/components/Icons'
import { useTx } from '@/components/Lingua'

// Il link gira su WhatsApp: chi lo apre deve poter mettere 90 & Goal sulla
// schermata Home con un tocco. Android chiede al browser; iPhone non lo
// permette, quindi mostriamo i due passaggi di Safari.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type Stato = 'nascosto' | 'android' | 'ios' | 'installata'

// Dispositivo e modalità si conoscono solo nel browser: letti una volta, fuori da React,
// con un valore neutro per il server così l'idratazione combacia.
let ambiente: Stato | null = null
function leggiAmbiente(): Stato {
  if (ambiente) return ambiente
  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
  const ua = navigator.userAgent
  const ios = /iPad|iPhone|iPod/.test(ua) || (/Mac/.test(ua) && 'ontouchend' in document)
  ambiente = standalone ? 'installata' : ios ? 'ios' : 'nascosto'
  return ambiente
}
const noSubscribe = () => () => {}

export default function InstallButton({ className = '' }: { className?: string }) {
  const tx = useTx()
  const base = useSyncExternalStore(noSubscribe, leggiAmbiente, () => 'nascosto' as Stato)
  const [override, setStato] = useState<Stato | null>(null)
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [guida, setGuida] = useState(false)
  const stato = override ?? base

  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setPrompt(e as BeforeInstallPromptEvent); setStato('android') }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  if (stato === 'nascosto' || stato === 'installata') return null

  async function installa() {
    if (stato === 'android' && prompt) {
      await prompt.prompt()
      const { outcome } = await prompt.userChoice
      if (outcome === 'accepted') setStato('installata')
      return
    }
    setGuida(v => !v)
  }

  return (
    <div className={className}>
      <button type="button" onClick={installa} className="btn-ghost w-full py-3 text-sm inline-flex items-center gap-2">
        <IconInstall size={18} /> {tx('Metti 90 & Goal sulla Home', 'Add 90 & Goal to your Home screen')}
      </button>
      {guida && stato === 'ios' && (
        <div className="glass rounded-xl p-4 mt-2 text-sm text-[var(--ink)] space-y-1.5 animate-fade-up">
          <p>{tx('In Safari:', 'In Safari:')}</p>
          <p>1 · {tx('Tocca', 'Tap')} <strong className="text-[var(--ink)]">{tx('Condividi', 'Share')}</strong> {tx('(il quadrato con la freccia, in basso).', '(the square with the arrow, at the bottom).')}</p>
          <p>2 · {tx('Scegli', 'Choose')} <strong className="text-[var(--ink)]">{tx('Aggiungi alla schermata Home', 'Add to Home Screen')}</strong>.</p>
          <p className="text-xs text-[var(--muted)] pt-1">{tx('Da lì si apre come un\'app e può mandarti le notifiche dei gol.', 'From there it opens like an app and can send you goal notifications.')}</p>
        </div>
      )}
    </div>
  )
}
