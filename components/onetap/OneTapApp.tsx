'use client'

// ONE TAP — l'applicazione.
//
// Una sola macchina a stati: home → analisi → azione. Tutto il resto (demo,
// privacy, Pro, cronologia) sta in pannelli che si aprono e si richiudono senza
// mai interrompere quel percorso.

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { analyze, ACTION_LABEL } from '@/lib/onetap/detect'
import { actionHref, detectPlatform, opensInNewTab, runAction } from '@/lib/onetap/actions'
import {
  expandQrPayload,
  imageFromClipboard,
  prepareImage,
  readBarcode,
  textFromClipboard,
} from '@/lib/onetap/image'
import { demoText, type DemoScenario } from '@/lib/onetap/demo'
import { readOnDevice } from '@/lib/onetap/ocr'
import {
  clearHistory,
  FREE_ACTIONS_PER_MONTH,
  getServerSnapshot,
  getSnapshot,
  markOnboarded,
  recordAction,
  removeFromHistory,
  subscribe,
  wipeEverything,
} from '@/lib/onetap/storage'
import type { Analysis, HistoryItem, SuggestedAction } from '@/lib/onetap/types'
import ActionCard from './ActionCard'
import Camera from './Camera'
import Onboarding from './Onboarding'
import { DemoSheet, PrivacySheet, ProSheet } from './Sheets'
import { ActionIcon, CameraIcon, CloseIcon, TrashIcon } from './icons'

type View = 'home' | 'camera' | 'analyzing' | 'result'
type SheetName = 'privacy' | 'pro' | 'demo'

const READING_STEPS = ['Reading…', 'Understanding…', 'Choosing the action…']
const ON_DEVICE_STEPS = ['Reading on your device…', 'This stays offline…', 'Choosing the action…']

const SHARE_RETRY_NOTICE =
  'Almost there — add ONE TAP to your home screen once and shared screenshots will land here automatically.'

export default function OneTapApp() {
  const searchParams = useSearchParams()
  const store = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const [view, setView] = useState<View>('home')
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sheet, setSheet] = useState<SheetName | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [readingStep, setReadingStep] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [imagesConfigured, setImagesConfigured] = useState<boolean | null>(null)
  const [intro, setIntro] = useState(false)
  const [onDevice, setOnDevice] = useState(false)

  const cameraRef = useRef<HTMLInputElement>(null)
  const libraryRef = useRef<HTMLInputElement>(null)
  const platform = useMemo(() => detectPlatform(), [])

  /* ------------------------------------------------------------ *
   * Analisi
   * ------------------------------------------------------------ */

  const record = useCallback((result: Analysis) => {
    setAnalysis(result)
    setError(null)
    setView('result')
  }, [])

  /** Testo: analisi immediata in locale, poi eventuale rifinitura delle risposte. */
  const runText = useCallback(
    async (text: string, source: Analysis['source'] = 'text') => {
      const trimmed = text.trim()
      if (!trimmed) return
      const local = analyze(trimmed, { source })
      record(local)

      // Solo le risposte valgono un giro sul modello: tutto il resto è già deciso.
      if (local.primary?.kind !== 'REPLY') return
      try {
        const res = await fetch('/api/onetap/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: trimmed, lang: local.lang }),
        })
        if (!res.ok) return
        const better = (await res.json()) as Analysis
        if (better?.primary?.kind === 'REPLY' && better.primary.replies?.length) {
          setAnalysis((current) => (current?.text === local.text ? better : current))
        }
      } catch {
        // Le risposte locali sono già sullo schermo: non succede niente.
      }
    },
    [record],
  )

  /**
   * Lettura sul dispositivo. È il ripiego quando il modello remoto non c'è,
   * ed è anche la strada più privata: l'immagine non parte per nessun posto.
   */
  const readHere = useCallback(
    async (file: Blob, notConfigured: boolean) => {
      setOnDevice(true)
      setReadingStep(0)
      try {
        const { text } = await readOnDevice(file)
        if (!text || text.replace(/\s/g, '').length < 3) {
          setError(
            notConfigured
              ? 'Read on your device, but no text came out of that image. Try again closer, or with more light.'
              : 'No text came out of that image. Try again closer, or with more light.',
          )
          setView('home')
          return
        }
        record(analyze(text, { source: 'image', usedAI: false }))
      } catch {
        setError('That image could not be read. Typing and pasting work in the meantime.')
        setView('home')
      } finally {
        setOnDevice(false)
      }
    },
    [record],
  )

  /** Immagine: prima il codice letto sul dispositivo, poi — solo se serve — l'AI. */
  const runImage = useCallback(
    async (file: Blob) => {
      setError(null)
      setPreview(null)
      setReadingStep(0)
      setView('analyzing')

      let dataUrl = ''
      try {
        dataUrl = await prepareImage(file)
        setPreview(dataUrl)
      } catch {
        setError('That file could not be read.')
        setView('home')
        return
      }

      const code = await readBarcode(file)
      if (code) {
        record(analyze(expandQrPayload(code), { source: 'qr' }))
        return
      }

      try {
        const res = await fetch('/api/onetap/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: dataUrl }),
        })
        const body = await res.json()
        if (!res.ok) {
          // Nessuna chiave, o il modello non risponde: si legge qui, sul
          // dispositivo, invece di lasciare l'utente a mani vuote.
          await readHere(file, body?.code === 'AI_NOT_CONFIGURED')
          return
        }
        record(body as Analysis)
      } catch {
        await readHere(file, false)
      }
    },
    [record, readHere],
  )

  /* ------------------------------------------------------------ *
   * Ingressi: share sheet di sistema, incolla, trascina
   * ------------------------------------------------------------ */

  const sharedFlag = searchParams.get('shared')
  const sharedText = searchParams.get('text') ?? searchParams.get('title')
  const sharedUrl = searchParams.get('url')

  // Messaggio derivato: niente stato, niente effetto.
  const shareNotice =
    sharedFlag === 'retry' || sharedFlag === 'failed' ? SHARE_RETRY_NOTICE : null

  useEffect(() => {
    if (!store.hydrated) return

    if (!sharedText && !sharedUrl && sharedFlag !== '1') return

    // L'URL è già stato consumato: si ripulisce subito, così un refresh non
    // rianalizza la stessa cosa. replaceState e non router.replace: qui non
    // serve una navigazione, solo una barra degli indirizzi pulita.
    window.history.replaceState(null, '', '/onetap')

    void (async () => {
      if (sharedText || sharedUrl) {
        await runText([sharedText, sharedUrl].filter(Boolean).join('\n'), 'share')
        return
      }
      try {
        const cache = await caches.open('onetap-share')
        const hit = await cache.match('/onetap/__shared__')
        if (!hit) {
          setError('The shared image did not arrive. Try sharing it again.')
          return
        }
        const blob = await hit.blob()
        await cache.delete('/onetap/__shared__')
        await runImage(blob)
      } catch {
        setError('The shared image could not be read.')
      }
    })()
  }, [store.hydrated, sharedFlag, sharedText, sharedUrl, runText, runImage])

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items
      if (items) {
        for (const item of items) {
          if (!item.type.startsWith('image/')) continue
          const file = item.getAsFile()
          if (file) {
            event.preventDefault()
            void runImage(file)
            return
          }
        }
      }
      // Incollare del testo fuori da un campo equivale a catturarlo.
      const target = event.target as HTMLElement | null
      const inField = !!target?.closest?.('input, textarea, [contenteditable]')
      const text = event.clipboardData?.getData('text')
      if (!inField && text?.trim()) {
        event.preventDefault()
        void runText(text)
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [runImage, runText])

  useEffect(() => {
    // Unico scopo: ricevere gli screenshot dallo share sheet del sistema.
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/onetap/sw.js').catch(() => {})
    }
  }, [])

  useEffect(() => {
    // Se la lettura immagini non è configurata su questo deploy, meglio dirlo
    // sulla home che farlo scoprire dopo uno scatto andato a vuoto.
    void (async () => {
      try {
        const res = await fetch('/api/onetap/analyze')
        const body = await res.json()
        setImagesConfigured(!!body?.configured)
      } catch {
        setImagesConfigured(null)
      }
    })()
  }, [])

  useEffect(() => {
    if (view !== 'analyzing') return
    const id = setInterval(
      () => setReadingStep((step) => Math.min(step + 1, READING_STEPS.length - 1)),
      1100,
    )
    return () => clearInterval(id)
  }, [view])

  /* ------------------------------------------------------------ *
   * Azioni eseguite
   * ------------------------------------------------------------ */

  const onPerformed = useCallback((action: SuggestedAction) => {
    const count = recordAction(action, action.subject)
    // Il limite non blocca: lo si racconta una volta sola, quando viene superato.
    if (count === FREE_ACTIONS_PER_MONTH + 1) setSheet('pro')
  }, [])

  /** Mirino dentro all'app dove il browser lo consente, fotocamera di sistema altrove. */
  const openCamera = useCallback(() => {
    if (typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getUserMedia === 'function') setView('camera')
    else cameraRef.current?.click()
  }, [])

  const reset = useCallback(() => {
    setAnalysis(null)
    setPreview(null)
    setError(null)
    setView('home')
  }, [])

  const pasteFromButton = useCallback(async () => {
    const image = await imageFromClipboard()
    if (image) {
      await runImage(image)
      return
    }
    const text = await textFromClipboard()
    if (text) {
      await runText(text)
      return
    }
    setError(
      platform === 'other'
        ? 'Nothing in the clipboard. Copy a screenshot, then press ⌘V anywhere here.'
        : 'Nothing in the clipboard yet.',
    )
  }, [platform, runImage, runText])

  const replayHistory = useCallback(
    async (item: HistoryItem) => {
      const action: SuggestedAction = {
        kind: item.action,
        label: item.label,
        subject: item.preview,
        value: item.value,
        score: 1,
        entity: { kind: 'title', value: item.value, raw: item.value, start: 0, end: item.value.length },
        event: item.event,
        contact: item.contact,
      }
      const href = actionHref(action, platform, 'en')
      if (href) {
        window.open(href, opensInNewTab(item.action) ? '_blank' : '_self')
        return
      }
      await runAction(action, 'en')
    },
    [platform],
  )

  /* ------------------------------------------------------------ *
   * Rendering
   * ------------------------------------------------------------ */

  if (!store.hydrated) return <div className="ot" aria-busy="true" />

  // L'introduzione non fa più da cancello: si apre sulla home, pronta all'uso.
  // Il momento magico resta raggiungibile da "How it works", per chi lo vuole.
  if (intro) {
    return (
      <div className="ot">
        <Onboarding
          onFinish={() => {
            markOnboarded()
            setIntro(false)
          }}
        />
      </div>
    )
  }

  return (
    <div
      className="ot"
      onDragOver={(event) => {
        event.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault()
        setDragging(false)
        const file = event.dataTransfer.files?.[0]
        if (file?.type.startsWith('image/')) void runImage(file)
      }}
    >
      {view === 'camera' && (
        <Camera
          onShot={(photo) => void runImage(photo)}
          onClose={() => setView('home')}
          onPickFile={() => {
            setView('home')
            libraryRef.current?.click()
          }}
        />
      )}

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) void runImage(file)
        }}
      />
      <input
        ref={libraryRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) void runImage(file)
        }}
      />

      <div className="relative mx-auto flex min-h-full w-full max-w-[460px] flex-col">
        <header className="flex items-center justify-between px-6 pt-6">
          {view === 'home' ? (
            <>
              <span className="ot-wordmark text-[13px] text-white/70">One Tap</span>
              <button
                onClick={() => setSheet('privacy')}
                className="ot-ghost text-[12px] uppercase tracking-[0.18em]"
              >
                Privacy
              </button>
            </>
          ) : (
            <>
              <button onClick={reset} aria-label="Close" className="ot-ghost -ml-2 p-2">
                <CloseIcon className="h-5 w-5" />
              </button>
              <span className="ot-wordmark text-[13px] text-white/40">One Tap</span>
              <span className="w-9" />
            </>
          )}
        </header>

        {view === 'home' && (
          <Home
            notice={error ?? shareNotice}
            imagesConfigured={imagesConfigured}
            dragging={dragging}
            history={store.history}
            used={store.used}
            onCapture={openCamera}
            onLibrary={() => libraryRef.current?.click()}
            onPaste={pasteFromButton}
            onText={runText}
            onDemo={() => setSheet('demo')}
            onIntro={() => setIntro(true)}
            onPro={() => setSheet('pro')}
            onReplay={replayHistory}
            onDelete={removeFromHistory}
            onClearAll={clearHistory}
          />
        )}

        {view === 'analyzing' && (
          <Analyzing
            preview={preview}
            step={(onDevice ? ON_DEVICE_STEPS : READING_STEPS)[readingStep]}
          />
        )}

        {view === 'result' && analysis && (
          <ActionCard analysis={analysis} onPerformed={onPerformed} onRestart={reset} />
        )}
      </div>

      {sheet === 'privacy' && (
        <PrivacySheet onClose={() => setSheet(null)} actionsUsed={store.used} onWipe={wipeEverything} />
      )}
      {sheet === 'pro' && <ProSheet onClose={() => setSheet(null)} actionsUsed={store.used} />}
      {sheet === 'demo' && (
        <DemoSheet
          onClose={() => setSheet(null)}
          onRun={(scenario: DemoScenario) => {
            setSheet(null)
            void runText(demoText(scenario), 'demo')
          }}
        />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Home
 * ------------------------------------------------------------------ */

function Home({
  notice,
  imagesConfigured,
  dragging,
  history,
  used,
  onCapture,
  onLibrary,
  onPaste,
  onText,
  onDemo,
  onIntro,
  onPro,
  onReplay,
  onDelete,
  onClearAll,
}: {
  notice: string | null
  imagesConfigured: boolean | null
  dragging: boolean
  history: HistoryItem[]
  used: number
  onCapture: () => void
  onLibrary: () => void
  onPaste: () => void
  onText: (text: string) => void
  onDemo: () => void
  onIntro: () => void
  onPro: () => void
  onReplay: (item: HistoryItem) => void
  onDelete: (id: string) => void
  onClearAll: () => void
}) {
  const [typing, setTyping] = useState(false)
  const [draft, setDraft] = useState('')
  const [listening, setListening] = useState(false)
  const draftRef = useRef<HTMLTextAreaElement>(null)

  const left = Math.max(0, FREE_ACTIONS_PER_MONTH - used)
  const recent = history.slice(0, 5)

  function openDraft() {
    setTyping((open) => !open)
    requestAnimationFrame(() => draftRef.current?.focus())
  }

  function startVoice() {
    const Ctor = speechRecognitionCtor()
    if (!Ctor) {
      setTyping(true)
      requestAnimationFrame(() => draftRef.current?.focus())
      return
    }
    const recognition = new Ctor()
    recognition.lang = navigator.language || 'en-US'
    recognition.interimResults = false
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? ''
      setListening(false)
      if (transcript.trim()) onText(transcript)
    }
    recognition.onerror = () => setListening(false)
    recognition.onend = () => setListening(false)
    setListening(true)
    recognition.start()
  }

  return (
    <div className="ot-rise flex flex-1 flex-col px-6 pb-10 pt-16">
      <h1 className="ot-display text-[38px] font-extrabold leading-[1.05]">What do you want to do?</h1>

      <button onClick={onCapture} className="ot-tap mt-9">
        <CameraIcon className="h-5 w-5" />
        Capture
      </button>

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <button onClick={onPaste} className="ot-chip">Paste screenshot</button>
        <button onClick={onLibrary} className="ot-chip">Photos</button>
        <button onClick={openDraft} className="ot-chip">Type or speak</button>
      </div>

      {typing && (
        <div className="ot-rise mt-5">
          <textarea
            ref={draftRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) onText(draft)
            }}
            rows={3}
            placeholder="Paste or type what you see…"
            className="ot-card w-full resize-none px-5 py-4 text-[16px] leading-relaxed text-white outline-none placeholder:text-white/30"
          />
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => onText(draft)}
              disabled={!draft.trim()}
              className="ot-chip disabled:opacity-40"
            >
              Go
            </button>
            <button onClick={startVoice} className="ot-chip">
              {listening ? <span className="ot-pulse">Listening…</span> : 'Speak'}
            </button>
          </div>
        </div>
      )}

      <Link
        href="/onetap/install"
        className="ot-ghost mt-6 block w-full text-center text-[13px] underline underline-offset-4"
      >
        Share to ONE TAP
      </Link>

      {imagesConfigured === false && (
        <p className="ot-card ot-rise mt-6 border-amber-300/25 bg-amber-300/5 px-5 py-4 text-[14px] leading-relaxed text-amber-200/90">
          <strong className="text-amber-100">No AI key on this deployment — photos are read on your device.</strong>{' '}
          It still works: the first photo downloads the reader once, then nothing ever leaves your phone.
          Set an AI key in the hosting environment for faster and sharper reading.
        </p>
      )}

      {notice && (
        <p className="ot-card ot-rise mt-6 px-5 py-4 text-[14px] leading-relaxed text-amber-200/90">
          {notice}
        </p>
      )}

      {dragging && <p className="mt-6 text-center text-[13px] text-white/60">Drop the screenshot anywhere.</p>}

      {recent.length > 0 && (
        <section className="mt-14">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--ot-muted)]">
              Recent
            </h2>
            <button onClick={onClearAll} className="ot-ghost text-[12px]">Clear</button>
          </div>

          <ul className="mt-3 divide-y divide-white/6">
            {recent.map((item) => (
              <li key={item.id} className="flex items-center gap-3 py-3">
                <button
                  onClick={() => onReplay(item)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <ActionIcon kind={item.action} className="h-4 w-4 shrink-0 text-[var(--ot-muted)]" />
                  <span className="ot-display shrink-0 text-[13px] font-bold tracking-tight">
                    {ACTION_LABEL[item.action]}
                  </span>
                  <span className="truncate text-[14px] text-[var(--ot-muted)]">— {item.preview}</span>
                </button>
                <button onClick={() => onDelete(item.id)} aria-label="Delete" className="ot-ghost shrink-0 p-1.5">
                  <TrashIcon className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="mt-auto flex items-center justify-between pt-16 text-[12px] text-white/30">
        <span className="flex gap-4">
          <button onClick={onDemo} className="ot-ghost underline underline-offset-4">Demo</button>
          <button onClick={onIntro} className="ot-ghost underline underline-offset-4">How it works</button>
        </span>
        <button onClick={onPro} className="ot-ghost">
          {left} of {FREE_ACTIONS_PER_MONTH} free actions left
        </button>
      </footer>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Analisi in corso
 * ------------------------------------------------------------------ */

function Analyzing({ preview, step }: { preview: string | null; step: string }) {
  return (
    <div className="ot-rise flex flex-col items-center px-6 pt-16">
      <div className="ot-shot relative w-full max-w-[300px]">
        <div className="ot-scan" />
        {preview ? (
          // Anteprima locale: non passa da next/image perché il file non lascia il dispositivo.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="block w-full opacity-70" />
        ) : (
          <div className="aspect-[3/4] w-full" />
        )}
      </div>
      <p className="ot-pulse mt-8 text-[14px] uppercase tracking-[0.24em] text-white/70">{step}</p>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Dettatura (dove il browser la offre)
 * ------------------------------------------------------------------ */

interface SpeechRecognitionLike {
  lang: string
  interimResults: boolean
  onresult: (event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void
  onerror: () => void
  onend: () => void
  start: () => void
}

function speechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  const w = globalThis as {
    SpeechRecognition?: new () => SpeechRecognitionLike
    webkitSpeechRecognition?: new () => SpeechRecognitionLike
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}
