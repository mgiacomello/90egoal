// Il fascicolo di comprensibilità.
//
// Dal libro: «Oggi quella prova è un log. La casella era spuntata, il tasto
// è stato premuto. Domani può essere un fascicolo. Il documento aveva un
// punteggio di complessità misurato e ridotto, il flusso è stato testato su
// lettori reali, la clausola critica è stata vista, il tempo era compatibile
// con la lettura.» E dal Cantiere: «Misure, dichiarazioni e test finiscono
// nel fascicolo, con la data, prima di ogni contestazione.»
//
// Questo modulo produce il PDF di una sessione: sintesi, metodo dichiarato
// (art. 4: il metodo è pubblico), tabella per clausola con la mappa della
// frizione, risposte e compiti, la costituzione applicata, lo spazio per il
// nome di chi risponde del documento e l'impronta dei dati esportati.

import { jsPDF } from "jspdf";
import autoTable, { type CellHookData } from "jspdf-autotable";
import { LX_ACCESSIBILITY_THRESHOLD } from "./lx";
import type { Friction } from "./friction";
import type { ClauseMetrics } from "./metrics";
import type { Document, Session } from "./model";
import { AGGREGATE_THRESHOLDS, type Aggregate } from "./aggregate";
import { BOOK_R, describeWeights, type Calibration } from "./calibrate";
import { slowestSegments, type SegmentMetrics } from "./segments";

export interface DossierInput {
  session: Session;
  doc: Document;
  metrics: ClauseMetrics[];
  friction: Friction[];
  /** JSON della sessione già serializzato: l'impronta lo lega al fascicolo. */
  sessionJson: string;
  /** Nome di chi risponde del documento ("il nome sul cartello"). Facoltativo. */
  responsible?: string;
  /** Metriche parola per parola (solo nei modi a porzioni). */
  segments?: SegmentMetrics[];
}

/** SHA-256 esadecimale, con WebCrypto; in ambienti senza crypto ritorna null. */
export async function fingerprint(text: string): Promise<string | null> {
  try {
    const bytes = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return null;
  }
}

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleString("it-IT", { dateStyle: "long", timeStyle: "short" });
}

function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)} s`;
}

/** Le frasi di sintesi che il fascicolo dichiara: ciò che i dati mostrano, ciò che non mostrano. */
export function dossierSummary(input: DossierInput): string[] {
  const { session, doc, metrics, friction } = input;
  const totalMs = metrics.reduce((s, m) => s + m.dwellMs, 0);
  const tooFast = metrics.filter((m) => m.tooFastToRead).length;
  const overLx = metrics.filter((m) => m.lx.total > LX_ACCESSIBILITY_THRESHOLD).length;
  const lxMean = Math.round(metrics.reduce((s, m) => s + m.lx.total, 0) / Math.max(metrics.length, 1));
  const red = friction.filter((f) => f.level === "rosso").length;
  const yellow = friction.filter((f) => f.level === "giallo").length;
  const lines = [
    `Documento di ${doc.clauses.length} clausole, ${doc.clauses.reduce((s, c) => s + c.wordCount, 0)} parole. Lettura totale ${seconds(totalMs)}.`,
    `Tempo: ${tooFast} clausole su ${metrics.length} viste per un tempo incompatibile con la lettura completa (oltre 600 parole al minuto).`,
    `Testo: LX Complexity Score medio ${lxMean}/100; ${overLx} clausole sopra la soglia sperimentale di accessibilità (${LX_ACCESSIBILITY_THRESHOLD}).`,
  ];
  if (session.answers.length > 0) {
    const ok = session.answers.filter((a) => a.correct).length;
    lines.push(`Verifica: ${ok} risposte corrette su ${session.answers.length}.`);
  }
  if (session.tasks.length > 0) {
    const ok = session.tasks.filter((t) => t.correct).length;
    lines.push(`Prova operativa: ${ok} compiti riusciti su ${session.tasks.length}.`);
  }
  if (session.device) {
    const withSignal = metrics.filter((m) => m.effort.sampleCount > 0).length;
    lines.push(
      `Corpo: ${session.device.name}${session.device.simulated ? " (fascia simulata: segnale non reale)" : ""}, ${session.frames.length} campioni, segnale su ${withSignal} clausole.`,
    );
  } else {
    lines.push("Corpo: nessuna fascia collegata (il partecipante ha letto senza essere misurato).");
  }
  lines.push(`Frizione per convergenza: ${red} clausole rosse, ${yellow} gialle, ${friction.length - red - yellow} verdi.`);
  return lines;
}

const METHOD: string[] = [
  "Tempo: millisecondi per clausola, visite e ritorni; parole al minuto; sopra 600 wpm il tempo esclude la lettura completa.",
  "Corpo (se presente): fascia Mendi, ~25 Hz; baseline a riposo di 30 s; indice di sforzo = od(rosso) - od(IR) rispetto alla baseline, media dei canali frontali, unità arbitrarie; campioni con movimento > 0,15 g segnalati come artefatti.",
  `Testo: stima euristica dell'LX Complexity Score (0-100) su quattro strade: lingua, affollamento, ordine, distanza semantica; calibrata sui valori del corpus BCI (Giacomello, Springer 2026); soglia ${LX_ACCESSIBILITY_THRESHOLD}.`,
  "Verifica: domande a risposta chiusa dopo la lettura, senza rileggere. Prova operativa: ritrovare la clausola che serve, con il documento riapribile.",
  "Convergenza: ogni sensore alza al massimo un indizio per clausola. Rosso con almeno tre indizi di cui uno da verifica o prova; giallo con due, o con una sola verifica o prova fallita; verde altrimenti. Il corpo da solo non colora mai.",
  "Limiti dichiarati: dati esplorativi di una sola sessione; l'LX è una stima di superficie, non il modello calibrato su EEG/fNIRS; il segnale della fascia è un indizio, non una lettura della mente; nessuna colonna, da sola, dice se una clausola è stata compresa.",
];

const CONSTITUTION: string[] = [
  "1. Una sola finalità: migliorare la comprensibilità del documento e provarne l'adeguatezza. Nessun uso secondario.",
  "2. Si misurano i documenti, mai le persone: nessun esito individuale fonda valutazioni sulla persona misurata.",
  "3. Il sensore meno invasivo, i dati minimi: pseudonimo casuale, nessuna rete, strumenti neurofisiologici solo in laboratorio con consenso pieno.",
  "4. Il metodo è pubblico: indicatori, formule e soglie sono dichiarati; ogni punteggio è ricalcolabile dai dati esportati.",
  "5. Nessuno è obbligato a essere misurato: partecipazione volontaria e revocabile, senza conseguenze.",
  "6. Chi misura accetta di essere misurato: il metodo dichiara in anticipo i propri limiti e i risultati che lo smentirebbero.",
];

const margin = 16;
const TABLE_STYLE = {
  margin: { left: margin, right: margin },
  styles: { font: "helvetica" as const, fontSize: 7.5, cellPadding: 1.5, overflow: "linebreak" as const },
  headStyles: { fillColor: [47, 79, 111] as [number, number, number] },
};

/** Lo scrittore di pagina: titoli, paragrafi, elenchi, con il cambio pagina. */
function writer(pdf: jsPDF) {
  const textWidth = pdf.internal.pageSize.getWidth() - margin * 2;
  const state = { y: margin };
  const heading = (text: string, size = 13) => {
    if (state.y > 260) {
      pdf.addPage();
      state.y = margin;
    }
    pdf.setFont("helvetica", "bold").setFontSize(size);
    pdf.text(text, margin, state.y);
    state.y += size * 0.6;
  };
  const paragraph = (text: string, size = 9.5, gap = 2) => {
    pdf.setFont("helvetica", "normal").setFontSize(size);
    const lines = pdf.splitTextToSize(text, textWidth) as string[];
    for (const line of lines) {
      if (state.y > 280) {
        pdf.addPage();
        state.y = margin;
      }
      pdf.text(line, margin, state.y);
      state.y += size * 0.5;
    }
    state.y += gap;
  };
  const bullets = (items: string[], size = 9) => {
    for (const item of items) paragraph(`• ${item}`, size, 1);
    state.y += 2;
  };
  const title = (text: string) => {
    pdf.setFont("helvetica", "bold").setFontSize(18);
    pdf.text(text, margin, state.y);
    state.y += 8;
  };
  const afterTable = () => {
    state.y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  };
  const frictionColor = (levelColumn: number) => (data: CellHookData) => {
    if (data.section === "body" && data.column.index === levelColumn) {
      const v = String(data.cell.raw);
      data.cell.styles.fontStyle = "bold";
      data.cell.styles.textColor = v === "rosso" ? [179, 38, 30] : v === "giallo" ? [160, 120, 0] : [46, 125, 79];
    }
  };
  const closing = async (pdf: jsPDF, json: string, responsible: string | undefined, para: typeof paragraph, head: typeof heading) => {
    head("Chi risponde di questo documento");
    para(
      responsible?.trim()
        ? `Responsabile del documento: ${responsible.trim()}`
        : "Responsabile del documento: ______________________________  (il nome sul cartello del cantiere)",
      9.5,
      2,
    );
    para("Data e firma: ______________________________", 9.5, 4);
    head("Impronta dei dati", 11);
    const hash = await fingerprint(json);
    para(
      hash
        ? `SHA-256 dei dati esportati: ${hash}. Chi possiede i dati può ricalcolare ogni numero di questo fascicolo.`
        : "Impronta non disponibile in questo ambiente. I dati esportati permettono comunque di ricalcolare ogni numero.",
      8,
      2,
    );
    para(`Generato ${fmtDate(Date.now())} da Habeas Mentem Lab (prototipo interno, non commerciale). Si misurano i documenti, mai le persone.`, 8, 0);
    void pdf;
  };
  return { state, heading, paragraph, bullets, title, afterTable, frictionColor, closing };
}

function readingModeLabel(session: Session): string {
  const r = session.reading;
  if (!r || r.mode === "clausola") return "clausola intera";
  if (r.mode === "porzioni") return "a porzioni, al ritmo del lettore";
  return `a porzioni, a scorrimento (${r.wordsPerMinute ?? "?"} parole al minuto)`;
}

export async function buildDossier(input: DossierInput): Promise<Blob> {
  const { session, doc, metrics, friction } = input;
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const w = writer(pdf);
  const { heading, paragraph, bullets } = w;

  w.title("Fascicolo di comprensibilità");
  paragraph(`Documento: ${doc.title}`, 10, 0);
  paragraph(`Sessione ${session.id} · partecipante ${session.participant} · ${fmtDate(session.createdAt)}`, 9, 0);
  paragraph(
    `Consenso del partecipante registrato ${session.consent.timestamp ? fmtDate(session.consent.timestamp) : "—"} · Habeas Mentem Lab, LX Reader`,
    9,
    4,
  );

  heading("1. Sintesi");
  bullets(dossierSummary(input));

  heading("2. Mappa della frizione per clausola");
  const byId = new Map(friction.map((f) => [f.clauseId, f]));
  const hasVerify = session.answers.length > 0;
  const hasOperate = session.tasks.length > 0;
  const hasBody = metrics.some((m) => m.effort.sampleCount > 0);
  const head = ["#", "Clausola", "Parole", "Tempo", "wpm", "Rit.", "LX"];
  if (hasVerify) head.push("Verifica");
  if (hasOperate) head.push("Prova");
  if (hasBody) head.push("Sforzo");
  head.push("Frizione", "Indizi");
  const body = metrics.map((m) => {
    const f = byId.get(m.clauseId)!;
    const row: (string | number)[] = [
      m.index,
      m.heading ?? doc.clauses[m.index - 1].text.slice(0, 40) + "…",
      m.wordCount,
      seconds(m.dwellMs),
      m.wordsPerMinute === null ? "—" : `${Math.round(m.wordsPerMinute)}${m.tooFastToRead ? " !" : ""}`,
      m.returns,
      m.lx.total,
    ];
    if (hasVerify) row.push(m.verification.asked ? `${m.verification.correct}/${m.verification.asked}` : "—");
    if (hasOperate) row.push(m.operational.asked ? `${m.operational.correct}/${m.operational.asked}` : "—");
    if (hasBody) row.push(m.effort.sampleCount ? m.effort.mean.toFixed(4) : "—");
    row.push(f.level, f.reasons.join("; ") || "nessuno");
    return row;
  });
  autoTable(pdf, {
    startY: w.state.y,
    head: [head],
    body,
    ...TABLE_STYLE,
    columnStyles: { 1: { cellWidth: 34 }, [head.length - 1]: { cellWidth: 46 } },
    didParseCell: w.frictionColor(head.length - 2),
  });
  w.afterTable();
  paragraph(
    "! = oltre 600 parole al minuto. LX in scala 0-100 (le quattro strade nel JSON allegato). Lo sforzo è la variazione media rispetto alla baseline, unità arbitrarie, confrontabile solo dentro la sessione.",
    8,
    4,
  );

  if (hasVerify || hasOperate) {
    heading("3. Verifica e prova operativa");
    if (hasVerify) {
      autoTable(pdf, {
        startY: w.state.y,
        head: [["Domanda", "Clausola", "Risposta data", "Esito", "Tempo"]],
        body: session.answers.map((a) => {
          const q = doc.questions.find((x) => x.id === a.questionId);
          return [
            q?.prompt ?? a.questionId,
            doc.clauses.find((c) => c.id === a.clauseId)?.index ?? a.clauseId,
            q ? q.options[a.chosenIndex] : String(a.chosenIndex),
            a.correct ? "corretta" : "errata",
            seconds(a.ms),
          ];
        }),
        ...TABLE_STYLE,
        columnStyles: { 0: { cellWidth: 70 }, 2: { cellWidth: 55 } },
      });
      w.afterTable();
    }
    if (hasOperate) {
      autoTable(pdf, {
        startY: w.state.y,
        head: [["Compito", "Clausola giusta", "Clausola scelta", "Esito", "Aperte", "Tempo"]],
        body: session.tasks.map((t) => {
          const task = doc.tasks.find((x) => x.id === t.taskId);
          const idx = (id: string) => doc.clauses.find((c) => c.id === id)?.index ?? id;
          return [task?.prompt ?? t.taskId, idx(t.clauseId), idx(t.chosenClauseId), t.correct ? "riuscito" : "fallito", t.opened, seconds(t.ms)];
        }),
        ...TABLE_STYLE,
        columnStyles: { 0: { cellWidth: 80 } },
      });
      w.afterTable();
    }
  }

  const segs = input.segments ?? [];
  if (segs.length > 0) {
    heading("4. Parola per parola");
    const median = (() => {
      const xs = segs.filter((r) => r.msPerWord !== null).map((r) => r.msPerWord!).sort((a, b) => a - b);
      return xs.length ? xs[Math.floor(xs.length / 2)] : null;
    })();
    paragraph(
      `Presentazione ${readingModeLabel(session)}${session.reading?.voiceRecorded ? ", con registrazione vocale" : ""}. ` +
        `${segs.length} porzioni; tempo per parola mediano ${median ? Math.round(median) : "—"} ms. ` +
        "Le porzioni più lente della sessione, con il tempo per parola, i ritorni e le fermate. " +
        "Il segnale corporeo, dove presente, è attribuito con 4 s di ritardo emodinamico: è un'attribuzione, non una misura della parola.",
      8.5,
      3,
    );
    const hasBodySeg = segs.some((r) => r.effort.sampleCount > 0);
    const head = ["Cl.", "Porzione", "Parole", "ms/parola", "Rit.", "Ferm."];
    if (hasBodySeg) head.push("Sforzo (ritardato)");
    autoTable(pdf, {
      startY: w.state.y,
      head: [head],
      body: slowestSegments(segs, 12).map((r) => {
        const row: (string | number)[] = [r.clauseIndex, r.text, r.wordCount, Math.round(r.msPerWord!), r.returns, r.pauses];
        if (hasBodySeg) row.push(r.effort.sampleCount ? r.effort.mean.toFixed(4) : "—");
        return row;
      }),
      ...TABLE_STYLE,
      columnStyles: { 1: { cellWidth: 80 } },
    });
    w.afterTable();
  }

  heading(segs.length > 0 ? "5. Metodo dichiarato" : "4. Metodo dichiarato");
  bullets(METHOD, 8.5);

  heading(segs.length > 0 ? "6. La costituzione della misurazione, applicata" : "5. La costituzione della misurazione, applicata");
  bullets(CONSTITUTION, 8.5);

  await w.closing(pdf, input.sessionJson, input.responsible, paragraph, heading);
  return pdf.output("blob");
}

// ── Fascicolo aggregato ──────────────────────────────────────────────────────

export interface AggregateDossierInput {
  aggregate: Aggregate;
  /** JSON dell'aggregato (per l'impronta). */
  aggregateJson: string;
  responsible?: string;
  calibration?: Calibration;
}

export function aggregateSummary(a: Aggregate): string[] {
  const T = AGGREGATE_THRESHOLDS;
  const red = a.clauses.filter((c) => c.friction.level === "rosso").length;
  const yellow = a.clauses.filter((c) => c.friction.level === "giallo").length;
  const worst = [...a.clauses].sort((x, y) => y.lostShare - x.lostShare)[0];
  const vAsked = a.clauses.reduce((s, c) => s + c.verification.asked, 0);
  const vCorrect = a.clauses.reduce((s, c) => s + c.verification.correct, 0);
  const oAsked = a.clauses.reduce((s, c) => s + c.operational.asked, 0);
  const oCorrect = a.clauses.reduce((s, c) => s + c.operational.correct, 0);
  const lines = [
    `${a.sessions} lettori sullo stesso documento (${a.clauses.length} clausole), dal ${fmtDate(a.firstSession)} al ${fmtDate(a.lastSession)}.${a.simulatedSessions ? ` Attenzione: ${a.simulatedSessions} sessioni con fascia simulata (segnale non reale).` : ""}`,
    `Corpo: ${a.sessionsWithSignal} lettori con segnale della fascia${a.sessionsWithSignal < T.minSignalReaders ? ` (sotto il minimo di ${T.minSignalReaders}: il corpo non conta come indizio)` : ""}.`,
    `Frizione per convergenza tra lettori: ${red} clausole rosse, ${yellow} gialle, ${a.clauses.length - red - yellow} verdi.`,
  ];
  if (vAsked) lines.push(`Verifica: ${vCorrect} risposte corrette su ${vAsked} (${Math.round((vCorrect / vAsked) * 100)}%).`);
  if (oAsked) lines.push(`Prova operativa: ${oCorrect} compiti riusciti su ${oAsked} (${Math.round((oCorrect / oAsked) * 100)}%).`);
  if (worst && worst.lostShare > 0) {
    lines.push(`La clausola che perde più lettori è la ${worst.index}${worst.heading ? ` (${worst.heading})` : ""}: gialla o rossa per il ${Math.round(worst.lostShare * 100)}% dei lettori nella propria sessione.`);
  }
  return lines;
}

export async function buildAggregateDossier(input: AggregateDossierInput): Promise<Blob> {
  const a = input.aggregate;
  const T = AGGREGATE_THRESHOLDS;
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const w = writer(pdf);
  const { heading, paragraph, bullets } = w;

  w.title("Fascicolo di comprensibilità — aggregato");
  paragraph(`Documento: ${a.documentTitle}`, 10, 0);
  paragraph(`${a.sessions} sessioni aggregate in forma anonima · Habeas Mentem Lab, LX Reader`, 9, 4);

  heading("1. Sintesi");
  bullets(aggregateSummary(a));

  heading("2. Dove i lettori si perdono");
  const hasVerify = a.clauses.some((c) => c.verification.asked > 0);
  const hasOperate = a.clauses.some((c) => c.operational.asked > 0);
  const hasBody = a.sessionsWithSignal > 0;
  const head = ["#", "Clausola", "Parole", "Lettori", "Tempo mediano", "Troppo veloci", "Tornati", "LX"];
  if (hasVerify) head.push("Verifica");
  if (hasOperate) head.push("Prova");
  if (hasBody) head.push("Sforzo (n)");
  head.push("Persi", "Frizione", "Indizi");
  const pct = (x: number | null) => (x === null ? "—" : `${Math.round(x * 100)}%`);
  const body = a.clauses.map((c) => {
    const row: (string | number)[] = [
      c.index,
      c.heading ?? "—",
      c.wordCount,
      c.readers,
      seconds(c.dwellMedianMs),
      pct(c.tooFastShare),
      pct(c.returnedShare),
      c.lx.total,
    ];
    if (hasVerify) row.push(c.verification.asked ? `${c.verification.correct}/${c.verification.asked}` : "—");
    if (hasOperate) row.push(c.operational.asked ? `${c.operational.correct}/${c.operational.asked}${c.operational.timesChosenWrongly ? ` (scelta per errore ${c.operational.timesChosenWrongly})` : ""}` : "—");
    if (hasBody) row.push(c.effort.mean === null ? "—" : `${c.effort.mean.toFixed(4)} (${c.effort.readersWithSignal})`);
    row.push(pct(c.lostShare), c.friction.level, c.friction.reasons.join("; ") || "nessuno");
    return row;
  });
  autoTable(pdf, {
    startY: w.state.y,
    head: [head],
    body,
    ...TABLE_STYLE,
    columnStyles: { 1: { cellWidth: 40 }, [head.length - 1]: { cellWidth: 60 } },
    didParseCell: w.frictionColor(head.length - 2),
  });
  w.afterTable();
  paragraph(
    "Persi = quota di lettori per cui la clausola era gialla o rossa nella propria sessione. Le quote sono calcolate sui lettori che hanno aperto la clausola.",
    8,
    4,
  );

  heading("3. Metodo dichiarato (aggregato)");
  bullets(
    [
      ...METHOD.slice(0, 4),
      `Convergenza tra lettori: il tempo conta se almeno il ${Math.round(T.timeShare * 100)}% dei lettori è stato troppo veloce o è tornato indietro; la verifica conta con almeno ${T.minAnswers} risposte e accuratezza sotto il ${Math.round(T.verifyAccuracy * 100)}%; la prova con almeno ${T.minAnswers} compiti e riuscita sotto il ${Math.round(T.operateSuccess * 100)}%; il corpo con almeno ${T.minSignalReaders} lettori con segnale e sforzo medio nel terzo più alto. Rosso con almeno tre indizi di cui uno da verifica o prova; giallo con due, o con una sola verifica o prova; verde altrimenti.`,
      "Anonimato: gli pseudonimi delle sessioni non sono riportati; conta solo quanti lettori erano. I dati restano aggregati.",
      METHOD[5],
    ],
    8.5,
  );

  if (input.calibration) {
    const c = input.calibration;
    const fr = (r: number | null) => (r === null ? "—" : r.toFixed(2));
    heading("4. Ricalibrazione dell'LX sui dati");
    if (!c.eligible) {
      paragraph(`${c.reason} Con i pesi attuali (${describeWeights(c.defaultWeights)}) la correlazione tra LX e comprensione è r = ${fr(c.defaultR)}.`, 8.5, 3);
    } else {
      bullets(
        [
          `Pesi attuali: ${describeWeights(c.defaultWeights)} → r = ${fr(c.defaultR)}.`,
          `Pesi ricalibrati su ${c.clauses} clausole e ${c.sessions} lettori: ${describeWeights(c.weights)} → r = ${fr(c.r)}. Nel libro: r = ${BOOK_R.calibration} in calibrazione, ${BOOK_R.validation} in validazione.`,
          c.threshold
            ? `Soglia osservata: ${c.threshold}/100 (sopra, la comprensione media cala di ${Math.round((c.thresholdDrop ?? 0) * 100)} punti); soglia del libro: ${LX_ACCESSIBILITY_THRESHOLD}.`
            : "Nessuna soglia netta osservabile con questi dati.",
          ...c.caveats,
        ],
        8.5,
      );
    }
  }

  heading(`${input.calibration ? 5 : 4}. La costituzione della misurazione, applicata`);
  bullets(CONSTITUTION, 8.5);

  await w.closing(pdf, input.aggregateJson, input.responsible, paragraph, heading);
  return pdf.output("blob");
}
