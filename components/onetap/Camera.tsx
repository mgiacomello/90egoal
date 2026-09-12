'use client'

// Fotocamera dentro all'app.
//
// `<input capture>` delega alla fotocamera di sistema: sul telefono funziona,
// ma su computer degenera in un selettore di file e non chiede niente a nessuno.
// getUserMedia invece chiede il permesso davvero e mostra il mirino qui dentro,
// così fra l'inquadratura e l'azione non c'è nessun passaggio di app.
//
// Il flusso resta uno solo: inquadri, un tap, l'azione.

import { useCallback, useEffect, useRef, useState } from 'react'
import { CameraIcon, CloseIcon } from './icons'

type Phase = 'starting' | 'live' | 'denied' | 'unavailable'

interface Props {
  onShot: (photo: Blob) => void
  onClose: () => void
  /** Ripiego sul rullino, sempre a portata di dito. */
  onPickFile: () => void
}

const COPY = {
  asking: 'Serve il permesso della fotocamera',
  askingBody: 'Il browser te lo chiede adesso. La ripresa resta sul dispositivo: viene inviato solo lo scatto che decidi tu.',
  denied: 'Permesso negato',
  deniedBody:
    'La fotocamera è bloccata per questo sito. Puoi sbloccarla dall’icona accanto all’indirizzo (o nelle impostazioni del sito) — oppure scegli un’immagine dal rullino.',
  unavailable: 'Fotocamera non disponibile',
  unavailableBody: 'Questo browser non offre una fotocamera a questa pagina. Il rullino funziona lo stesso.',
  library: 'Scegli dal rullino',
  libraryShort: 'Rullino',
  shutter: 'Scatta',
  flip: 'Gira',
}

export default function Camera({ onShot, onClose, onPickFile }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [phase, setPhase] = useState<Phase>('starting')
  const [facing, setFacing] = useState<'environment' | 'user'>('environment')
  const [busy, setBusy] = useState(false)

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [])

  useEffect(() => {
    let cancelled = false

    async function start() {
      if (typeof navigator.mediaDevices?.getUserMedia !== 'function') {
        if (!cancelled) setPhase('unavailable')
        return
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1920 } },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => {})
        }
        setPhase('live')
      } catch (err) {
        if (cancelled) return
        const name = (err as Error)?.name
        // NotFound/NotReadable: nessuna fotocamera o già occupata da un'altra app.
        setPhase(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unavailable')
      }
    }

    void start()
    return () => {
      cancelled = true
      stop()
    }
  }, [facing, stop])

  async function shoot() {
    const video = videoRef.current
    if (!video || busy) return
    setBusy(true)
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      setBusy(false)
      return
    }
    ctx.drawImage(video, 0, 0)
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.9),
    )
    stop()
    setBusy(false)
    if (blob) onShot(blob)
  }

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-black">
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className={`absolute inset-0 h-full w-full object-cover ${phase === 'live' ? 'opacity-100' : 'opacity-0'}`}
      />

      {phase !== 'live' && (
        <div className="ot-rise relative z-10 mx-auto mt-auto mb-auto w-full max-w-[420px] px-8 text-center">
          <CameraIcon className="mx-auto h-8 w-8 text-white/50" />
          <p className="ot-display mt-5 text-[22px] font-bold">
            {phase === 'starting' ? COPY.asking : phase === 'denied' ? COPY.denied : COPY.unavailable}
          </p>
          <p className="mt-3 text-[15px] leading-relaxed text-[var(--ot-muted)]">
            {phase === 'starting'
              ? COPY.askingBody
              : phase === 'denied'
                ? COPY.deniedBody
                : COPY.unavailableBody}
          </p>
          {phase !== 'starting' && (
            <button onClick={onPickFile} className="ot-chip mt-7">
              {COPY.library}
            </button>
          )}
        </div>
      )}

      {/* Velo scuro: le etichette devono restare leggibili su qualunque inquadratura. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-48 bg-gradient-to-t from-black/75 to-transparent" />

      <div className="relative z-10 mt-auto flex items-center gap-4 px-6 pb-12 pt-8">
        <button
          onClick={onPickFile}
          className="min-w-0 flex-1 truncate text-left text-[13px] font-semibold uppercase tracking-[0.14em] text-white/75"
        >
          {COPY.libraryShort}
        </button>

        <button
          onClick={shoot}
          disabled={phase !== 'live' || busy}
          aria-label={COPY.shutter}
          className="grid h-[74px] w-[74px] flex-none place-items-center rounded-full bg-white shadow-[0_0_0_4px_rgba(255,255,255,0.28)] transition-transform active:scale-90 disabled:opacity-30"
        >
          <span className="h-[60px] w-[60px] rounded-full bg-white ring-2 ring-black/10" />
        </button>

        <button
          onClick={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))}
          disabled={phase !== 'live'}
          className="min-w-0 flex-1 truncate text-right text-[13px] font-semibold uppercase tracking-[0.14em] text-white/75 disabled:opacity-30"
        >
          {COPY.flip}
        </button>
      </div>

      <button
        onClick={() => {
          stop()
          onClose()
        }}
        aria-label="Close"
        className="absolute left-5 top-6 z-20 p-2 text-white/80"
      >
        <CloseIcon className="h-6 w-6" />
      </button>
    </div>
  )
}
