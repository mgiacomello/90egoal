'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Stato = 'caricamento' | 'non-supportato' | 'ios-installa' | 'non-configurato' | 'negato' | 'spento' | 'acceso'
type Preferenza = 'tutti' | 'miei'

function base64UrlToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}
function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

async function registra(sub: PushSubscription, preferenza: Preferenza) {
  const j = sub.toJSON()
  const { error } = await createClient().rpc('push_registra', {
    p_endpoint: sub.endpoint,
    p_p256dh: j.keys?.p256dh ?? '',
    p_auth: j.keys?.auth ?? '',
    p_preferenza: preferenza,
    p_user_agent: navigator.userAgent,
  })
  return !error
}

// Attiva/disattiva le notifiche su QUESTO dispositivo.
// variant "banner": invito compatto in cima alle schedine, sparisce quando sono attive.
export default function PushToggle({ variant = 'card' }: { variant?: 'card' | 'banner' }) {
  const [stato, setStato] = useState<Stato>('caricamento')
  const [pref, setPref] = useState<Preferenza>('tutti')
  const [chiave, setChiave] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [errore, setErrore] = useState('')
  // Letto subito: al primo render lo stato è "caricamento" e non si mostra niente, quindi server e client coincidono.
  const [chiuso, setChiuso] = useState(() => {
    try { return typeof window !== 'undefined' && localStorage.getItem('push-banner-chiuso') === '1' } catch { return false }
  })

  const verifica = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      // Su iPhone le notifiche esistono solo nell'app aggiunta alla schermata Home.
      setStato(isIos() && !isStandalone() ? 'ios-installa' : 'non-supportato')
      return
    }
    const cfg = await fetch('/api/push/config').then(r => r.json()).catch(() => ({ publicKey: null }))
    if (!cfg.publicKey) { setStato('non-configurato'); return }
    setChiave(cfg.publicKey)
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
    const sub = await reg.pushManager.getSubscription()
    if (Notification.permission === 'denied') { setStato('negato'); return }
    if (!sub) { setStato('spento'); return }
    const { data } = await createClient().rpc('push_mia_iscrizione', { p_endpoint: sub.endpoint })
    if (data === 'tutti' || data === 'miei') { setPref(data); setStato('acceso'); return }
    // Iscritto nel browser ma non nel database (es. cambio account): si riallinea da solo.
    setStato((await registra(sub, 'tutti')) ? 'acceso' : 'spento')
  }, [])

  useEffect(() => {
    // Dopo il primo render: le API del browser non esistono sul server.
    const t = setTimeout(() => { verifica().catch(() => setStato('non-supportato')) }, 0)
    return () => clearTimeout(t)
  }, [verifica])

  async function attiva() {
    if (!chiave) return
    setBusy(true); setErrore('')
    try {
      // Il permesso va chiesto dentro al tocco: iPhone lo rifiuta altrimenti.
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') { setStato(perm === 'denied' ? 'negato' : 'spento'); return }
      const reg = await navigator.serviceWorker.ready
      const sub = (await reg.pushManager.getSubscription())
        ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(chiave) }))
      if (await registra(sub, pref)) setStato('acceso')
      else setErrore('Attivazione non salvata. Riprova tra poco.')
    } catch {
      setErrore('Attivazione non riuscita su questo dispositivo.')
    } finally {
      setBusy(false)
    }
  }

  async function disattiva() {
    setBusy(true); setErrore('')
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await createClient().rpc('push_cancella', { p_endpoint: sub.endpoint })
        await sub.unsubscribe()
      }
      setStato('spento')
    } finally {
      setBusy(false)
    }
  }

  async function cambiaPref(p: Preferenza) {
    setPref(p)
    if (stato !== 'acceso') return
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub && !(await registra(sub, p))) setErrore('Preferenza non salvata.')
  }

  if (variant === 'banner') {
    if (chiuso || !['spento', 'ios-installa'].includes(stato)) return null
    return (
      <div className="glass rounded-2xl px-4 py-3 mb-5 flex items-center gap-3">
        <span className="text-2xl">🔔</span>
        <div className="flex-1 min-w-0 text-sm">
          {stato === 'ios-installa' ? (
            <>Per ricevere i gol in diretta su iPhone: <strong className="text-white">Condividi → Aggiungi alla schermata Home</strong>, poi apri l&apos;app da lì.</>
          ) : (
            <>Ricevi una notifica <strong className="text-white">quando esce un tuo minuto</strong>.</>
          )}
        </div>
        {stato === 'spento' && (
          <button onClick={attiva} disabled={busy} className="btn-primary px-4 py-2 text-sm shrink-0">{busy ? '…' : 'Attiva'}</button>
        )}
        <button
          onClick={() => { setChiuso(true); try { localStorage.setItem('push-banner-chiuso', '1') } catch { /* ignora */ } }}
          className="text-[var(--muted)] hover:text-white text-sm shrink-0" aria-label="Chiudi"
        >✕</button>
      </div>
    )
  }

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display font-bold flex items-center gap-2">🔔 Notifiche</h2>
          <p className="text-xs text-[var(--muted)] mt-0.5">Su questo dispositivo.</p>
        </div>
        {stato === 'acceso' && <button onClick={disattiva} disabled={busy} className="btn-ghost px-4 py-2 text-sm">Disattiva</button>}
        {stato === 'spento' && <button onClick={attiva} disabled={busy} className="btn-primary px-4 py-2 text-sm">{busy ? 'Attivo…' : 'Attiva'}</button>}
      </div>

      <div className="text-sm text-[var(--muted)] mt-3">
        {stato === 'caricamento' && 'Controllo…'}
        {stato === 'ios-installa' && <>Su iPhone le notifiche funzionano solo nell&apos;app installata: in Safari tocca <strong className="text-white">Condividi → Aggiungi alla schermata Home</strong>, poi apri 90 &amp; Goal dall&apos;icona e torna qui.</>}
        {stato === 'non-supportato' && 'Questo browser non supporta le notifiche. Prova con Chrome su Android o con l’app installata su iPhone (iOS 16.4 o successivo).'}
        {stato === 'non-configurato' && 'Le notifiche non sono ancora attive sul sito.'}
        {stato === 'negato' && 'Hai bloccato le notifiche per questo sito. Per riattivarle vai nelle impostazioni del browser o del telefono, alla voce Notifiche.'}
        {stato === 'spento' && 'Gol in diretta, i tuoi minuti che escono, il risultato a fine giornata e un promemoria prima della scadenza.'}
        {stato === 'acceso' && '✓ Attive. Arrivano i gol delle schedine che hai giocato, il risultato finale e i promemoria.'}
      </div>

      {(stato === 'acceso' || stato === 'spento') && (
        <div className="grid grid-cols-2 gap-2 mt-4">
          <button onClick={() => cambiaPref('tutti')} className={`seg-btn px-3 py-2.5 text-xs ${pref === 'tutti' ? 'is-active' : ''}`}>⚽ Tutti i gol</button>
          <button onClick={() => cambiaPref('miei')} className={`seg-btn px-3 py-2.5 text-xs ${pref === 'miei' ? 'is-active' : ''}`}>🎯 Solo i miei minuti</button>
        </div>
      )}
      {errore && <p className="text-xs text-red-300 mt-3">{errore}</p>}
    </div>
  )
}
