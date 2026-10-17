'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { IconInstall } from '@/components/Icons'

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
        <IconInstall size={18} /> Metti 90 &amp; Goal sulla Home
      </button>
      {guida && stato === 'ios' && (
        <div className="glass rounded-xl p-4 mt-2 text-sm text-white/80 space-y-1.5 animate-fade-up">
          <p>In Safari:</p>
          <p>1 · Tocca <strong className="text-white">Condividi</strong> (il quadrato con la freccia, in basso).</p>
          <p>2 · Scegli <strong className="text-white">Aggiungi alla schermata Home</strong>.</p>
          <p className="text-xs text-[var(--muted)] pt-1">Da lì si apre come un&apos;app e può mandarti le notifiche dei gol.</p>
        </div>
      )}
    </div>
  )
}
