import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { DOCUMENTS, documentFromPastedText } from "../documents";
import { diagnoseBluetooth, isWebBluetoothAvailable, type BluetoothDiagnosis } from "../mendi/webbluetooth";
import { clausesCsv, download, framesCsv, segmentsCsv, sessionJson, vitalsCsv } from "../session/export";
import { LX_ACCESSIBILITY_THRESHOLD, lxScore } from "../session/lx";
import { clauseMetrics } from "../session/metrics";
import type { Document } from "../session/model";
import { Sparkline } from "./Sparkline";
import { Operate, Verify } from "./VerifyOperate";
import { AggregateScreen } from "./AggregateScreen";
import { Stepper } from "./Stepper";
import { FrictionStrip } from "./FrictionStrip";
import { DEFAULT_READING, type ReadingOptions } from "./useRecorder";
import { analyzeSegments, autoDurationMs, READING_MODES, type SegmentMetrics } from "../session/segments";
import { HRF_DESCRIPTION } from "../session/hrf";
import { frictionMap } from "../session/friction";
import { useRecorder } from "./useRecorder";

const BASELINE_SECONDS = 30;

export function App() {
  const r = useRecorder();
  const [mode, setMode] = useState<"session" | "aggregate">("session");
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">HM</span>
          Habeas Mentem Lab <span>· LX Reader</span>
        </div>
        <div className="status">
          {r.phase === "setup" && (
            <button className="linklike" onClick={() => setMode(mode === "session" ? "aggregate" : "session")}>
              {mode === "session" ? "Fascicolo aggregato" : "Nuova sessione"}
            </button>
          )}
          {r.device ? (
            <span className="pill ok">
              <span className={`dot ${r.received > 0 ? "live" : ""}`} />
              {r.device.name}
              {r.device.simulated ? " (sim)" : ""}
              {r.battery ? ` · ${(r.battery.voltageMv / 1000).toFixed(2)} V` : ""}
              {r.heart?.bpm ? ` · ♥ ${r.heart.bpm}` : ""}
            </span>
          ) : (
            <span className="pill"><span className="dot" /> nessuna fascia</span>
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
      {r.phase === "rest" && <RestScreen r={r} />}
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
  const [reading, setReadingOpts] = useState<ReadingOptions>(DEFAULT_READING);
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

  const docInfo = (d: Document) => {
    const words = d.clauses.reduce((n, c) => n + c.wordCount, 0);
    const lx = Math.round(d.clauses.reduce((n, c) => n + lxScore(c.text).total, 0) / Math.max(1, d.clauses.length));
    return { words, minutes: Math.max(1, Math.round(words / 200)), lx };
  };
  const [step, setStep] = useState(-1);
  const STEPS = ["Fascia", "Documento", "Presentazione", "Consenso"];
  const modeLabel = READING_MODES.find((m) => m.id === reading.mode)?.label ?? "";
  const canNext = step === 0 ? true : step === 1 ? !!doc : step === 2 ? true : consent;
  const next = () => setStep((x) => Math.min(STEPS.length - 1, x + 1));
  const prev = () => setStep((x) => Math.max(-1, x - 1));

  if (step === -1) {
    return (
      <main className="screen wizard">
        <section className="hero">
          <p className="eyebrow">Neuro Legal Cortex · Habeas Mentem Lab</p>
          <h1>Misurare dove il diritto smette di raggiungere chi lo legge</h1>
          <p className="lead">
            Una sessione di lettura con tre indizi indipendenti: il tempo, il corpo, il testo. Nessuno dei tre, da solo,
            dice se hai capito. Si misurano i documenti, mai le persone.
          </p>
          <div className="sensors">
            <div className="sensor"><span className="sensor-name">Tempo</span><span>secondi per clausola o per parola, ritorni, fermate</span></div>
            <div className="sensor"><span className="sensor-name">Corpo</span><span>fascia Mendi (fNIRS): ΔHbO prefrontale, battito. Indizi, non giudizi</span></div>
            <div className="sensor"><span className="sensor-name">Testo</span><span>LX Complexity Score: lingua, affollamento, ordine, distanza semantica</span></div>
          </div>
          <details>
            <summary>Perché questo laboratorio</summary>
            <p>
              Habeas Mentem è il diritto di ogni persona a comprendere, giudicare e decidere in condizioni che non siano state
              progettate contro di lei. Meno dell'1% delle persone legge i documenti giuridici; più del 90% li accetta comunque.
              Il laboratorio osserva la lettura e non fonde mai gli indizi in un giudizio.
            </p>
          </details>
        </section>
        <div className="wiz-nav">
          <span className="hint">Quattro passi, poi si legge. Circa un minuto.</span>
          <div className="right">
            <button className="primary big" onClick={() => setStep(0)}>Prepara la sessione →</button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="screen wizard">
      <div className="wiz-head">
        <span className="wiz-step">Passo {step + 1} di {STEPS.length} · {STEPS[step]}</span>
        <div className="wiz-dots" aria-hidden="true">
          {STEPS.map((_, i) => <span key={i} className={`wiz-dot ${i < step ? "done" : i === step ? "on" : ""}`} />)}
        </div>
      </div>

      {step === 0 && (
        <div className="wiz-body" key="s0">
          <h1>La fascia Mendi</h1>
          <p className="lead">Facoltativa. Con la fascia si aggiunge il corpo ai tre indizi; senza, resta il tempo. È il diritto di non essere misurati.</p>
          {r.device ? (
            <>
              <div className="row">
                <span className="pill ok"><span className={`dot ${r.received > 0 ? "live" : ""}`} /> {r.device.name}{r.device.firmwareVersion ? ` · fw ${r.device.firmwareVersion}` : ""}{r.heart?.bpm ? ` · ♥ ${r.heart.bpm}` : ""}</span>
                <button onClick={r.disconnect}>scollega</button>
              </div>
              {!r.device.simulated && (
                <>
                  <div className={`diag ${r.received > 0 ? "diag-ok" : "diag-bad"}`}>
                    <strong>{r.received > 0 ? `La fascia trasmette: ${r.received} campioni ricevuti.` : "Collegata, ma ancora nessun campione."}</strong>
                    {r.received === 0 && (
                      <span className="diag-detail">
                        I LED sulla fronte devono accendersi. Se restano spenti, premi «sonda di accensione» e guarda i LED durante la prova (circa 60 secondi); poi «copia il log».
                      </span>
                    )}
                  </div>
                  <details className="details">
                    <summary>Strumenti e log della fascia</summary>
                    <div className="row">
                      <button className="primary" onClick={r.probe}>sonda di accensione</button>
                      <button onClick={r.wake}>riaccendi LED e sensore</button>
                      <button onClick={() => navigator.clipboard?.writeText(r.btLog.join("\n")).catch(() => undefined)}>copia il log</button>
                    </div>
                    <pre className="btlog" id="btlog">{r.btLog.join("\n")}</pre>
                  </details>
                </>
              )}
            </>
          ) : (
            <>
              <div className="row">
                <button className="primary big" disabled={!bluetooth || blocked || r.connecting} onClick={() => r.connect(false, acceptAll)}>
                  {r.connecting ? "connessione…" : "Collega la fascia"}
                </button>
                <button disabled={r.connecting} onClick={() => r.connect(true)}>Fascia simulata</button>
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
              {r.btLog.length > 0 && <pre className="btlog" id="btlog">{r.btLog.join("\n")}</pre>}
              <p className="hint">Chrome o Edge su Mac, Windows e Android; su iPhone l'app Bluefy. App Mendi chiusa sul telefono.</p>
            </>
          )}
        </div>
      )}

      {step === 1 && (
        <div className="wiz-body" key="s1">
          <h1>Il documento</h1>
          <p className="lead">Tre documenti scritti come li scriverebbe uno studio serio, con la legge citata al posto giusto, oppure un tuo testo. LX è la difficoltà stimata del testo, mai della persona.</p>
          <div className="doc-grid">
            {DOCUMENTS.map((d) => {
              const i = docInfo(d);
              return (
                <button key={d.id} className={`doc-card ${docId === d.id ? "on" : ""}`} onClick={() => setDocId(d.id)}>
                  <span className="doc-title">{d.title.replace(" (modello)", "")}</span>
                  <span className="doc-meta">
                    <span>{d.clauses.length} clausole</span>
                    <span>~{i.minutes} min</span>
                    <span className={`lx ${i.lx > LX_ACCESSIBILITY_THRESHOLD ? "lx-high" : "lx-ok"}`} title="LX medio stimato">LX {i.lx}</span>
                  </span>
                </button>
              );
            })}
            <button className={`doc-card ${docId === "__paste__" ? "on" : ""}`} onClick={() => setDocId("__paste__")}>
              <span className="doc-title">Incolla un tuo testo…</span>
              <span className="doc-meta"><span>un'informativa vera, un contratto, un bando: una riga vuota tra le clausole, i titoli su una riga senza punto</span></span>
            </button>
          </div>
          {docId === "__paste__" && (
            <div className="paste">
              <input placeholder="Titolo del documento" value={pasteTitle} onChange={(e) => setPasteTitle(e.target.value)} />
              <textarea
                rows={8}
                placeholder="Incolla qui il testo. Le clausole si separano con una riga vuota; una riga breve senza punto finale è letta come titolo."
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
              />
              {doc && <span className="hint">{doc.clauses.length} clausole riconosciute.</span>}
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="wiz-body" key="s2">
          <h1>Come presentare il testo</h1>
          <p className="lead">Parola per parola si misura il tempo, e solo a porzioni. Il corpo risponde 4–8 secondi dopo e viene attribuito con un modello.</p>
          <div className="modes">
            {READING_MODES.map((m) => (
              <label key={m.id} className={`mode ${reading.mode === m.id ? "on" : ""}`}>
                <input type="radio" name="mode" checked={reading.mode === m.id} onChange={() => setReadingOpts({ ...reading, mode: m.id })} />
                <span className="mode-icon" aria-hidden="true">
                  {m.id === "clausola" && <i style={{ width: 40 }} />}
                  {m.id === "porzioni" && <><i style={{ width: 14 }} /><i style={{ width: 10 }} /><i style={{ width: 12 }} /></>}
                  {m.id === "scorrimento" && <><i style={{ width: 8 }} /><i style={{ width: 8 }} /><i style={{ width: 8 }} /><i style={{ width: 8 }} /></>}
                </span>
                <span className="mode-label">{m.label}</span>
                <span className="mode-note">{m.note}</span>
              </label>
            ))}
          </div>
          {reading.mode === "scorrimento" && (
            <label className="range">
              <span>Ritmo: <strong>{reading.wordsPerMinute}</strong> parole al minuto</span>
              <input type="range" min={100} max={300} step={10} value={reading.wordsPerMinute} onChange={(e) => setReadingOpts({ ...reading, wordsPerMinute: Number(e.target.value) })} />
            </label>
          )}
          <label className="check small">
            <input type="checkbox" checked={reading.restSeconds > 0} onChange={(e) => setReadingOpts({ ...reading, restSeconds: e.target.checked ? 12 : 0 })} /> pausa di fissazione di 12 s tra le clausole: disegno a blocchi, il segnale corporeo si legge meglio
          </label>
          <label className="check small">
            <input type="checkbox" checked={reading.recordVoice} onChange={(e) => setReadingOpts({ ...reading, recordVoice: e.target.checked })} /> registra la voce (lettura ad alta voce; resta nel browser)
          </label>
        </div>
      )}

      {step === 3 && (
        <div className="wiz-body" key="s3">
          <h1>Il consenso</h1>
          <p className="lead">La costituzione della misurazione, applicata a questa sessione.</p>
          <ul className="charter">
            <li><span><strong>Una sola finalità.</strong> Migliorare la comprensibilità del documento. Nessun uso ulteriore: i dati non profilano, non selezionano, non influenzano.</span></li>
            <li><span><strong>Si misurano i documenti, mai le persone.</strong> Se una clausola perde chi la legge, il difetto è della clausola.</span></li>
            <li><span><strong>Il minimo necessario.</strong> Tempo, navigazione e, con la fascia, segnali ottici e di movimento. Nessun nome: uno pseudonimo casuale. Nulla va a un server.</span></li>
            <li><span><strong>Il metodo è pubblico.</strong> Indicatori, formule e soglie sono nel codice; ogni punteggio si ricalcola dai dati esportati.</span></li>
            <li><span><strong>Nessuno è obbligato.</strong> Puoi leggere senza fascia o chiudere la pagina in ogni momento, senza conseguenze.</span></li>
            <li><span><strong>Il segnale della fascia è un indizio.</strong> Non dice se hai capito, non legge pensieri né emozioni.</span></li>
          </ul>
          <div className="pledge">
            <label className="check">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} /> Ho letto e accetto di partecipare a questa sessione.
            </label>
          </div>
          <div className="launch-summary" style={{ marginTop: 12 }}>
            <span className="pill">{doc ? doc.title.replace(" (modello)", "") : "nessun documento"}</span>
            <span className="pill">{modeLabel}</span>
            {reading.restSeconds > 0 && <span className="pill">pause di 12 s</span>}
            <span className="pill">{r.device ? `fascia · baseline ${BASELINE_SECONDS} s` : "senza fascia"}</span>
          </div>
        </div>
      )}

      <div className="wiz-nav">
        <button className="ghost" onClick={prev}>← Indietro</button>
        <div className="right">
          {step < STEPS.length - 1 ? (
            <button className="primary big" disabled={!canNext} onClick={next}>
              {step === 0 && !r.device ? "Continua senza fascia →" : "Avanti →"}
            </button>
          ) : (
            <button className="primary big" disabled={!doc || !consent} onClick={() => doc && r.start(doc, reading)}>
              {r.device ? "Inizia la sessione" : "Inizia senza fascia"}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

function RestScreen({ r }: { r: R }) {
  return (
    <main className="screen center">
      <h1>Un momento di pausa</h1>
      <p className="lead">Sguardo sul punto, testa ferma. Il testo riprende da solo.</p>
      <div className="ring-wrap" aria-live="polite">
        <svg className="ring" viewBox="0 0 120 120" width="180" height="180" aria-label={`${r.restLeft} secondi di pausa`}>
          <circle cx="60" cy="60" r="44" className="ring-breath" />
          <text x="60" y="56" className="ring-plus">+</text>
          <text x="60" y="84" className="ring-num">{r.restLeft}</text>
        </svg>
      </div>
      <p className="hint">La pausa dà al modello un riposo tra un blocco di lettura e l'altro: è così che il segnale lento diventa leggibile.</p>
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

  const q = r.quality;
  const state = (ok: boolean, wait: boolean) => (wait ? "wait" : ok ? "good" : "bad");
  return (
    <main className="screen center">
      <h1>Baseline a riposo</h1>
      <p className="lead">Occhi aperti, sguardo sul punto, testa ferma. Respira con il cerchio. Non leggere nulla.</p>
      <div className="ring-wrap" aria-live="polite">
        <svg className="ring" viewBox="0 0 120 120" width="220" height="220" aria-label={`${Math.max(left, 0)} secondi rimasti`}>
          <circle cx="60" cy="60" r="44" className="ring-breath" />
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
      <div className="quality" aria-label="Qualità del segnale">
        <div className={`q ${state(!!q && q.hz >= 10, !q)}`}>
          <strong>{q ? `${q.hz} campioni/s` : "in attesa"}</strong>
          <span>flusso della fascia (atteso ~25)</span>
        </div>
        <div className={`q ${state(!!q && q.usable >= 0.9, !q || q.samples < 25)}`}>
          <strong>{q && q.samples >= 25 ? `${Math.round(q.usable * 100)}% ottico ok` : "in attesa"}</strong>
          <span>luce sotto controllo, sensori a contatto</span>
        </div>
        <div className={`q ${state(!!q && q.still >= 0.9, !q || q.samples < 25)}`}>
          <strong>{q && q.samples >= 25 ? `${Math.round(q.still * 100)}% fermo` : "in attesa"}</strong>
          <span>testa ferma (accelerometro)</span>
        </div>
      </div>
      <p className="hint">{r.frameCount} campioni raccolti · la baseline è il riferimento di tutta la sessione</p>
    </main>
  );
}

function Reader({ r, doc }: { r: R; doc: Document }) {
  const clause = doc.clauses[r.clauseIndex];
  const segmented = r.reading.mode !== "clausola";
  const auto = r.reading.mode === "scorrimento";
  const segs = useMemo(() => r.segments.filter((x) => x.clauseId === clause.id), [r.segments, clause.id]);
  const current = segs[r.segmentIndex] ?? null;
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
  const lastSegment = !segmented || (last && current !== null && current.index === segs.length - 1);

  // Avanti: porzione o clausola, secondo il modo.
  const forward = () => {
    if (!segmented) {
      if (!last) r.goTo(r.clauseIndex + 1, "forward");
      return;
    }
    if (!r.stepSegment("forward")) r.finishReading();
  };
  const back = () => {
    if (!segmented) {
      if (r.clauseIndex > 0) r.goTo(r.clauseIndex - 1, "back");
      return;
    }
    r.stepSegment("back");
  };

  // Scorrimento: ogni porzione resta il tempo che le spetta al ritmo scelto; in pausa il tempo si ferma.
  useEffect(() => {
    if (!auto || !current || r.paused) return;
    const ms = autoDurationMs(current.wordCount, r.reading.wordsPerMinute);
    const t = setTimeout(() => {
      if (!r.stepSegment("auto")) r.finishReading();
    }, ms);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, current?.id, r.paused]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || (e.key === " " && segmented && !auto)) {
        e.preventDefault();
        forward();
      }
      if (e.key === "ArrowLeft") back();
      if (e.key === " " && auto) {
        e.preventDefault();
        r.togglePause();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <main className="screen reader">
      <div className="progress">
        <span>{doc.title}</span>
        <span className="counter">
          <strong>{clause.index}</strong> / {doc.clauses.length}
          {segmented && current && ` · porzione ${current.index + 1}/${segs.length}`} · {(elapsed / 1000).toFixed(0)} s
          {r.reading.recordVoice && <span className="rec" title="registrazione vocale in corso"> ● REC</span>}
        </span>
      </div>
      <div className="segments" aria-hidden="true">
        {doc.clauses.map((c, i) => (
          <span key={c.id} className={`seg ${i < r.clauseIndex ? "done" : i === r.clauseIndex ? "current" : ""}`} />
        ))}
      </div>
      <article className={`clause ${segmented ? "segmented" : ""}`}>
        {clause.heading && <h2>{clause.heading}</h2>}
        {segmented ? (
          <p className="portions">
            {segs.map((sg) => (
              <span
                key={sg.id}
                className={`portion ${sg.index < r.segmentIndex ? "read" : sg.index === r.segmentIndex ? "now" : "next"}`}
              >
                {sg.text}{" "}
              </span>
            ))}
          </p>
        ) : (
          clause.text.split("\n").map((p, i) => <p key={i}>{p}</p>)
        )}
        {auto && current && (
          <div className={`timerbar ${r.paused ? "paused" : ""}`} aria-hidden="true">
            <i key={current.id} style={{ animationDuration: `${autoDurationMs(current.wordCount, r.reading.wordsPerMinute)}ms` }} />
          </div>
        )}
      </article>
      {r.device && (
        <div className="livebox">
          <Sparkline points={r.live} />
          <span className="hint">
            ΔHbO dal vivo (µM stimati; filtrato 0,01–0,5 Hz, circolazione superficiale del canale corto sottratta, media mobile 2 s). Il segno «5 s fa» ricorda il ritardo della risposta: quel punto corrisponde a ciò che leggevi 5 secondi prima. Bande rosse: movimenti della testa.
            {r.heart?.bpm ? ` Battito ♥ ${r.heart.bpm} bpm${r.baseline?.bpm ? ` (a riposo ${r.baseline.bpm})` : ""}: indicatore sistemico, non cognitivo.` : ""}
          </span>
        </div>
      )}
      {createPortal(
      <div className="readerbar">
        <div className="readerbar-in">
          <button disabled={r.clauseIndex === 0 && (!segmented || r.segmentIndex === 0)} onClick={back}>
            ← Indietro
          </button>
          <span className="hint center">
            {auto
              ? "Le porzioni avanzano da sole. Spazio per fermare il tempo; ← per tornare. Fermate e ritorni sono segnali."
              : segmented
                ? "Spazio o → per la porzione successiva; ← per tornare indietro."
                : "Frecce ← → per muoverti tra le clausole."}
          </span>
          <nav className="actions">
            {auto && (
              <button onClick={r.togglePause} className={r.paused ? "primary" : ""}>
                {r.paused ? "Riprendi ▶" : "Fermati ⏸"}
              </button>
            )}
            {lastSegment ? (
              <button className="primary" onClick={r.finishReading}>
                Ho finito
              </button>
            ) : (
              !auto && (
                <button className="primary" onClick={forward}>
                  Avanti →
                </button>
              )
            )}
          </nav>
        </div>
      </div>,
      document.body,
      )}
    </main>
  );
}

/** Numero che sale fino al valore: il debriefing si rivela, non appare. */
function useCountUp(target: number, ms = 700): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      const eased = 1 - Math.pow(1 - k, 3);
      setV(Math.round(target * eased));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

function Count({ n }: { n: number }) {
  return <>{useCountUp(n)}</>;
}

function Results({ r, doc }: { r: R; doc: Document }) {
  const session = r.session!;
  const metrics = useMemo(() => clauseMetrics(session, doc.clauses), [session, doc]);
  const friction = useMemo(() => frictionMap(metrics), [metrics]);
  const frictionById = new Map(friction.map((f) => [f.clauseId, f]));
  const segmentAnalysis = useMemo(() => analyzeSegments(session, doc.clauses), [session, doc]);
  const segmentRows = segmentAnalysis.rows;
  const hasVerify = doc.questions.length > 0;
  const hasOperate = doc.tasks.length > 0;
  const verifyTotal = session.answers.filter((a) => a.correct).length;
  const operateTotal = session.tasks.filter((t) => t.correct).length;
  const maxAbs = Math.max(...metrics.map((m) => Math.abs(m.effort.mean)), 1e-6);
  const totalMs = metrics.reduce((s, m) => s + m.dwellMs, 0);
  const stamp = session.id;
  const [responsible, setResponsible] = useState("");
  const [building, setBuilding] = useState(false);
  const [dossierError, setDossierError] = useState<string | null>(null);
  const [dossierUrl, setDossierUrl] = useState<{ url: string; name: string; kb: number } | null>(null);
  const [tab, setTab] = useState<"mappa" | "parole" | "dati">("mappa");
  // Il modulo PDF è un chunk separato: lo scarichiamo appena arriviamo ai
  // risultati, così se nel frattempo il sito è stato ripubblicato (e i vecchi
  // chunk non esistono più) ce l'abbiamo già.
  useEffect(() => {
    void import("../session/dossier").catch(() => undefined);
  }, []);
  const makeDossier = async () => {
    setBuilding(true);
    setDossierError(null);
    try {
      const json = sessionJson(session, doc.clauses, metrics, friction, segmentRows);
      const { buildDossier } = await import("../session/dossier");
      const blob = await buildDossier({ session, doc, metrics, friction, sessionJson: json, responsible, segments: segmentRows, modelR2: segmentAnalysis.modelR2 });
      const name = `${stamp}-fascicolo.pdf`;
      if (dossierUrl) URL.revokeObjectURL(dossierUrl.url);
      // Il link resta: se il browser blocca il download automatico, un clic diretto funziona sempre.
      setDossierUrl({ url: URL.createObjectURL(blob), name, kb: Math.round(blob.size / 1024) });
      download(name, blob);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const stale = /import|module|fetch|chunk/i.test(msg);
      setDossierError(
        stale
          ? `Il modulo del PDF non si carica (${msg}). Probabilmente il sito è stato aggiornato mentre la pagina era aperta: scarica subito il JSON e i CSV qui sotto, poi ricarica la pagina.`
          : `Fascicolo non generato: ${msg}. Scarica il JSON qui sotto e mandamelo.`,
      );
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

      {(() => {
        const worst = [...friction].sort((a, b) => {
          const rank = { rosso: 2, giallo: 1, verde: 0 } as const;
          return rank[b.level] - rank[a.level] || b.count - a.count;
        })[0];
        const wm = worst ? metrics.find((m) => m.clauseId === worst.clauseId) : null;
        if (!worst || !wm) return null;
        const name = wm.heading ?? `clausola ${wm.index}`;
        return (
          <div className="insight">
            <span className="insight-mark">!</span>
            <div>
              <p>
                {worst.level === "verde" ? (
                  <>Nessuna clausola perde chi legge in questa sessione: il punto più delicato è <strong>{name}</strong>.</>
                ) : (
                  <>Il punto in cui il testo perde di più chi legge è <strong>{name}</strong> ({worst.level}, {worst.count} {worst.count === 1 ? "indizio" : "indizi"} convergenti).</>
                )}
              </p>
              <p className="hint">{worst.reasons.length ? worst.reasons.join(" · ") : `nessun indizio · LX ${wm.lx.total}`}. Diagnosi del documento, non della persona.</p>
            </div>
          </div>
        );
      })()}

      <div className="board">
        <div className="tile-stat">
          <span className="stat-label">Lettura</span>
          <span className="stat-value"><Count n={Math.round(totalMs / 1000)} /><small> s</small></span>
          <span className="stat-note">{metrics.filter((m) => m.tooFastToRead).length} clausole troppo veloci</span>
        </div>
        {hasVerify && (
          <div className="tile-stat">
            <span className="stat-label">Verifica</span>
            <span className="stat-value"><Count n={verifyTotal} /><small> / {session.answers.length}</small></span>
            <span className="stat-note">risposte corrette</span>
          </div>
        )}
        {hasOperate && (
          <div className="tile-stat">
            <span className="stat-label">Prova operativa</span>
            <span className="stat-value"><Count n={operateTotal} /><small> / {session.tasks.length}</small></span>
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

      <div className="tabs" role="tablist">
        <button className={`tab ${tab === "mappa" ? "on" : ""}`} role="tab" aria-selected={tab === "mappa"} onClick={() => setTab("mappa")}>Mappa della frizione</button>
        {segmentRows.length > 0 && (
          <button className={`tab ${tab === "parole" ? "on" : ""}`} role="tab" aria-selected={tab === "parole"} onClick={() => setTab("parole")}>Parola per parola</button>
        )}
        <button className={`tab ${tab === "dati" ? "on" : ""}`} role="tab" aria-selected={tab === "dati"} onClick={() => setTab("dati")}>Tabella e dati</button>
      </div>

      {tab === "mappa" && (
        <div className="panel">
          <FrictionStrip
            items={friction.map((f) => {
              const m = metrics.find((x) => x.clauseId === f.clauseId)!;
              return { clauseId: f.clauseId, index: m.index, heading: m.heading, level: f.level, count: f.count, reasons: f.reasons };
            })}
          />
        </div>
      )}

      {tab === "parole" && segmentRows.length > 0 && (
        <div className="panel">
          <WordView rows={segmentRows} clauses={doc.clauses} hasBody={!!r.baseline} r2={segmentAnalysis.modelR2} />
        </div>
      )}

      {r.audio && (
        <p className="hint">
          Registrazione vocale: {Math.round(r.audio.blob.size / 1024)} KB, iniziata {new Date(r.audio.startedAt).toLocaleTimeString("it-IT")}.{" "}
          <button onClick={() => download(`${stamp}-voce.webm`, r.audio!.blob)}>scarica l'audio</button>{" "}
          L'allineamento parola per parola dell'audio va fatto fuori dal browser (allineamento forzato); il CSV delle porzioni
          dà i tempi da confrontare.
        </p>
      )}

      <div className="panel" style={{ display: tab === "dati" ? "block" : "none" }}>

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
            {metrics.some((m) => m.pulse) && <th title="Battito medio sulla clausola meno battito a riposo: indicatore sistemico, non cognitivo">♥ Δ bpm</th>}
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
              {metrics.some((x) => x.pulse) && (
                <td>{m.pulse?.deltaBpm != null ? `${m.pulse.deltaBpm >= 0 ? "+" : ""}${m.pulse.deltaBpm.toFixed(0)}` : m.pulse?.bpm ? `${m.pulse.bpm.toFixed(0)}` : "—"}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      <p className="hint">
        ⚠ = oltre 600 parole al minuto: il tempo esclude la lettura completa. LX = stima euristica dell'LX
        Complexity Score (0-100; sopra {LX_ACCESSIBILITY_THRESHOLD} la soglia sperimentale di accessibilità; passa
        il mouse per le quattro dimensioni). Lo sforzo è la variazione media del proxy HbO rispetto alla baseline,
        in µM stimati (Beer-Lambert a due lunghezze d'onda): confrontabile solo tra clausole della stessa sessione. Nessuna colonna, da sola, dice
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
          {dossierUrl && (
            <a className="dossier-link" href={dossierUrl.url} download={dossierUrl.name}>
              Apri il fascicolo ({dossierUrl.kb} KB)
            </a>
          )}
          {dossierError && <p className="diag diag-bad">{dossierError}</p>}
        </div>
      </section>

      <div className="actions">
        <button onClick={() => download(`${stamp}-clausole.csv`, clausesCsv(session, metrics, friction), "text/csv")}>
          Scarica CSV per clausola
        </button>
        <button onClick={() => download(`${stamp}-frames.csv`, framesCsv(session), "text/csv")} disabled={session.frames.length === 0}>
          Scarica CSV dei campioni grezzi
        </button>
        {segmentRows.length > 0 && (
          <button onClick={() => download(`${stamp}-porzioni.csv`, segmentsCsv(session, segmentRows), "text/csv")}>
            Scarica le porzioni (CSV)
          </button>
        )}
        {(session.vitals?.length ?? 0) > 0 && (
          <button onClick={() => download(`${stamp}-battito.csv`, vitalsCsv(session), "text/csv")}>
            Scarica il battito (CSV)
          </button>
        )}
        <button onClick={() => download(`${stamp}.json`, sessionJson(session, doc.clauses, metrics, friction, segmentRows), "application/json")}>
          Scarica JSON della sessione
        </button>
        <button onClick={r.reset}>Nuova sessione</button>
      </div>
    </main>
  );
}

/** Parola per parola: ogni porzione colorata per tempo per parola, oppure per sforzo attribuito con il modello HRF. */
function WordView({ rows, clauses, hasBody, r2 }: { rows: SegmentMetrics[]; clauses: Document["clauses"]; hasBody: boolean; r2: number | null }) {
  const [open, setOpen] = useState<string | null>(null);
  const [by, setBy] = useState<"tempo" | "corpo">("tempo");
  const byClause = new Map<string, SegmentMetrics[]>();
  for (const r of rows) byClause.set(r.clauseId, [...(byClause.get(r.clauseId) ?? []), r]);
  const read = rows.filter((r) => r.msPerWord !== null);
  const median = read.length ? [...read].sort((a, b) => a.msPerWord! - b.msPerWord!)[Math.floor(read.length / 2)].msPerWord! : null;
  const canBody = hasBody && rows.some((r) => r.model);
  const heatOf = (sg: SegmentMetrics) => (sg.msPerWord === null ? "x" : by === "tempo" ? sg.heat : sg.model?.z == null ? "x" : sg.model.heat);
  const labels = by === "tempo" ? ["veloce", "nella norma", "lento", "molto lento", "fermo"] : ["sotto la media", "nella media", "sopra", "alto", "molto alto"];
  return (
    <section className="card wordview">
      <h2>Parola per parola</h2>
      {canBody && (
        <div className="row">
          <button className={by === "tempo" ? "primary" : ""} onClick={() => setBy("tempo")}>Tempo</button>
          <button className={by === "corpo" ? "primary" : ""} onClick={() => setBy("corpo")}>Corpo (modello HRF)</button>
        </div>
      )}
      <p className="hint">
        {by === "tempo"
          ? `Il colore è il tempo per parola di ogni porzione rispetto alla sessione (mediana ${median ? Math.round(median) : "—"} ms/parola): più scuro, più lento. Tocca una porzione per i numeri.`
          : `${HRF_DESCRIPTION}${r2 != null ? ` Varianza spiegata: ${(r2 * 100).toFixed(0)}%.` : ""} Il colore è il peso β di ogni porzione rispetto alla sessione.`}
      </p>
      <div className="legend">
        {[0, 1, 2, 3, 4].map((h) => (
          <span key={h} className={`heat h${h}`}>{labels[h]}</span>
        ))}
      </div>
      {clauses.map((c) => {
        const segs = byClause.get(c.id) ?? [];
        if (segs.length === 0) return null;
        return (
          <div key={c.id} className="wordclause">
            <span className="clause-num">{c.index}</span>
            <p>
              {segs.map((sg) => (
                <span
                  key={sg.segmentId}
                  className={`portion heat h${heatOf(sg)} ${open === sg.segmentId ? "open" : ""}`}
                  onClick={() => setOpen(open === sg.segmentId ? null : sg.segmentId)}
                  title={sg.msPerWord === null ? "non letta" : `${Math.round(sg.msPerWord)} ms/parola · ${(sg.dwellMs / 1000).toFixed(1)} s · ritorni ${sg.returns}${sg.pauses ? ` · fermate ${sg.pauses}` : ""}`}
                >
                  {sg.text}{" "}
                  {open === sg.segmentId && (
                    <span className="portion-detail">
                      {sg.msPerWord === null ? "non letta" : `${Math.round(sg.msPerWord)} ms/parola · ${(sg.dwellMs / 1000).toFixed(1)} s`}
                      {sg.returns > 0 && ` · ${sg.returns} ritorni`}
                      {sg.pauses > 0 && ` · ${sg.pauses} fermate`}
                      {sg.model && ` · β ${sg.model.beta >= 0 ? "+" : ""}${sg.model.beta.toFixed(4)} ± ${sg.model.se.toFixed(4)}`}
                      {hasBody && sg.effort.sampleCount > 0 && ` · finestra +4 s: ${sg.effort.mean >= 0 ? "+" : ""}${sg.effort.mean.toFixed(4)}`}
                    </span>
                  )}
                </span>
              ))}
            </p>
          </div>
        );
      })}
    </section>
  );
}
