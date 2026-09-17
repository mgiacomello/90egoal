'use client'

import { useState } from 'react'
import type { ContractAnalysis } from '@/lib/brain/agents/contracts'
import type { StoredDocument } from '@/lib/brain/types'

/**
 * La scheda Contratti.
 *
 * L'interfaccia deve rendere visibile una distinzione che altrove
 * sarebbe pedanteria e qui è tutto: **la citazione è verificata, il
 * resto è un giudizio.** La clausola sta in un riquadro col suo bollo
 * di verifica; rischio, standard di mercato e controproposta stanno
 * fuori, dichiarati per quello che sono.
 */

type Props = {
  documents: StoredDocument[]
}

type Mode = 'paste' | 'pdf' | 'memory'

/** Da che parte stai: cambia quali clausole sono un problema. */
const SIDES = ['il Cliente', 'il Fornitore', 'il Locatario', 'il Licenziatario', "l'Investitore"]

const VERDICT_TONE: Record<string, string> = {
  accettabile: 'ok',
  'accettabile con modifiche': 'warn',
  rischioso: 'bad',
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      className="brain-copy"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setDone(true)
          setTimeout(() => setDone(false), 1600)
        } catch {
          setDone(false)
        }
      }}
    >
      {done ? '✓ copiata' : 'copia'}
    </button>
  )
}

export default function ContractPanel({ documents }: Props) {
  const [mode, setMode] = useState<Mode>('paste')
  const [documentId, setDocumentId] = useState('')
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [side, setSide] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<ContractAnalysis | null>(null)

  // Un movimento del conto o un dato del sonno non è un contratto.
  const candidates = documents.filter((d) => d.kind === 'file' || d.kind === 'note' || d.kind === 'email')

  const ready =
    mode === 'memory' ? Boolean(documentId) : mode === 'pdf' ? Boolean(file) : text.trim().length >= 200

  async function analyze() {
    if (!ready || busy) return
    setBusy(true)
    setError(null)
    setAnalysis(null)
    try {
      let res: Response
      if (mode === 'pdf' && file) {
        // multipart: niente Content-Type a mano, lo mette il browser col boundary.
        const form = new FormData()
        form.set('file', file)
        form.set('side', side)
        res = await fetch('/api/brain/contract', { method: 'POST', body: form })
      } else {
        res = await fetch('/api/brain/contract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(mode === 'memory' ? { documentId, side } : { text, side }),
        })
      }
      const data = await res.json()
      if (!res.ok) setError(data.error ?? 'Analisi non riuscita.')
      else setAnalysis(data as ContractAnalysis)
    } catch {
      setError('Connessione interrotta.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section>
      <div className="brain-actions" style={{ marginBottom: '0.875rem' }}>
        <button
          type="button"
          className="brain-chip"
          aria-pressed={mode === 'paste'}
          onClick={() => setMode('paste')}
        >
          Incolla il testo
        </button>
        <button
          type="button"
          className="brain-chip"
          aria-pressed={mode === 'pdf'}
          onClick={() => setMode('pdf')}
        >
          Carica un PDF
        </button>
        <button
          type="button"
          className="brain-chip"
          aria-pressed={mode === 'memory'}
          onClick={() => setMode('memory')}
        >
          Prendi dalla memoria
        </button>
      </div>

      <div className="brain-ask">
        {mode === 'memory' ? (
          <select
            className="brain-input"
            value={documentId}
            onChange={(e) => setDocumentId(e.target.value)}
          >
            <option value="">Scegli un documento…</option>
            {candidates.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title || '(senza titolo)'}
              </option>
            ))}
          </select>
        ) : mode === 'pdf' ? (
          <div>
            <input
              type="file"
              accept="application/pdf"
              className="brain-input"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <p className="brain-meta" style={{ marginTop: '0.5rem' }}>
              Il file non viene salvato da nessuna parte: si estrae il testo e finisce lì. Un PDF
              scansionato non ha un livello di testo e verrà rifiutato dicendolo — in quel caso
              copia e incolla.
            </p>
          </div>
        ) : (
          <textarea
            className="brain-field"
            rows={8}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Incolla qui il contratto."
          />
        )}

        <div>
          <label className="brain-label" htmlFor="brain-side">
            Rappresenti
          </label>
          <input
            id="brain-side"
            className="brain-input"
            value={side}
            onChange={(e) => setSide(e.target.value)}
            placeholder="es. il Fornitore — se non lo dici, l'analisi resta neutra e lo dichiara"
          />
          <div className="brain-suggestions" style={{ marginTop: '0.5rem' }}>
            {SIDES.map((s) => (
              <button key={s} type="button" className="brain-chip" onClick={() => setSide(s)}>
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="brain-actions">
          <button type="button" className="brain-btn brain-btn-primary" onClick={() => void analyze()} disabled={!ready || busy}>
            {busy ? 'Sto leggendo il contratto…' : 'Analizza'}
          </button>
          {mode === 'paste' && text.trim().length > 0 && text.trim().length < 200 ? (
            <span className="brain-meta">servono almeno 200 caratteri</span>
          ) : null}
        </div>
      </div>

      {error ? <p className="brain-error" style={{ marginTop: '1rem' }}>{error}</p> : null}

      {analysis ? (
        <div className="brain-answer">
          <div className="brain-verdict" data-tone={VERDICT_TONE[analysis.verdetto] ?? 'warn'}>
            <span className="brain-verdict-label">{analysis.verdetto}</span>
            <p>{analysis.sintesi}</p>
            <span className="brain-meta">
              parte rappresentata: {analysis.parte} · {analysis.clausole.length} clausole critiche · modello {analysis.model}
            </span>
          </div>

          {analysis.troncato ? (
            <p className="brain-flag">
              ⚠ Il contratto era più lungo del limite ed è stato letto solo in parte. Le conclusioni
              non coprono il testo mancante.
            </p>
          ) : null}

          {analysis.scartate.length ? (
            <div className="brain-error">
              <b>
                {analysis.scartate.length} clausol{analysis.scartate.length === 1 ? 'a' : 'e'} scartat
                {analysis.scartate.length === 1 ? 'a' : 'e'}: il testo citato non esiste nel contratto.
              </b>
              <p style={{ margin: '0.5rem 0 0' }}>
                Riguarda il verdetto complessivo con diffidenza — potrebbe essersi formato anche su
                quelle. Vale la pena rilanciare l&apos;analisi.
              </p>
              <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.125rem' }}>
                {analysis.scartate.map((s, i) => (
                  <li key={i}>{s.titolo}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {analysis.clausole.map((c, i) => (
            <article key={i} className="brain-clause" data-risk={c.rischio}>
              <header className="brain-clause-head">
                <span className="brain-risk" data-risk={c.rischio}>
                  rischio {c.rischio}
                </span>
                <h3>{c.titolo}</h3>
              </header>

              <blockquote className="brain-quote">
                {c.citazione}
                <span className="brain-quote-mark" data-status={c.quote.status}>
                  {c.quote.status === 'exact'
                    ? '✓ presente nel contratto, parola per parola'
                    : `≈ quasi testuale (${Math.round(c.quote.coverage * 100)}% ritrovato) — rileggi l'originale`}
                </span>
              </blockquote>

              <dl className="brain-clause-body">
                <dt>Perché è un problema</dt>
                <dd>{c.perche}</dd>
                <dt>Standard di mercato</dt>
                <dd>{c.standard}</dd>
                <dt>
                  Controproposta <CopyButton text={c.controproposta} />
                </dt>
                <dd className="brain-counter">{c.controproposta}</dd>
              </dl>
            </article>
          ))}

          {analysis.mancanti.length ? (
            <div className="brain-open">
              <h3>Cosa non c&apos;è e dovrebbe esserci</h3>
              <ul>
                {analysis.mancanti.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className="brain-note">
            La <b>citazione</b> è verificata sul testo: se non ci fosse, quella clausola non sarebbe
            qui. <b>Rischio, standard di mercato e controproposta</b> non sono verificabili contro
            niente — sono il giudizio di un modello, e vanno letti come si legge il parere di un
            collega giovane: utile per non partire da zero, non per firmare.
          </p>
        </div>
      ) : null}
    </section>
  )
}
