import { useEffect, useMemo, useState } from "react";
import { DOCUMENTS, documentFromPastedText } from "../documents";
import { isWebBluetoothAvailable } from "../mendi/webbluetooth";
import { clausesCsv, download, framesCsv, sessionJson } from "../session/export";
import { LX_ACCESSIBILITY_THRESHOLD } from "../session/lx";
import { clauseMetrics } from "../session/metrics";
import type { Document } from "../session/model";
import { Sparkline } from "./Sparkline";
import { useRecorder } from "./useRecorder";

const BASELINE_SECONDS = 30;

export function App() {
  const r = useRecorder();
  return (
    <div className="app">
      <header className="topbar">
        <div>
          <strong>Habeas Mentem Lab</strong> · LX Reader
        </div>
        <div className="status">
          {r.device ? (
            <span className="pill ok">
              {r.device.name}
              {r.device.simulated ? " (simulata)" : ""}
              {r.battery ? ` · ${(r.battery.voltageMv / 1000).toFixed(2)} V` : ""}
              {r.frameCount > 0 ? ` · ${r.frameCount} campioni` : ""}
            </span>
          ) : (
            <span className="pill">nessuna fascia</span>
          )}
        </div>
      </header>

      {r.error && (
        <div className="banner error">
          {r.error} <button onClick={r.clearError}>chiudi</button>
        </div>
      )}

      {r.phase === "setup" && <Setup r={r} />}
      {r.phase === "baseline" && <BaselineScreen r={r} />}
      {r.phase === "reading" && r.document && <Reader r={r} doc={r.document} />}
      {r.phase === "results" && r.document && r.session && <Results r={r} doc={r.document} />}

      <footer className="foot">
        Prototipo interno, non commerciale. I dati restano in questo browser finché non li scarichi.
        L'indice di sforzo è un proxy: la comprensione si misura, la mente non si legge.
      </footer>
    </div>
  );
}

type R = ReturnType<typeof useRecorder>;

function Setup({ r }: { r: R }) {
  const [docId, setDocId] = useState(DOCUMENTS[0].id);
  const [pasteTitle, setPasteTitle] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [consent, setConsent] = useState(false);
  const bluetooth = isWebBluetoothAvailable();

  const doc: Document | null = useMemo(() => {
    if (docId === "__paste__") return pasteText.trim() ? documentFromPastedText(pasteTitle, pasteText) : null;
    return DOCUMENTS.find((d) => d.id === docId) ?? null;
  }, [docId, pasteTitle, pasteText]);

  return (
    <main className="screen">
      <section className="intro">
        <p className="eyebrow">Neuro Legal Cortex · Habeas Mentem Lab</p>
        <h1>Misurare dove il diritto smette di raggiungere chi lo legge</h1>
        <p className="lead">
          Meno dell'1% delle persone legge i documenti giuridici; più del 90% li accetta comunque. La trasparenza
          di oggi è formale, non reale. Comprendere non è un problema giuridico: è un problema cognitivo. Questo
          laboratorio osserva la lettura con tre indizi indipendenti e non li fonde mai in un giudizio.
        </p>
        <div className="sensors">
          <div className="sensor">
            <span className="sensor-name">Tempo</span>
            <span>secondi per clausola, ritorni indietro, parole al minuto</span>
          </div>
          <div className="sensor">
            <span className="sensor-name">Corpo</span>
            <span>fascia Mendi (fNIRS): indice di sforzo rispetto alla baseline</span>
          </div>
          <div className="sensor">
            <span className="sensor-name">Testo</span>
            <span>LX Complexity Score: linguistica, concetti, struttura, semantica</span>
          </div>
        </div>
      </section>

      <h2 className="section-title">Nuova sessione di lettura</h2>

      <section className="card">
        <h2>1. Fascia Mendi</h2>
        {r.device ? (
          <p>
            Collegata: <strong>{r.device.name}</strong>
            {r.device.firmwareVersion ? ` · firmware ${r.device.firmwareVersion}` : ""}{" "}
            <button onClick={r.disconnect}>scollega</button>
          </p>
        ) : (
          <div className="row">
            <button className="primary" disabled={!bluetooth || r.connecting} onClick={() => r.connect(false)}>
              {r.connecting ? "connessione…" : "Collega la fascia (Bluetooth)"}
            </button>
            <button disabled={r.connecting} onClick={() => r.connect(true)}>
              Usa la fascia simulata
            </button>
            {!bluetooth && (
              <span className="hint">Web Bluetooth non disponibile qui: serve Chrome o Edge (desktop o Android).</span>
            )}
          </div>
        )}
        <p className="hint">
          Si può anche leggere senza fascia: resta attivo il solo sensore del tempo. È il diritto di non essere
          misurati, applicato al laboratorio.
        </p>
      </section>

      <section className="card">
        <h2>2. Documento</h2>
        <select value={docId} onChange={(e) => setDocId(e.target.value)}>
          {DOCUMENTS.map((d) => (
            <option key={d.id} value={d.id}>
              {d.title} · {d.clauses.length} clausole
            </option>
          ))}
          <option value="__paste__">Incolla un tuo testo…</option>
        </select>
        {docId === "__paste__" && (
          <div className="paste">
            <input placeholder="Titolo del documento" value={pasteTitle} onChange={(e) => setPasteTitle(e.target.value)} />
            <textarea
              rows={10}
              placeholder="Incolla qui il testo. Le clausole si separano con una riga vuota; una riga breve senza punto finale è letta come titolo."
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
            />
            {doc && <span className="hint">{doc.clauses.length} clausole riconosciute.</span>}
          </div>
        )}
      </section>

      <section className="card">
        <h2>3. Consenso del partecipante</h2>
        <ul className="consent">
          <li>Registriamo: tempo per clausola, navigazione avanti/indietro e, con la fascia, i segnali ottici e di movimento.</li>
          <li>Non registriamo nome, e-mail o altri dati identificativi: la sessione ha uno pseudonimo casuale.</li>
          <li>Nulla viene inviato a un server. I dati esistono solo in questa pagina finché non vengono scaricati.</li>
          <li>Il segnale della fascia produce un indice di sforzo relativo. Non dice se hai capito, non legge pensieri o emozioni.</li>
          <li>Puoi interrompere in ogni momento chiudendo la pagina: i dati non scaricati sono persi.</li>
        </ul>
        <label className="check">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} /> Ho letto e accetto di partecipare a questa sessione.
        </label>
      </section>

      <div className="actions">
        <button className="primary big" disabled={!doc || !consent} onClick={() => doc && r.start(doc)}>
          {r.device ? `Inizia (baseline ${BASELINE_SECONDS} s, poi lettura)` : "Inizia la lettura senza fascia"}
        </button>
      </div>
    </main>
  );
}

function BaselineScreen({ r }: { r: R }) {
  const [left, setLeft] = useState(BASELINE_SECONDS);
  useEffect(() => {
    const t = setInterval(() => setLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (left <= 0) {
      if (!r.finishBaseline()) setLeft(BASELINE_SECONDS);
    }
  }, [left, r]);

  return (
    <main className="screen center">
      <h1>Baseline a riposo</h1>
      <p className="lead">Occhi aperti, sguardo sul punto, testa ferma. Non leggere nulla.</p>
      <div className="fixation">+</div>
      <div className="countdown">{Math.max(left, 0)} s</div>
      <p className="hint">{r.frameCount} campioni raccolti</p>
    </main>
  );
}

function Reader({ r, doc }: { r: R; doc: Document }) {
  const clause = doc.clauses[r.clauseIndex];
  const [enteredAt, setEnteredAt] = useState(Date.now());
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    setEnteredAt(Date.now());
  }, [r.clauseIndex]);
  useEffect(() => {
    const t = setInterval(() => setElapsed(Date.now() - enteredAt), 250);
    return () => clearInterval(t);
  }, [enteredAt]);

  const last = r.clauseIndex === doc.clauses.length - 1;
  return (
    <main className="screen reader">
      <div className="progress">
        <span>
          {doc.title} · clausola {clause.index} di {doc.clauses.length}
        </span>
        <span>{(elapsed / 1000).toFixed(0)} s</span>
      </div>
      <article className="clause">
        {clause.heading && <h2>{clause.heading}</h2>}
        {clause.text.split("\n").map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </article>
      <nav className="actions">
        <button disabled={r.clauseIndex === 0} onClick={() => r.goTo(r.clauseIndex - 1, "back")}>
          ← Torna indietro
        </button>
        {last ? (
          <button className="primary" onClick={r.finishReading}>
            Ho finito
          </button>
        ) : (
          <button className="primary" onClick={() => r.goTo(r.clauseIndex + 1, "forward")}>
            Avanti →
          </button>
        )}
      </nav>
      {r.device && (
        <div className="livebox">
          <Sparkline points={r.live} />
          <span className="hint">Indice di sforzo (proxy, media mobile 1 s). Le barre rosse segnalano movimenti della testa.</span>
        </div>
      )}
    </main>
  );
}

function Results({ r, doc }: { r: R; doc: Document }) {
  const session = r.session!;
  const metrics = useMemo(() => clauseMetrics(session, doc.clauses), [session, doc]);
  const maxAbs = Math.max(...metrics.map((m) => Math.abs(m.effort.mean)), 1e-6);
  const totalMs = metrics.reduce((s, m) => s + m.dwellMs, 0);
  const stamp = session.id;

  return (
    <main className="screen">
      <h1>Risultati della sessione</h1>
      <p className="lead">
        Partecipante <code>{session.participant}</code> · {doc.title} · lettura totale {(totalMs / 1000).toFixed(0)} s ·{" "}
        {session.frames.length} campioni
        {r.baseline ? ` · baseline su ${r.baseline.sampleCount} campioni` : " · senza fascia"}
      </p>

      <table className="metrics">
        <thead>
          <tr>
            <th>#</th>
            <th>Clausola</th>
            <th>Parole</th>
            <th>Tempo</th>
            <th>wpm</th>
            <th>Ritorni</th>
            <th>LX</th>
            {r.baseline && <th>Sforzo medio (Δ baseline)</th>}
            {r.baseline && <th>Artefatti</th>}
          </tr>
        </thead>
        <tbody>
          {metrics.map((m) => (
            <tr key={m.clauseId} className={m.tooFastToRead ? "too-fast" : ""}>
              <td>{m.index}</td>
              <td>{m.heading ?? doc.clauses[m.index - 1].text.slice(0, 60) + "…"}</td>
              <td>{m.wordCount}</td>
              <td>{(m.dwellMs / 1000).toFixed(1)} s</td>
              <td>
                {m.wordsPerMinute === null ? "—" : m.wordsPerMinute.toFixed(0)}
                {m.tooFastToRead && <span className="flag" title="Troppo veloce per averla letta tutta"> ⚠</span>}
              </td>
              <td>{m.returns}</td>
              <td>
                <span
                  className={`lx ${m.lx.total > LX_ACCESSIBILITY_THRESHOLD ? "lx-high" : "lx-ok"}`}
                  title={`Linguistica ${m.lx.linguistic} · Concetti ${m.lx.conceptual} · Struttura ${m.lx.structural} · Semantica ${m.lx.semantic}\n${m.lx.details.avgSentenceLength} parole/frase, ${m.lx.details.technicalTerms} termini tecnici (${m.lx.details.undefinedTerms} non definiti), ${m.lx.details.citations} rinvii`}
                >
                  {m.lx.total}
                </span>
              </td>
              {r.baseline && (
                <td>
                  <div className="bar-cell">
                    <div className="bar-wrap">
                      <div
                        className={`bar ${m.effort.mean >= 0 ? "pos" : "neg"}`}
                        style={{ width: `${(Math.abs(m.effort.mean) / maxAbs) * 100}%` }}
                      />
                    </div>
                    <span>{m.effort.sampleCount ? m.effort.mean.toFixed(4) : "—"}</span>
                  </div>
                </td>
              )}
              {r.baseline && <td>{m.effort.sampleCount ? `${(m.effort.motionArtifactRatio * 100).toFixed(0)}%` : "—"}</td>}
            </tr>
          ))}
        </tbody>
      </table>

      <p className="hint">
        ⚠ = oltre 600 parole al minuto: il tempo esclude la lettura completa. LX = stima euristica dell'LX
        Complexity Score (0-100; sopra {LX_ACCESSIBILITY_THRESHOLD} la soglia sperimentale di accessibilità; passa
        il mouse per le quattro dimensioni). Lo sforzo è la variazione media del proxy HbO rispetto alla baseline,
        in unità arbitrarie: confrontabile solo tra clausole della stessa sessione. Nessuna colonna, da sola, dice
        se la clausola è stata compresa.
      </p>

      <div className="actions">
        <button className="primary" onClick={() => download(`${stamp}-clausole.csv`, clausesCsv(session, metrics), "text/csv")}>
          Scarica CSV per clausola
        </button>
        <button onClick={() => download(`${stamp}-frames.csv`, framesCsv(session), "text/csv")} disabled={session.frames.length === 0}>
          Scarica CSV dei campioni grezzi
        </button>
        <button onClick={() => download(`${stamp}.json`, sessionJson(session, doc.clauses, metrics), "application/json")}>
          Scarica JSON della sessione
        </button>
        <button onClick={r.reset}>Nuova sessione</button>
      </div>
    </main>
  );
}
