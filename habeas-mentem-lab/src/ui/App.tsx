import { useEffect, useMemo, useState } from "react";
import { DOCUMENTS, documentFromPastedText } from "../documents";
import { diagnoseBluetooth, isWebBluetoothAvailable, type BluetoothDiagnosis } from "../mendi/webbluetooth";
import { clausesCsv, download, framesCsv, sessionJson } from "../session/export";
import { LX_ACCESSIBILITY_THRESHOLD } from "../session/lx";
import { clauseMetrics } from "../session/metrics";
import type { Document } from "../session/model";
import { Sparkline } from "./Sparkline";
import { Operate, Verify } from "./VerifyOperate";
import { AggregateScreen } from "./AggregateScreen";
import { Stepper } from "./Stepper";
import { FrictionStrip } from "./FrictionStrip";
import { frictionMap } from "../session/friction";
import { useRecorder } from "./useRecorder";

const BASELINE_SECONDS = 30;

export function App() {
  const r = useRecorder();
  const [mode, setMode] = useState<"session" | "aggregate">("session");
  return (
    <div className="app">
      <header className="topbar">
        <div>
          <strong>Habeas Mentem Lab</strong> · LX Reader
        </div>
        <div className="status">
          {r.phase === "setup" && (
            <button className="linklike" onClick={() => setMode(mode === "session" ? "aggregate" : "session")}>
              {mode === "session" ? "Fascicolo aggregato" : "Nuova sessione"}
            </button>
          )}
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

      {mode === "session" && r.phase !== "setup" && r.document && (
        <Stepper
          phase={r.phase}
          skip={[
            ...(r.device ? [] : ["baseline"]),
            ...(r.document.questions.length ? [] : ["verify"]),
            ...(r.document.tasks.length ? [] : ["operate"]),
          ]}
        />
      )}

      {r.error && (
        <div className="banner error">
          {r.error} <button onClick={r.clearError}>chiudi</button>
        </div>
      )}

      {r.phase === "setup" && mode === "aggregate" && <AggregateScreen onBack={() => setMode("session")} />}
      {r.phase === "setup" && mode === "session" && <Setup r={r} />}
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
  const [acceptAll, setAcceptAll] = useState(false);
  const [diag, setDiag] = useState<BluetoothDiagnosis | null>(null);
  const bluetooth = isWebBluetoothAvailable();
  useEffect(() => {
    diagnoseBluetooth().then(setDiag);
  }, []);
  const blocked = !!diag && (!diag.api || !diag.secureContext || diag.inIframe);

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
          <>
            <p>
              Collegata: <strong>{r.device.name}</strong>
              {r.device.firmwareVersion ? ` · firmware ${r.device.firmwareVersion}` : ""}{" "}
              <button onClick={r.disconnect}>scollega</button>
            </p>
            {!r.device.simulated && (
              <>
                <div className={`diag ${r.received > 0 ? "diag-ok" : "diag-bad"}`}>
                  <strong>{r.received > 0 ? `La fascia trasmette: ${r.received} campioni ricevuti.` : "Collegata, ma ancora nessun campione."}</strong>
                  {r.received === 0 && (
                    <span className="diag-detail">
                      I LED sulla fronte devono accendersi. Se restano spenti, premi «sonda di accensione» e guarda i LED durante la prova (circa 30 secondi); poi «copia il log».
                    </span>
                  )}
                </div>
                <div className="row">
                  <button className="primary" onClick={r.probe}>sonda di accensione</button>
                  <button onClick={r.wake}>riaccendi LED e sensore</button>
                  <button onClick={() => navigator.clipboard?.writeText(r.btLog.join("\n")).catch(() => undefined)}>copia il log</button>
                </div>
                <pre className="btlog" id="btlog">
                  {r.btLog.join("\n")}
                </pre>
              </>
            )}
          </>
        ) : (
          <>
            <div className="row">
              <button className="primary" disabled={!bluetooth || blocked || r.connecting} onClick={() => r.connect(false, acceptAll)}>
                {r.connecting ? "connessione…" : "Collega la fascia (Bluetooth)"}
              </button>
              <button disabled={r.connecting} onClick={() => r.connect(true)}>
                Usa la fascia simulata
              </button>
              <label className="check small">
                <input type="checkbox" checked={acceptAll} onChange={(e) => setAcceptAll(e.target.checked)} /> mostra tutti i dispositivi
              </label>
            </div>
            {diag && (
              <div className={`diag ${blocked || diag.adapterAvailable === false ? "diag-bad" : "diag-ok"}`}>
                <strong>Diagnostica Bluetooth.</strong> {diag.verdict}
                <span className="diag-detail">
                  API {diag.api ? "sì" : "no"} · https/localhost {diag.secureContext ? "sì" : "no"} · riquadro {diag.inIframe ? "sì" : "no"} · adattatore{" "}
                  {diag.adapterAvailable === null ? "?" : diag.adapterAvailable ? "acceso" : "spento"}
                </span>
              </div>
            )}
            {r.btLog.length > 0 && (
              <pre className="btlog" id="btlog">
                {r.btLog.join("\n")}
              </pre>
            )}
          </>
        )}
        <p className="hint">
          La fascia si collega direttamente al browser, senza l'app Mendi (che va chiusa sul telefono: tiene occupata
          la connessione). Funziona con Chrome o Edge su Mac, Windows e Android; su iPhone con l'app Bluefy. Si può
          anche leggere senza fascia: resta attivo il solo sensore del tempo. È il diritto di non essere misurati,
          applicato al laboratorio.
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
      <div className="ring-wrap" aria-live="polite">
        <svg className="ring" viewBox="0 0 120 120" width="220" height="220" aria-label={`${Math.max(left, 0)} secondi rimasti`}>
          <circle cx="60" cy="60" r="52" className="ring-track" />
          <circle
            cx="60" cy="60" r="52"
            className="ring-fill"
            style={{ strokeDasharray: 2 * Math.PI * 52, strokeDashoffset: (2 * Math.PI * 52 * (1 - Math.max(left, 0) / BASELINE_SECONDS)) }}
          />
          <text x="60" y="56" className="ring-plus">+</text>
          <text x="60" y="84" className="ring-num">{Math.max(left, 0)}</text>
        </svg>
      </div>
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
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" && !last) r.goTo(r.clauseIndex + 1, "forward");
      if (e.key === "ArrowLeft" && r.clauseIndex > 0) r.goTo(r.clauseIndex - 1, "back");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [r, last]);
  return (
    <main className="screen reader">
      <div className="progress">
        <span>{doc.title}</span>
        <span className="counter">
          <strong>{clause.index}</strong> / {doc.clauses.length} · {(elapsed / 1000).toFixed(0)} s
        </span>
      </div>
      <div className="segments" aria-hidden="true">
        {doc.clauses.map((c, i) => (
          <span key={c.id} className={`seg ${i < r.clauseIndex ? "done" : i === r.clauseIndex ? "current" : ""}`} />
        ))}
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
      <p className="hint center">Frecce ← → per muoverti tra le clausole.</p>
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
        Partecipante <code>{session.participant}</code> · {doc.title}
        {r.baseline ? ` · baseline su ${r.baseline.sampleCount} campioni` : " · senza fascia"}
      </p>

      <div className="board">
        <div className="tile-stat">
          <span className="stat-label">Lettura</span>
          <span className="stat-value">{Math.round(totalMs / 1000)}<small> s</small></span>
          <span className="stat-note">{metrics.filter((m) => m.tooFastToRead).length} clausole troppo veloci</span>
        </div>
        {hasVerify && (
          <div className="tile-stat">
            <span className="stat-label">Verifica</span>
            <span className="stat-value">{verifyTotal}<small> / {session.answers.length}</small></span>
            <span className="stat-note">risposte corrette</span>
          </div>
        )}
        {hasOperate && (
          <div className="tile-stat">
            <span className="stat-label">Prova operativa</span>
            <span className="stat-value">{operateTotal}<small> / {session.tasks.length}</small></span>
            <span className="stat-note">compiti riusciti</span>
          </div>
        )}
        <div className="tile-stat">
          <span className="stat-label">Testo</span>
          <span className="stat-value">{metrics.filter((m) => m.lx.total > LX_ACCESSIBILITY_THRESHOLD).length}<small> / {metrics.length}</small></span>
          <span className="stat-note">clausole con LX sopra {LX_ACCESSIBILITY_THRESHOLD}</span>
        </div>
        <div className="tile-stat">
          <span className="stat-label">Frizione</span>
          <span className="stat-value">
            {friction.filter((f) => f.level === "rosso").length}<small> rosse</small>
          </span>
          <span className="stat-note">
            {friction.filter((f) => f.level === "giallo").length} gialle · {friction.filter((f) => f.level === "verde").length} verdi
          </span>
        </div>
      </div>

      <FrictionStrip
        items={friction.map((f) => {
          const m = metrics.find((x) => x.clauseId === f.clauseId)!;
          return { clauseId: f.clauseId, index: m.index, heading: m.heading, level: f.level, count: f.count, reasons: f.reasons };
        })}
      />

      <details className="details">
        <summary>Tabella completa per clausola</summary>

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
      </details>

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
