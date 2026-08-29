'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import Avatar from './Avatar'
import {
  ACCONCIATURE,
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
  type Look,
  type Opzione,
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
  const exportRef = useRef<SVGSVGElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const aggiorna = useCallback(<K extends keyof Look>(chiave: K, valore: Look[K]) => {
    setLook((l) => ({ ...l, [chiave]: valore }))
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
            <Avatar
              look={look}
              guide={tab === 'foto' && Boolean(look.foto)}
              className="w-full h-auto rounded-2xl overflow-hidden"
            />
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
                <span className="mr-1.5">{t.emoji}</span>
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

                <Sezione titolo="✂️ Forbici: quanto lunghi?" aiuto={stileAttivo.allungabile ? 'Trascina per accorciare o allungare.' : 'Questo taglio è già cortissimo: prova i lunghi per usare le forbici.'}>
                  <Cursore
                    label="Lunghezza"
                    valore={look.lunghezza}
                    min={0.6}
                    max={1.6}
                    step={0.05}
                    onChange={(v) => aggiorna('lunghezza', v)}
                    formato={(v) => (v < 0.85 ? 'corti' : v < 1.15 ? 'medi' : v < 1.4 ? 'lunghi' : 'lunghissimi')}
                  />
                </Sezione>

                <Sezione titolo="Colore dei capelli" aiuto="Anche i colori fantasia valgono!">
                  <Pastiglie opzioni={COLORI_CAPELLI} valore={look.capelliColore} onChange={(v) => aggiorna('capelliColore', v ?? COLORI_CAPELLI[0].colore)} />
                </Sezione>
              </>
            )}

            {tab === 'trucco' && (
              <>
                <Sezione titolo="💋 Rossetto">
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
                          <button type="button" onClick={() => setLook(s.look)} className="block w-full">
                            <Avatar look={s.look} className="w-full h-auto rounded-xl overflow-hidden" />
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
