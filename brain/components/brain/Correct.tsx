'use client'

import { useState } from 'react'

/**
 * "Questo è sbagliato."
 *
 * Sta sotto a ogni affermazione, del brief e delle risposte, e si apre
 * con **il testo sbagliato già dentro**: la parte faticosa di una
 * correzione è ricopiare quello che il sistema aveva detto, e se
 * quella parte la fai tu nessuno correggerà mai niente.
 *
 * Volutamente non è un pollice verso. Un voto non dice cosa fosse
 * giusto, quindi non serve a niente né a te né al sistema: qui si
 * scrive la cosa vera, e da quel momento è una fonte in memoria che
 * pesa più di tutte le altre.
 */

type Props = {
  /** Quello che il sistema aveva detto: finisce nel campo "risultava". */
  wrong: string
  /** Di cosa si parla, quando il testo da solo non basterebbe fra sei mesi. */
  about?: string
  /** Etichetta del pulsante chiuso. */
  label?: string
}

export default function Correct({ wrong, about, label = 'correggi' }: Props) {
  const [open, setOpen] = useState(false)
  const [right, setRight] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    if (!right.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/brain/correct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ right, wrong, about }),
      })
      const data = await res.json()
      if (!res.ok) setError(data.error ?? 'Non sono riuscito a registrare la correzione.')
      else {
        setDone(data.note ?? 'Correzione registrata.')
        setOpen(false)
        setRight('')
      }
    } catch {
      setError('Connessione interrotta.')
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <p className="brain-corrected">
        ✓ {done} Da adesso vale più di qualunque altra fonte su questo punto, e la vedrai citata
        come tale.
      </p>
    )
  }

  if (!open) {
    return (
      <button type="button" className="brain-correct-open" onClick={() => setOpen(true)}>
        ✗ {label}
      </button>
    )
  }

  return (
    <div className="brain-correct">
      <label className="brain-label" htmlFor={`right-${wrong.slice(0, 12)}`}>
        Qual è la cosa giusta?
      </label>
      <textarea
        id={`right-${wrong.slice(0, 12)}`}
        className="brain-field"
        rows={2}
        value={right}
        autoFocus
        onChange={(e) => setRight(e.target.value)}
        placeholder="Scrivi il fatto corretto. Diventa una fonte in memoria, citabile come le altre."
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault()
            void save()
          }
        }}
      />
      <div className="brain-actions" style={{ marginTop: '0.5rem' }}>
        <button
          type="button"
          className="brain-btn brain-btn-primary"
          onClick={() => void save()}
          disabled={busy || !right.trim()}
        >
          {busy ? 'Registro…' : 'Correggi la memoria'}
        </button>
        <button type="button" className="brain-btn" onClick={() => setOpen(false)}>
          Annulla
        </button>
      </div>
      {error ? <p className="brain-flag">{error}</p> : null}
    </div>
  )
}
