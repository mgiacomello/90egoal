import { useEffect, useMemo, useState } from "react";
import { DOCUMENTS, documentFromPastedText } from "../documents";
import { isWebBluetoothAvailable } from "../mendi/webbluetooth";
import { clausesCsv, download, framesCsv, sessionJson } from "../session/export";
import { LX_ACCESSIBILITY_THRESHOLD } from "../session/lx";
import { clauseMetrics } from "../session/metrics";
import type { Document } from "../session/model";
import { Sparkline } from "./Sparkline";
import { Operate, Verify } from "./VerifyOperate";
import { frictionMap } from "../session/friction";
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
      {r.phase === "verify" && r.document && (
        <Verify doc={r.document} onAnswer={r.answerQuestion} onDone={r.finishVerify} />
      )}
      {r.phase === "operate" && r.document && (
        <Operate doc={r.document} onComplete={r.completeTask} onDone={r.finishOperate} />
      )}
      {r.phase === "results" && r.document && r.session && <Results r={r} doc={r.document} />}

      <footer className="foot">
        Prototipo interno, non commerciale. I dati restano in questo browser finché non li scarichi.
        Si misurano i documenti, mai le persone. La comprensione si misura, la mente non si legge.
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
          Habeas Mentem è il diritto di ogni persona a comprendere, giudicare e decidere in condizioni che non siano
          state progettate contro di lei. Meno dell'1% delle persone legge i documenti giuridici; più del 90% li
          accetta comunque. Questo laboratorio osserva la lettura con tre indizi indipendenti e non li fonde mai in
          un giudizio: nessun sensore dimostra da solo la comprensione.
        </p>
        <div className="sensors">
          <div className="sensor">
            <span className="sensor-name">Tempo</span>
            <span>secondi per clausola, ritorni indietro, parole al minuto</span>
          </div>
          <div className="sensor">
            <span className="sensor-name">Corpo</span>
            <span>fascia Mendi (fNIRS): variazioni compatibili con il carico cognitivo. Un indizio, nient'altro</span>
          </div>
          <div className="sensor">
            <span className="sensor-name">Testo</span>
            <span>LX Complexity Score: la lingua, l'affollamento, l'ordine, la distanza semantica</span>
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
        <p className="hint">La costituzione della misurazione, applicata a questa sessione.</p>
        <ul className="consent">
          <li>
            <strong>Una sola finalità.</strong> Misuriamo per migliorare la comprensibilità del documento. Nessun uso
            ulteriore: i dati non servono a profilare, selezionare o influenzare chi legge.
          </li>
          <li>
            <strong>Si misurano i documenti, mai le persone.</strong> Se una clausola perde chi la legge, il difetto è
            della clausola. Nessun esito dice qualcosa sulla tua capacità.
          </li>
          <li>
            <strong>Il minimo necessario.</strong> Registriamo tempo per clausola, navigazione avanti e indietro e, con la
            fascia, i segnali ottici e di movimento. Nessun nome, nessuna e-mail: la sessione ha uno pseudonimo casuale.
            Nulla va a un server; i dati esistono solo in questa pagina finché non vengono scaricati.
          </li>
          <li>
            <strong>Il metodo è pubblico.</strong> Indicatori, formule e soglie sono nel codice del laboratorio; ogni
            punteggio si può ricalcolare dai dati esportati.
          </li>
          <li>
            <strong>Nessuno è obbligato a essere misurato.</strong> La partecipazione è volontaria e revocabile: puoi
            leggere senza fascia o chiudere la pagina in ogni momento, senza alcuna conseguenza.
          </li>
          <li>
            <strong>Il segnale della fascia è un indizio, nient'altro.</strong> Dice che in un passaggio lo sforzo è
            cresciuto. Non dice se hai capito, non legge pensieri né emozioni.
          </li>
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
  const friction = useMemo(() => frictionMap(metrics), [metrics]);
  const frictionById = new Map(friction.map((f) => [f.clauseId, f]));
  const hasVerify = doc.questions.length > 0;
  const hasOperate = doc.tasks.length > 0;
  const verifyTotal = session.answers.filter((a) => a.correct).length;
  const operateTotal = session.tasks.filter((t) => t.correct).length;
  const maxAbs = Math.max(...metrics.map((m) => Math.abs(m.effort.mean)), 1e-6);
  const totalMs = metrics.reduce((s, m) => s + m.dwellMs, 0);
  const stamp = session.id;
  const [responsible, setResponsible] = useState("");
  const [building, setBuilding] = useState(false);
  const makeDossier = async () => {
    setBuilding(true);
    try {
      const json = sessionJson(session, doc.clauses, metrics, friction);
      // jsPDF pesa: lo carichiamo solo quando serve.
      const { buildDossier } = await import("../session/dossier");
      const blob = await buildDossier({ session, doc, metrics, friction, sessionJson: json, responsible });
      download(`${stamp}-fascicolo.pdf`, blob);
    } finally {
      setBuilding(false);
    }
  };

  return (
    <main className="screen">
      <h1>Risultati della sessione</h1>
      <p className="lead">
        Partecipante <code>{session.participant}</code> · {doc.title} · lettura totale {(totalMs / 1000).toFixed(0)} s ·{" "}
        {session.frames.length} campioni
        {r.baseline ? ` · baseline su ${r.baseline.sampleCount} campioni` : " · senza fascia"}
        {hasVerify && ` · verifica ${verifyTotal}/${session.answers.length}`}
        {hasOperate && ` · prova operativa ${operateTotal}/${session.tasks.length}`}
      </p>

      <div className="legend">
        <span className="friction verde">verde: nessuna convergenza</span>
        <span className="friction giallo">giallo: due indizi, o una verifica fallita</span>
        <span className="friction rosso">rosso: tre indizi, di cui uno da verifica o prova</span>
      </div>

      <table className="metrics">
        <thead>
          <tr>
            <th>#</th>
            <th>Clausola</th>
            <th>Frizione</th>
            <th>Parole</th>
            <th>Tempo</th>
            <th>wpm</th>
            <th>Ritorni</th>
            <th>LX</th>
            {hasVerify && <th>Verifica</th>}
            {hasOperate && <th>Prova</th>}
            {r.baseline && <th>Sforzo medio (Δ baseline)</th>}
            {r.baseline && <th>Artefatti</th>}
          </tr>
        </thead>
        <tbody>
          {metrics.map((m) => (
            <tr key={m.clauseId} className={m.tooFastToRead ? "too-fast" : ""}>
              <td>{m.index}</td>
              <td>{m.heading ?? doc.clauses[m.index - 1].text.slice(0, 60) + "…"}</td>
              <td>
                {(() => {
                  const f = frictionById.get(m.clauseId)!;
                  return (
                    <span className={`friction ${f.level}`} title={f.reasons.length ? f.reasons.join("\n") : "nessun indizio"}>
                      {f.level}
                      {f.count > 0 && <span className="hint">({f.count})</span>}
                    </span>
                  );
                })()}
              </td>
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
                  title={`Lingua ${m.lx.syntactic} · Affollamento ${m.lx.conceptual} · Ordine ${m.lx.structural} · Distanza semantica ${m.lx.semantic}\n${m.lx.details.avgSentenceLength} parole/frase (obiettivo 22), ${m.lx.details.subordinatesPerSentence} subordinate/periodo, passive ${Math.round(m.lx.details.passiveRatio * 100)}%\n${m.lx.details.technicalTermsPer600} termini tecnici ogni 600 parole, ${Math.round(m.lx.details.undefinedShare * 100)}% senza definizione, ${m.lx.details.citations} rinvii normativi`}
                >
                  {m.lx.total}
                </span>
              </td>
              {hasVerify && (
                <td className={m.verification.asked ? (m.verification.correct === m.verification.asked ? "ok" : "ko") : ""}>
                  {m.verification.asked ? `${m.verification.correct}/${m.verification.asked}` : "—"}
                </td>
              )}
              {hasOperate && (
                <td
                  className={m.operational.asked ? (m.operational.correct === m.operational.asked ? "ok" : "ko") : ""}
                  title={m.operational.timesChosenWrongly ? `scelta per errore ${m.operational.timesChosenWrongly} volte al posto di un'altra` : undefined}
                >
                  {m.operational.asked ? `${m.operational.correct}/${m.operational.asked}` : "—"}
                  {m.operational.timesChosenWrongly > 0 && <span className="flag"> ✕{m.operational.timesChosenWrongly}</span>}
                </td>
              )}
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
        se la clausola è stata compresa. La colonna Frizione applica la regola della convergenza: ogni sensore
        conta al massimo un indizio, il corpo da solo non colora mai. Il punteggio non giudica le persone: fa la
        diagnosi ai documenti.
      </p>

      <section className="card dossier">
        <h2>Il fascicolo</h2>
        <p className="hint">
          Misure, dichiarazioni e test in un PDF con la data: la prova da esibire al posto del click. Contiene la
          sintesi, la mappa della frizione, risposte e compiti, il metodo dichiarato, la costituzione applicata e
          l'impronta SHA-256 del JSON di sessione, così che ogni numero sia ricalcolabile.
        </p>
        <div className="row">
          <input
            id="responsible"
            placeholder="Chi risponde di questo documento (il nome sul cartello)"
            value={responsible}
            onChange={(e) => setResponsible(e.target.value)}
          />
          <button className="primary" disabled={building} onClick={makeDossier}>
            {building ? "Genero il fascicolo…" : "Genera il fascicolo (PDF)"}
          </button>
        </div>
      </section>

      <div className="actions">
        <button onClick={() => download(`${stamp}-clausole.csv`, clausesCsv(session, metrics, friction), "text/csv")}>
          Scarica CSV per clausola
        </button>
        <button onClick={() => download(`${stamp}-frames.csv`, framesCsv(session), "text/csv")} disabled={session.frames.length === 0}>
          Scarica CSV dei campioni grezzi
        </button>
        <button onClick={() => download(`${stamp}.json`, sessionJson(session, doc.clauses, metrics, friction), "application/json")}>
          Scarica JSON della sessione
        </button>
        <button onClick={r.reset}>Nuova sessione</button>
      </div>
    </main>
  );
}
