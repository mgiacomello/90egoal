'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import Avatar, { CAPELLI_FONDO, CAPELLI_TOP, FINE_CAPELLI } from './Avatar'
import {
  ACCONCIATURE,
  PENNELLI,
  COLORI_CAPELLI,
  COLORI_OCCHI,
  COLORI_VESTITO,
  FANTASIE,
  FARD,
  LOOK_BASE,
  MODELLE,
  OCCHIALI,
  OMBRETTI,
  PELLI,
  ROSSETTI,
  SFONDI,
  TESTA,
  VESTITI,
  lookCasuale,
  completaLook,
  type Look,
  type Opzione,
  type StrumentoTrucco,
  type Traccia,
} from './data'

type Tab = 'modella' | 'capelli' | 'trucco' | 'vestiti' | 'foto'

type Scatto = { id: string; nome: string; quando: number; look: Look }

const TABS: { id: Tab; label: string; emoji: string }[] = [
  { id: 'modella', label: 'Modella', emoji: '🙋‍♀️' },
  { id: 'capelli', label: 'Capelli', emoji: '✂️' },
  { id: 'trucco', label: 'Trucco', emoji: '💄' },
  { id: 'vestiti', label: 'Vestiti', emoji: '👗' },
  { id: 'foto', label: 'Foto', emoji: '📸' },
]

const CHIAVE_BOOK = 'salone-book-v1'
const MAX_BOOK = 12

/* Il book vive nel localStorage: lo leggiamo come "store esterno" così la
   pagina si idrata senza differenze fra server e browser. */
let bookCache: string | null = null
let bookLetto = false
const ascoltatori = new Set<() => void>()

function iscriviBook(callback: () => void) {
  ascoltatori.add(callback)
  return () => {
    ascoltatori.delete(callback)
  }
}

function leggiBook(): string | null {
  if (!bookLetto) {
    try {
      bookCache = window.localStorage.getItem(CHIAVE_BOOK)
    } catch {
      bookCache = null
    }
    bookLetto = true
  }
  return bookCache
}

function scriviBook(valore: string) {
  window.localStorage.setItem(CHIAVE_BOOK, valore)
  bookCache = valore
  bookLetto = true
  ascoltatori.forEach((f) => f())
}

/* ---------- pezzi di interfaccia ---------- */

function Sezione({ titolo, aiuto, children }: { titolo: string; aiuto?: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="font-display font-bold text-[15px] text-white mb-1">{titolo}</h3>
      {aiuto && <p className="text-xs text-[var(--muted)] mb-2.5">{aiuto}</p>}
      <div className={aiuto ? '' : 'mt-2.5'}>{children}</div>
    </div>
  )
}

function BottoneOpzione({
  attivo,
  onClick,
  emoji,
  label,
}: {
  attivo: boolean
  onClick: () => void
  emoji?: string
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={attivo}
      className={`flex items-center gap-2 rounded-2xl px-3.5 py-3 text-sm font-semibold min-h-[52px] text-left transition ${
        attivo
          ? 'bg-[#ff5fa2] text-[#2b0a1b] shadow-[0_10px_26px_-12px_rgba(255,95,162,0.9)]'
          : 'bg-white/5 text-white/85 border border-white/10 hover:bg-white/10'
      }`}
    >
      {emoji && <span className="text-lg leading-none">{emoji}</span>}
      <span>{label}</span>
    </button>
  )
}

function Pastiglie({
  opzioni,
  valore,
  onChange,
  conNessuno,
}: {
  opzioni: Opzione[]
  valore: string | null
  onChange: (v: string | null) => void
  conNessuno?: boolean
}) {
  return (
    <div className="flex flex-wrap gap-2.5">
      {conNessuno && (
        <button
          type="button"
          onClick={() => onChange(null)}
          title="Niente"
          aria-label="Niente"
          aria-pressed={valore === null}
          className={`w-12 h-12 rounded-full grid place-items-center text-lg transition ${
            valore === null ? 'ring-4 ring-white scale-105' : 'ring-2 ring-white/20 hover:scale-105'
          } bg-white/10`}
        >
          🚫
        </button>
      )}
      {opzioni.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.colore)}
          title={o.label}
          aria-label={o.label}
          aria-pressed={valore === o.colore}
          className={`w-12 h-12 rounded-full transition ${
            valore === o.colore ? 'ring-4 ring-white scale-105' : 'ring-2 ring-white/20 hover:scale-105'
          }`}
          style={{ backgroundColor: o.colore }}
        />
      ))}
    </div>
  )
}

function Interruttore({
  attivo,
  onChange,
  label,
  emoji,
}: {
  attivo: boolean
  onChange: (v: boolean) => void
  label: string
  emoji: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={attivo}
      onClick={() => onChange(!attivo)}
      className={`flex items-center justify-between gap-3 rounded-2xl px-4 py-3 min-h-[52px] w-full text-sm font-semibold transition ${
        attivo ? 'bg-[#ff5fa2] text-[#2b0a1b]' : 'bg-white/5 text-white/85 border border-white/10'
      }`}
    >
      <span className="flex items-center gap-2">
        <span className="text-lg">{emoji}</span>
        {label}
      </span>
      <span className={`w-11 h-6 rounded-full p-0.5 flex ${attivo ? 'bg-[#2b0a1b]/30 justify-end' : 'bg-white/15 justify-start'}`}>
        <span className="w-5 h-5 rounded-full bg-white" />
      </span>
    </button>
  )
}

function Cursore({
  label,
  valore,
  min,
  max,
  step,
  onChange,
  formato,
}: {
  label: string
  valore: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  formato?: (v: number) => string
}) {
  return (
    <label className="block mb-4">
      <span className="flex items-center justify-between text-sm font-semibold text-white/85 mb-2">
        <span>{label}</span>
        <span className="text-[var(--muted)] font-normal">{formato ? formato(valore) : valore}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={valore}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-3 accent-[#ff5fa2] cursor-pointer"
      />
    </label>
  )
}

const LUNG_MIN = 0.2
const LUNG_MAX = 1.6
const ALTEZZA_SVG = 400

// Il punto toccato sul ritratto diventa la nuova lunghezza dei capelli.
function lunghezzaDaY(ySvg: number): number {
  const quota = (ySvg - CAPELLI_TOP) / (CAPELLI_FONDO - CAPELLI_TOP)
  return Math.max(LUNG_MIN, Math.min(LUNG_MAX, quota))
}

// "Snip": due schiocchi brevissimi, senza file audio.
function suonoForbici() {
  try {
    const Contesto = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Contesto) return
    const ctx = new Contesto()
    const schiocco = (ritardo: number) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(2600, ctx.currentTime + ritardo)
      osc.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + ritardo + 0.05)
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + ritardo)
      gain.gain.exponentialRampToValueAtTime(0.14, ctx.currentTime + ritardo + 0.005)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + ritardo + 0.07)
      osc.connect(gain).connect(ctx.destination)
      osc.start(ctx.currentTime + ritardo)
      osc.stop(ctx.currentTime + ritardo + 0.09)
    }
    schiocco(0)
    schiocco(0.09)
    window.setTimeout(() => void ctx.close(), 400)
  } catch {
    /* niente audio: pazienza */
  }
}

// Trascinare i capelli con le dita: su = coda (o chignon in cima),
// di lato = treccine, giù = sciolti.
function acconciaturaDaGesto(g: Gesto): { id: string; nome: string; emoji: string } | null {
  const dx = g.x - g.x0
  const dy = g.y - g.y0
  if (dy < -35 && g.y < 96) return { id: 'chignon', nome: 'Chignon', emoji: '🩰' }
  if (dy < -35 && Math.abs(dy) > Math.abs(dx)) return { id: 'coda', nome: 'Coda alta', emoji: '🐴' }
  if (Math.abs(dx) > 45) return { id: 'trecce', nome: 'Treccine', emoji: '🧶' }
  if (dy > 35) return { id: 'lunghi', nome: 'Capelli sciolti', emoji: '💇‍♀️' }
  return null
}

type Ciocca = { id: number; x: number; y: number; ruota: number; colore: string }
type Bolla = { id: number; x: number; y: number; r: number }
type Strumento = 'mani' | 'forbici' | 'shampoo' | StrumentoTrucco | 'gomma'
type Gesto = { x0: number; y0: number; x: number; y: number }

const MAX_PENNELLATE = 80
const MAX_PUNTI = 500
const LARGHEZZA_SVG = 320

/* ---------- gioco ---------- */

export default function SaloneGame() {
  const [look, setLook] = useState<Look>(MODELLE[0].look)
  const [tab, setTab] = useState<Tab>('modella')
  const bookGrezzo = useSyncExternalStore(iscriviBook, leggiBook, () => null)
  const book = useMemo<Scatto[]>(() => {
    if (!bookGrezzo) return []
    try {
      return JSON.parse(bookGrezzo) as Scatto[]
    } catch {
      return []
    }
  }, [bookGrezzo])
  const [avviso, setAvviso] = useState<string | null>(null)
  const [strumentoCapelli, setStrumentoCapelli] = useState<'mani' | 'forbici' | 'shampoo'>('forbici')
  const [gesto, setGesto] = useState<Gesto | null>(null)
  const [strumentoTrucco, setStrumentoTrucco] = useState<StrumentoTrucco | 'gomma'>('rossetto')
  const [coloriPennello, setColoriPennello] = useState<Record<StrumentoTrucco, string>>({
    rossetto: PENNELLI[0].colori[0].colore,
    ombretto: PENNELLI[1].colori[0].colore,
    fard: PENNELLI[2].colori[0].colore,
    glitter: PENNELLI[3].colori[0].colore,
  })
  const [schiuma, setSchiuma] = useState(0)
  const [bolle, setBolle] = useState<Bolla[]>([])
  const [risciacquo, setRisciacquo] = useState(false)
  const [audio, setAudio] = useState(true)
  const [rigaTaglio, setRigaTaglio] = useState<number | null>(null)
  const [ciocche, setCiocche] = useState<Ciocca[]>([])
  const exportRef = useRef<SVGSVGElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const palcoRef = useRef<HTMLDivElement>(null)
  const animazione = useRef<number | null>(null)
  const contaCiocche = useRef(0)
  const contaBolle = useRef(0)
  const contaTracce = useRef(0)
  const premuto = useRef(false)

  const aggiorna = useCallback(<K extends keyof Look>(chiave: K, valore: Look[K]) => {
    setLook((l) => ({ ...l, [chiave]: valore }))
  }, [])

  // Porta la lunghezza al valore voluto in mezzo secondo, così si vede il gesto.
  const animaLunghezza = useCallback((verso: number, durata = 320) => {
    if (animazione.current !== null) window.cancelAnimationFrame(animazione.current)
    const partenza = performance.now()
    let da: number | null = null
    const passo = (ora: number) => {
      setLook((l) => {
        if (da === null) da = l.lunghezza
        const t = Math.min(1, (ora - partenza) / durata)
        const morbido = 1 - Math.pow(1 - t, 3)
        return { ...l, lunghezza: da + (verso - da) * morbido }
      })
      if (ora - partenza < durata) {
        animazione.current = window.requestAnimationFrame(passo)
      } else {
        animazione.current = null
      }
    }
    animazione.current = window.requestAnimationFrame(passo)
  }, [])

  useEffect(() => () => {
    if (animazione.current !== null) window.cancelAnimationFrame(animazione.current)
  }, [])

  useEffect(() => {
    if (!avviso) return
    const t = window.setTimeout(() => setAvviso(null), 4000)
    return () => window.clearTimeout(t)
  }, [avviso])

  function salvaBook(prossimo: Scatto[]) {
    try {
      scriviBook(JSON.stringify(prossimo))
      return true
    } catch {
      setAvviso('Il book è pieno: cancella qualche look per farne spazio.')
      return false
    }
  }

  // La foto non esce mai dal dispositivo: la rimpiccioliamo e la teniamo in memoria.
  function caricaFoto(file: File) {
    if (!file.type.startsWith('image/')) {
      setAvviso('Scegli un file immagine (jpg, png…).')
      return
    }
    const lettore = new FileReader()
    lettore.onload = () => {
      const img = new window.Image()
      img.onload = () => {
        const lato = 720
        const scala = Math.min(1, lato / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scala)
        canvas.height = Math.round(img.height * scala)
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        setLook((l) => ({
          ...l,
          foto: canvas.toDataURL('image/jpeg', 0.85),
          fotoZoom: 1,
          fotoX: 0,
          fotoY: 0,
          fotoRot: 0,
        }))
        setAvviso('Foto caricata! Usa i cursori per centrare il viso nella sagoma.')
      }
      img.onerror = () => setAvviso('Non riesco ad aprire questa immagine.')
      img.src = String(lettore.result)
    }
    lettore.onerror = () => setAvviso('Non riesco a leggere il file.')
    lettore.readAsDataURL(file)
  }

  async function scaricaPng() {
    const svg = exportRef.current
    if (!svg) return
    const xml = new XMLSerializer().serializeToString(svg)
    const sorgente = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`
    const nomeFile = `${(look.nome || 'look').replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase()}-salone.png`
    try {
      const img = new window.Image()
      await new Promise<void>((risolvi, rifiuta) => {
        img.onload = () => risolvi()
        img.onerror = () => rifiuta(new Error('svg'))
        img.src = sorgente
      })
      const canvas = document.createElement('canvas')
      canvas.width = 320 * 3
      canvas.height = 400 * 3
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('canvas')
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'))
      if (!blob) throw new Error('blob')
      const url = URL.createObjectURL(blob)
      scarica(url, nomeFile)
      URL.revokeObjectURL(url)
      setAvviso('Foto salvata nei download! 🎉')
    } catch {
      // Se il browser non lascia convertire in PNG, salviamo comunque il disegno.
      scarica(sorgente, nomeFile.replace(/\.png$/, '.svg'))
      setAvviso('Salvata come immagine SVG (il PNG non era disponibile).')
    }
  }

  function scarica(url: string, nome: string) {
    const a = document.createElement('a')
    a.href = url
    a.download = nome
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  const stileAttivo = ACCONCIATURE.find((a) => a.id === look.capelli) ?? ACCONCIATURE[0]
  const strumentoAttivo: Strumento | null =
    tab === 'capelli' ? strumentoCapelli : tab === 'trucco' ? strumentoTrucco : null
  const modoTaglio = strumentoAttivo === 'forbici'
  const puoTagliare = modoTaglio && stileAttivo.allungabile
  const pennellate = look.pennellate ?? []

  function puntoDaEvento(e: React.PointerEvent<HTMLDivElement>): { x: number; y: number } | null {
    const area = palcoRef.current?.getBoundingClientRect()
    if (!area || area.height === 0 || area.width === 0) return null
    return {
      x: ((e.clientX - area.left) / area.width) * LARGHEZZA_SVG,
      y: ((e.clientY - area.top) / area.height) * ALTEZZA_SVG,
    }
  }

  /* ---- forbici ---- */

  function taglia(y: number) {
    if (!stileAttivo.allungabile) {
      setAvviso('Questo taglio è già cortissimo: scegline uno lungo per usare le forbici.')
      return
    }
    setRigaTaglio(y)
    const nuova = lunghezzaDaY(y)
    if (nuova >= look.lunghezza - 0.03) {
      setAvviso('Le forbici accorciano soltanto! Per allungarli usa 🪄 Fai ricrescere.')
      return
    }
    const cadute: Ciocca[] = Array.from({ length: 10 }, () => {
      contaCiocche.current += 1
      return {
        id: contaCiocche.current,
        x: 14 + Math.random() * 72,
        y: (y / ALTEZZA_SVG) * 100,
        ruota: Math.random() * 180 - 90,
        colore: look.capelliColore,
      }
    })
    const idCadute = new Set(cadute.map((c) => c.id))
    setCiocche((c) => [...c, ...cadute])
    window.setTimeout(() => setCiocche((c) => c.filter((x) => !idCadute.has(x.id))), 1300)
    if (audio) suonoForbici()
    animaLunghezza(nuova)
  }

  /* ---- shampoo ---- */

  function insapona(p: { x: number; y: number }) {
    const nuove: Bolla[] = Array.from({ length: 2 }, () => {
      contaBolle.current += 1
      return {
        id: contaBolle.current,
        x: ((p.x + (Math.random() * 40 - 20)) / LARGHEZZA_SVG) * 100,
        y: ((p.y + (Math.random() * 34 - 17)) / ALTEZZA_SVG) * 100,
        r: 10 + Math.random() * 16,
      }
    })
    setBolle((b) => [...b, ...nuove].slice(-70))
    setSchiuma((v) => Math.min(1, v + 0.05))
  }

  function risciacqua() {
    setRisciacquo(true)
    window.setTimeout(() => {
      setBolle([])
      setSchiuma(0)
      setRisciacquo(false)
      setLook((l) => ({ ...l, lucidi: true }))
      setAvviso('Capelli lavati: puliti e lucidissimi! ✨')
    }, 700)
  }

  /* ---- trucco col dito ---- */

  function iniziaTraccia(p: { x: number; y: number }) {
    if (strumentoTrucco === 'gomma') return
    const pennello = PENNELLI.find((b) => b.id === strumentoTrucco)
    if (!pennello) return
    contaTracce.current += 1
    const traccia: Traccia = {
      id: contaTracce.current,
      tipo: pennello.id,
      colore: coloriPennello[pennello.id],
      spessore: pennello.spessore,
      punti: [Math.round(p.x), Math.round(p.y)],
    }
    setLook((l) => ({ ...l, pennellate: [...(l.pennellate ?? []).slice(-(MAX_PENNELLATE - 1)), traccia] }))
  }

  function continuaTraccia(p: { x: number; y: number }) {
    setLook((l) => {
      const tutte = l.pennellate ?? []
      const ultima = tutte[tutte.length - 1]
      if (!ultima || ultima.punti.length >= MAX_PUNTI) return l
      const dx = p.x - ultima.punti[ultima.punti.length - 2]
      const dy = p.y - ultima.punti[ultima.punti.length - 1]
      if (dx * dx + dy * dy < 16) return l
      const agg: Traccia = { ...ultima, punti: [...ultima.punti, Math.round(p.x), Math.round(p.y)] }
      return { ...l, pennellate: [...tutte.slice(0, -1), agg] }
    })
  }

  function chiudiTraccia() {
    setLook((l) => {
      const tutte = l.pennellate ?? []
      const ultima = tutte[tutte.length - 1]
      if (!ultima || ultima.punti.length !== 2) return l
      // un tocco singolo: due punti vicini così il tratto si vede lo stesso
      const agg: Traccia = { ...ultima, punti: [...ultima.punti, ultima.punti[0] + 1, ultima.punti[1] + 1] }
      return { ...l, pennellate: [...tutte.slice(0, -1), agg] }
    })
  }

  function cancellaVicino(p: { x: number; y: number }) {
    setLook((l) => {
      const tutte = l.pennellate ?? []
      const restano = tutte.filter((t) => {
        for (let i = 0; i < t.punti.length; i += 2) {
          const dx = t.punti[i] - p.x
          const dy = t.punti[i + 1] - p.y
          if (dx * dx + dy * dy < 22 * 22) return false
        }
        return true
      })
      return restano.length === tutte.length ? l : { ...l, pennellate: restano }
    })
  }

  /* ---- mani: coda, treccine, chignon ---- */

  function fineGesto() {
    if (!gesto) return
    const scelta = acconciaturaDaGesto(gesto)
    setGesto(null)
    if (!scelta) {
      setAvviso('Trascina un po\u2019 di più: su per la coda, di lato per le treccine.')
      return
    }
    if (look.capelli === scelta.id) return
    aggiorna('capelli', scelta.id)
    setAvviso(`${scelta.emoji} ${scelta.nome}!`)
  }

  /* ---- gesti sul ritratto ---- */

  function giuSulPalco(e: React.PointerEvent<HTMLDivElement>) {
    if (!strumentoAttivo) return
    const p = puntoDaEvento(e)
    if (!p) return
    premuto.current = true
    e.currentTarget.setPointerCapture?.(e.pointerId)
    if (strumentoAttivo === 'mani') setGesto({ x0: p.x, y0: p.y, x: p.x, y: p.y })
    else if (strumentoAttivo === 'forbici') taglia(p.y)
    else if (strumentoAttivo === 'shampoo') insapona(p)
    else if (strumentoAttivo === 'gomma') cancellaVicino(p)
    else iniziaTraccia(p)
  }

  function muoviSulPalco(e: React.PointerEvent<HTMLDivElement>) {
    if (!strumentoAttivo) return
    const p = puntoDaEvento(e)
    if (!p) return
    if (strumentoAttivo === 'forbici') {
      if (puoTagliare) setRigaTaglio(p.y)
      return
    }
    if (!premuto.current) return
    if (strumentoAttivo === 'mani') setGesto((g) => (g ? { ...g, x: p.x, y: p.y } : g))
    else if (strumentoAttivo === 'shampoo') insapona(p)
    else if (strumentoAttivo === 'gomma') cancellaVicino(p)
    else continuaTraccia(p)
  }

  function suSulPalco() {
    if (premuto.current) {
      if (strumentoAttivo === 'mani') fineGesto()
      else if (strumentoAttivo && strumentoAttivo !== 'forbici' && strumentoAttivo !== 'shampoo' && strumentoAttivo !== 'gomma') {
        chiudiTraccia()
      }
    }
    premuto.current = false
  }

  const anteprimaGesto = gesto ? acconciaturaDaGesto(gesto) : null
  const suggerimento =
    strumentoAttivo === 'mani'
      ? anteprimaGesto
        ? `${anteprimaGesto.emoji} lascia per fare: ${anteprimaGesto.nome}`
        : '🤲 Trascina i capelli: su = coda, di lato = treccine, giù = sciolti'
      : strumentoAttivo === 'forbici'
      ? stileAttivo.allungabile
        ? '✂️ Tocca i capelli dove vuoi tagliarli'
        : 'Scegli un taglio lungo per usare le forbici'
      : strumentoAttivo === 'shampoo'
        ? schiuma >= 1
          ? '🚿 Pieni di schiuma: ora risciacqua!'
          : '🧴 Strofina i capelli col dito'
        : strumentoAttivo === 'gomma'
          ? '🧽 Passa il dito per togliere il trucco'
          : strumentoAttivo
            ? '👆 Trucca col dito direttamente sul viso'
            : ''

  return (
    <div className="pb-4">
      <header className="text-center mb-6">
        <p className="text-xs font-semibold tracking-[0.2em] uppercase text-[#ff8fc7]">Gioco</p>
        <h1 className="font-display font-extrabold text-3xl sm:text-4xl mt-1">
          <span className="text-[#ff5fa2]">Salone</span> di Bellezza ✨
        </h1>
        <p className="text-[var(--muted)] mt-2 text-sm max-w-xl mx-auto">
          Scegli una modella (o carica una foto), poi taglia e colora i capelli, trucca il viso e scegli il vestito.
          Alla fine salva il look nel tuo book!
        </p>
      </header>

      {avviso && (
        <div className="mb-4 rounded-2xl border border-[#ff5fa2]/40 bg-[#ff5fa2]/10 px-4 py-3 text-sm text-white text-center">
          {avviso}
        </div>
      )}

      <div className="grid lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] gap-6 items-start">
        {/* palco */}
        <div className="lg:sticky lg:top-20">
          <div className="glass rounded-3xl p-3">
            <div
              ref={palcoRef}
              onPointerMove={muoviSulPalco}
              onPointerLeave={() => {
                setRigaTaglio(null)
                suSulPalco()
              }}
              onPointerDown={giuSulPalco}
              onPointerUp={suSulPalco}
              onPointerCancel={suSulPalco}
              className={`relative select-none ${strumentoAttivo ? 'cursor-crosshair touch-none' : ''}`}
            >
              <Avatar
                look={look}
                guide={tab === 'foto' && Boolean(look.foto)}
                className="w-full h-auto rounded-2xl overflow-hidden"
              />

              {puoTagliare && (
                <div
                  className="pointer-events-none absolute left-1 right-1 border-t-2 border-dashed border-white/50"
                  style={{ top: `${(FINE_CAPELLI(look.lunghezza) / ALTEZZA_SVG) * 100}%` }}
                />
              )}
              {puoTagliare && rigaTaglio !== null && (
                <div
                  className="pointer-events-none absolute left-0 right-0"
                  style={{ top: `${(rigaTaglio / ALTEZZA_SVG) * 100}%` }}
                >
                  <div className="border-t-[3px] border-dashed border-[#ff2d87]" />
                  <span className="absolute -top-4 -left-1 text-2xl drop-shadow">✂️</span>
                </div>
              )}
              {ciocche.map((c) => (
                <span
                  key={c.id}
                  className="salone-ciocca"
                  style={{
                    left: `${c.x}%`,
                    top: `${c.y}%`,
                    backgroundColor: c.colore,
                    ['--ruota' as string]: `${c.ruota}deg`,
                  }}
                />
              ))}
              {gesto && (
                <svg
                  viewBox={`0 0 ${LARGHEZZA_SVG} ${ALTEZZA_SVG}`}
                  className="pointer-events-none absolute inset-0 w-full h-full"
                >
                  <line
                    x1={gesto.x0}
                    y1={gesto.y0}
                    x2={gesto.x}
                    y2={gesto.y}
                    stroke="#ff2d87"
                    strokeWidth={5}
                    strokeLinecap="round"
                    strokeDasharray="10 8"
                  />
                  <circle cx={gesto.x0} cy={gesto.y0} r={9} fill="#ff2d87" opacity={0.85} />
                  <circle cx={gesto.x} cy={gesto.y} r={13} fill="#ffffff" opacity={0.85} />
                </svg>
              )}
              {bolle.map((b) => (
                <span
                  key={b.id}
                  className={`salone-bolla${risciacquo ? ' via' : ''}`}
                  style={{ left: `${b.x}%`, top: `${b.y}%`, width: b.r, height: b.r }}
                />
              ))}
              {suggerimento && (
                <div className="pointer-events-none absolute inset-x-0 bottom-2 text-center">
                  <span className="inline-block rounded-full bg-black/55 text-white text-[11px] font-semibold px-3 py-1.5 backdrop-blur">
                    {suggerimento}
                  </span>
                </div>
              )}
            </div>
            {strumentoAttivo === 'shampoo' && (
              <button
                type="button"
                onClick={risciacqua}
                disabled={bolle.length === 0 || risciacquo}
                className="mt-3 w-full rounded-2xl bg-[#5ec8e5] text-[#04222b] py-3 text-sm font-bold disabled:opacity-40 hover:brightness-110 transition"
              >
                🚿 Risciacqua {schiuma >= 1 ? '(pieni di schiuma!)' : ''}
              </button>
            )}
            {tab === 'trucco' && pennellate.length > 0 && (
              <div className="grid grid-cols-2 gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => setLook((l) => ({ ...l, pennellate: (l.pennellate ?? []).slice(0, -1) }))}
                  className="btn-ghost text-sm py-2.5 font-semibold"
                >
                  ↩️ Annulla
                </button>
                <button
                  type="button"
                  onClick={() => setLook((l) => ({ ...l, pennellate: [] }))}
                  className="btn-ghost text-sm py-2.5 font-semibold"
                >
                  🧽 Struccala
                </button>
              </div>
            )}
            <div className="mt-3 px-1">
              <label className="block">
                <span className="text-xs text-[var(--muted)]">Come si chiama?</span>
                <input
                  value={look.nome}
                  onChange={(e) => aggiorna('nome', e.target.value.slice(0, 20))}
                  placeholder="Il suo nome"
                  className="mt-1 w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white font-display font-bold text-lg text-center outline-none focus:border-[#ff5fa2]"
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <button
                type="button"
                onClick={() => setLook((l) => lookCasuale(l))}
                className="btn-ghost text-sm py-3 font-semibold"
              >
                🎲 Sorpresa!
              </button>
              <button
                type="button"
                onClick={() => {
                  const scatto: Scatto = {
                    id: `${Date.now()}`,
                    nome: look.nome || 'Senza nome',
                    quando: Date.now(),
                    look,
                  }
                  if (salvaBook([scatto, ...book].slice(0, MAX_BOOK))) {
                    setAvviso('Look salvato nel book! 💖')
                  }
                }}
                className="rounded-2xl bg-[#ff5fa2] text-[#2b0a1b] text-sm py-3 font-bold hover:brightness-110 transition"
              >
                💖 Salva look
              </button>
            </div>
          </div>
        </div>

        {/* pannello degli strumenti */}
        <div>
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-current={tab === t.id}
                className={`shrink-0 rounded-2xl px-4 py-3 text-sm font-bold transition min-h-[52px] ${
                  tab === t.id
                    ? 'bg-white text-[#2b0a1b]'
                    : 'bg-white/5 text-white/80 border border-white/10 hover:bg-white/10'
                }`}
              >
                <span className="mr-1.5">{t.emoji}</span>{' '}
                {t.label}
              </button>
            ))}
          </div>

          <div className="glass rounded-3xl p-4 sm:p-5 mt-3">
            {tab === 'modella' && (
              <>
                <Sezione titolo="Scegli chi vuoi truccare" aiuto="Parti da una modella già pronta.">
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {MODELLE.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setLook({ ...m.look, foto: look.foto, fotoZoom: look.fotoZoom, fotoX: look.fotoX, fotoY: look.fotoY, fotoRot: look.fotoRot })}
                        className="rounded-2xl bg-white/5 border border-white/10 hover:border-[#ff5fa2] p-1.5 transition"
                      >
                        <Avatar look={{ ...m.look, foto: null }} className="w-full h-auto rounded-xl overflow-hidden" />
                        <span className="block text-[11px] font-semibold mt-1 text-white/85">{m.look.nome}</span>
                      </button>
                    ))}
                  </div>
                </Sezione>

                <Sezione titolo="Colore della pelle">
                  <div className="flex flex-wrap gap-2.5">
                    {PELLI.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        title={p.label}
                        aria-label={p.label}
                        aria-pressed={look.pelle === p.id}
                        onClick={() => aggiorna('pelle', p.id)}
                        className={`w-12 h-12 rounded-full transition ${
                          look.pelle === p.id ? 'ring-4 ring-white scale-105' : 'ring-2 ring-white/20 hover:scale-105'
                        }`}
                        style={{ backgroundColor: p.base }}
                      />
                    ))}
                  </div>
                </Sezione>

                <Sezione titolo="Colore degli occhi">
                  <Pastiglie opzioni={COLORI_OCCHI} valore={look.occhi} onChange={(v) => aggiorna('occhi', v ?? COLORI_OCCHI[0].colore)} />
                </Sezione>

                <Sezione titolo="Sfondo">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {SFONDI.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => aggiorna('sfondo', s.id)}
                        className={`rounded-2xl px-3 py-3 text-sm font-semibold text-[#2b0a1b] transition ${
                          look.sfondo === s.id ? 'ring-4 ring-white' : 'ring-2 ring-white/20 hover:scale-[1.02]'
                        }`}
                        style={{ background: `linear-gradient(160deg, ${s.da}, ${s.a})` }}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </Sezione>
              </>
            )}

            {tab === 'capelli' && (
              <>
                <Sezione titolo="Acconciatura" aiuto="Tocca un taglio per provarlo subito.">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {ACCONCIATURE.map((a) => (
                      <BottoneOpzione
                        key={a.id}
                        attivo={look.capelli === a.id}
                        onClick={() => aggiorna('capelli', a.id)}
                        emoji={a.emoji}
                        label={a.label}
                      />
                    ))}
                  </div>
                </Sezione>

                <Sezione
                  titolo={
                    strumentoCapelli === 'shampoo'
                      ? '🧴 Lava i capelli'
                      : strumentoCapelli === 'mani'
                        ? '🤲 Pettina con le dita'
                        : '✂️ Taglia i capelli'
                  }
                  aiuto={
                    strumentoCapelli === 'mani'
                      ? 'Prendi i capelli sul ritratto e trascina: verso l\u2019alto esce la coda (fino in cima lo chignon), di lato le treccine, verso il basso tornano sciolti.'
                      : strumentoCapelli === 'shampoo'
                        ? 'Strofina i capelli col dito sul ritratto: arriva la schiuma, poi premi 🚿 Risciacqua.'
                        : stileAttivo.allungabile
                          ? 'Tocca il ritratto all\u2019altezza in cui vuoi tagliare: i capelli si accorciano lì.'
                          : 'Questo taglio è già cortissimo: scegli un\u2019acconciatura lunga per usare le forbici.'
                  }
                >
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() => setStrumentoCapelli('mani')}
                      aria-pressed={strumentoCapelli === 'mani'}
                      className={`rounded-2xl px-3 py-3 min-h-[52px] text-sm font-bold transition ${
                        strumentoCapelli === 'mani' ? 'bg-[#ffd24a] text-[#2b2100]' : 'bg-white/5 text-white/85 border border-white/10'
                      }`}
                    >
                      🤲 Mani
                    </button>
                    <button
                      type="button"
                      onClick={() => setStrumentoCapelli('forbici')}
                      aria-pressed={strumentoCapelli === 'forbici'}
                      className={`rounded-2xl px-4 py-3 min-h-[52px] text-sm font-bold transition ${
                        strumentoCapelli === 'forbici' ? 'bg-[#ff5fa2] text-[#2b0a1b]' : 'bg-white/5 text-white/85 border border-white/10'
                      }`}
                    >
                      ✂️ Forbici
                    </button>
                    <button
                      type="button"
                      onClick={() => setStrumentoCapelli('shampoo')}
                      aria-pressed={strumentoCapelli === 'shampoo'}
                      className={`rounded-2xl px-4 py-3 min-h-[52px] text-sm font-bold transition ${
                        strumentoCapelli === 'shampoo' ? 'bg-[#5ec8e5] text-[#04222b]' : 'bg-white/5 text-white/85 border border-white/10'
                      }`}
                    >
                      🧴 Shampoo
                    </button>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (look.lunghezza >= LUNG_MAX - 0.02) {
                          setAvviso('Sono già lunghissimi!')
                          return
                        }
                        animaLunghezza(LUNG_MAX, 900)
                        setAvviso('I capelli stanno ricrescendo… 🪄')
                      }}
                      className="btn-ghost text-sm py-3 font-semibold"
                    >
                      🪄 Fai ricrescere
                    </button>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {[
                      { label: 'Al mento', valore: 0.28 },
                      { label: 'Alle spalle', valore: 0.75 },
                      { label: 'Lunghissimi', valore: LUNG_MAX },
                    ].map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => {
                          if (p.valore < look.lunghezza && audio) suonoForbici()
                          animaLunghezza(p.valore, p.valore > look.lunghezza ? 700 : 320)
                        }}
                        className="rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 px-2 py-3 text-xs font-semibold text-white/85 transition"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setAudio((a) => !a)}
                    className="mt-2 text-xs text-[var(--muted)] hover:text-white transition"
                  >
                    {audio ? '🔊 Suono forbici acceso' : '🔇 Suono forbici spento'}
                  </button>
                </Sezione>

                <Sezione titolo="Colore dei capelli" aiuto="Anche i colori fantasia valgono!">
                  <Pastiglie opzioni={COLORI_CAPELLI} valore={look.capelliColore} onChange={(v) => aggiorna('capelliColore', v ?? COLORI_CAPELLI[0].colore)} />
                </Sezione>
              </>
            )}

            {tab === 'trucco' && (
              <>
                <Sezione
                  titolo="👆 Trucca col dito"
                  aiuto="Scegli un pennello e un colore, poi disegna direttamente sul viso del ritratto."
                >
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {PENNELLI.map((b) => (
                      <BottoneOpzione
                        key={b.id}
                        attivo={strumentoTrucco === b.id}
                        onClick={() => setStrumentoTrucco(b.id)}
                        emoji={b.emoji}
                        label={b.label}
                      />
                    ))}
                    <BottoneOpzione
                      attivo={strumentoTrucco === 'gomma'}
                      onClick={() => setStrumentoTrucco('gomma')}
                      emoji="🧽"
                      label="Gomma"
                    />
                  </div>
                  {strumentoTrucco !== 'gomma' && (
                    <div className="mt-3">
                      <Pastiglie
                        opzioni={PENNELLI.find((b) => b.id === strumentoTrucco)?.colori ?? []}
                        valore={coloriPennello[strumentoTrucco]}
                        onChange={(v) =>
                          v && setColoriPennello((c) => ({ ...c, [strumentoTrucco]: v }))
                        }
                      />
                    </div>
                  )}
                  {pennellate.length > 0 && (
                    <p className="text-xs text-[var(--muted)] mt-3">
                      {pennellate.length} passat{pennellate.length === 1 ? 'a' : 'e'} di trucco · i pulsanti ↩️ e 🧽 sono
                      sotto al ritratto.
                    </p>
                  )}
                </Sezione>

                <Sezione titolo="💋 Rossetto (veloce)">
                  <Pastiglie opzioni={ROSSETTI} valore={look.rossetto} onChange={(v) => aggiorna('rossetto', v)} conNessuno />
                </Sezione>
                <Sezione titolo="👁️ Ombretto">
                  <Pastiglie opzioni={OMBRETTI} valore={look.ombretto} onChange={(v) => aggiorna('ombretto', v)} conNessuno />
                </Sezione>
                <Sezione titolo="🌸 Fard sulle guance">
                  <Pastiglie opzioni={FARD} valore={look.fard} onChange={(v) => aggiorna('fard', v)} conNessuno />
                </Sezione>
                <Sezione titolo="Tocchi finali">
                  <div className="grid sm:grid-cols-3 gap-2">
                    <Interruttore attivo={look.ciglia} onChange={(v) => aggiorna('ciglia', v)} label="Ciglia lunghe" emoji="👀" />
                    <Interruttore attivo={look.lentiggini} onChange={(v) => aggiorna('lentiggini', v)} label="Lentiggini" emoji="🐞" />
                    <Interruttore attivo={look.glitter} onChange={(v) => aggiorna('glitter', v)} label="Glitter" emoji="✨" />
                  </div>
                </Sezione>
              </>
            )}

            {tab === 'vestiti' && (
              <>
                <Sezione titolo="Vestito">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {VESTITI.map((v) => (
                      <BottoneOpzione key={v.id} attivo={look.vestito === v.id} onClick={() => aggiorna('vestito', v.id)} emoji={v.emoji} label={v.label} />
                    ))}
                  </div>
                </Sezione>
                <Sezione titolo="Colore del vestito">
                  <Pastiglie opzioni={COLORI_VESTITO} valore={look.vestitoColore} onChange={(v) => aggiorna('vestitoColore', v ?? COLORI_VESTITO[0].colore)} />
                </Sezione>
                <Sezione titolo="Fantasia">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {FANTASIE.map((f) => (
                      <BottoneOpzione key={f.id} attivo={look.fantasia === f.id} onClick={() => aggiorna('fantasia', f.id)} emoji={f.emoji} label={f.label} />
                    ))}
                  </div>
                </Sezione>
                <Sezione titolo="👓 Occhiali">
                  <div className="grid grid-cols-3 gap-2">
                    {OCCHIALI.map((o) => (
                      <BottoneOpzione key={o.id} attivo={look.occhiali === o.id} onClick={() => aggiorna('occhiali', o.id)} emoji={o.emoji} label={o.label} />
                    ))}
                  </div>
                </Sezione>
                <Sezione titolo="👑 Sulla testa">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {TESTA.map((t) => (
                      <BottoneOpzione key={t.id} attivo={look.testa === t.id} onClick={() => aggiorna('testa', t.id)} emoji={t.emoji} label={t.label} />
                    ))}
                  </div>
                </Sezione>
                <Sezione titolo="Gioielli">
                  <div className="grid sm:grid-cols-2 gap-2">
                    <Interruttore attivo={look.orecchini} onChange={(v) => aggiorna('orecchini', v)} label="Orecchini" emoji="💎" />
                    <Interruttore attivo={look.collana} onChange={(v) => aggiorna('collana', v)} label="Collana" emoji="📿" />
                  </div>
                </Sezione>
              </>
            )}

            {tab === 'foto' && (
              <>
                <Sezione
                  titolo="📷 Usa una tua foto"
                  aiuto="La foto resta sul tuo dispositivo: non viene caricata su internet."
                >
                  <div className="flex flex-wrap gap-2">
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) caricaFoto(file)
                        e.target.value = ''
                      }}
                    />
                    <button type="button" onClick={() => fileRef.current?.click()} className="btn-primary px-5 py-3 text-sm">
                      {look.foto ? '🔄 Cambia foto' : '📁 Scegli una foto'}
                    </button>
                    {look.foto && (
                      <button type="button" onClick={() => aggiorna('foto', null)} className="btn-ghost px-5 py-3 text-sm">
                        🗑️ Togli la foto
                      </button>
                    )}
                  </div>
                </Sezione>

                {look.foto && (
                  <Sezione titolo="Centra il viso" aiuto="Muovi la foto finché occhi e bocca stanno sui segni rosa.">
                    <Cursore label="Zoom" valore={look.fotoZoom} min={0.5} max={2.5} step={0.02} onChange={(v) => aggiorna('fotoZoom', v)} formato={(v) => `${Math.round(v * 100)}%`} />
                    <Cursore label="Sinistra / destra" valore={look.fotoX} min={-80} max={80} step={1} onChange={(v) => aggiorna('fotoX', v)} />
                    <Cursore label="Su / giù" valore={look.fotoY} min={-80} max={80} step={1} onChange={(v) => aggiorna('fotoY', v)} />
                    <Cursore label="Inclina" valore={look.fotoRot} min={-30} max={30} step={1} onChange={(v) => aggiorna('fotoRot', v)} formato={(v) => `${v}°`} />
                  </Sezione>
                )}

                <Sezione titolo="Porta a casa il look">
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={scaricaPng} className="btn-primary px-5 py-3 text-sm">
                      ⬇️ Scarica la foto
                    </button>
                    <button type="button" onClick={() => setLook({ ...LOOK_BASE, nome: look.nome })} className="btn-ghost px-5 py-3 text-sm">
                      🧼 Ricomincia da capo
                    </button>
                  </div>
                </Sezione>

                <Sezione titolo={`💖 Il tuo book (${book.length}/${MAX_BOOK})`} aiuto={book.length ? 'Tocca un look per rimetterlo in scena.' : 'Salva un look e comparirà qui.'}>
                  {book.length === 0 ? (
                    <p className="text-sm text-[var(--muted)]">Ancora nessun look salvato.</p>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {book.map((s) => (
                        <div key={s.id} className="rounded-2xl bg-white/5 border border-white/10 p-1.5">
                          <button type="button" onClick={() => setLook(completaLook(s.look))} className="block w-full">
                            <Avatar look={completaLook(s.look)} className="w-full h-auto rounded-xl overflow-hidden" />
                            <span className="block text-[11px] font-semibold mt-1 text-white/85 truncate">{s.nome}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => salvaBook(book.filter((b) => b.id !== s.id))}
                            className="mt-1 w-full text-[11px] text-white/50 hover:text-red-400 transition"
                          >
                            elimina
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </Sezione>
              </>
            )}
          </div>
        </div>
      </div>

      {/* copia nascosta, senza guide: è quella che finisce nel PNG */}
      <div aria-hidden className="fixed -left-[9999px] top-0 w-[320px] h-[400px] pointer-events-none opacity-0">
        <Avatar look={look} svgRef={exportRef} className="w-[320px] h-[400px]" />
      </div>
    </div>
  )
}
