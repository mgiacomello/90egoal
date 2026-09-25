// Il fascicolo aggregato: più lettori sullo stesso documento.
//
// Dal libro: «Per diagnosticare un documento servono cento lettori
// volontari in un laboratorio, non l'osservazione continua di milioni di
// utenti», e «chi non può permettersi un laboratorio può sempre permettersi
// un cronometro e cinque lettori veri». La misurazione che serve al diritto
// «è aggregata e anonima».
//
// Qui si importano i JSON di più sessioni sullo stesso documento e si
// calcola, per clausola, dove i lettori si perdono. Gli pseudonimi non
// vengono riportati: conta solo quanti erano.

import { LX_ACCESSIBILITY_THRESHOLD, type LxScore } from "./lx";
import type { Friction, FrictionIndicators, FrictionLevel } from "./friction";
import type { ClauseMetrics } from "./metrics";
import type { Clause } from "./model";

/** Il JSON esportato da una sessione (schema habeas-mentem-lab/session/v1). */
export interface SessionExport {
  schema: string;
  exportedAt: string;
  session: {
    id: string;
    documentId: string;
    documentTitle: string;
    device: { name: string; simulated: boolean } | null;
    createdAt: number;
    answers: { clauseId: string; correct: boolean }[];
    tasks: { clauseId: string; chosenClauseId: string; correct: boolean }[];
  };
  clauses: Clause[];
  metrics: ClauseMetrics[];
  friction?: Friction[];
}

export interface AggregateClause {
  clauseId: string;
  index: number;
  heading: string | null;
  wordCount: number;
  /** Lettori che hanno aperto la clausola. */
  readers: number;
  dwellMedianMs: number;
  /** Quota di lettori con tempo incompatibile con la lettura. */
  tooFastShare: number;
  /** Quota di lettori tornati indietro su questa clausola almeno una volta. */
  returnedShare: number;
  lx: LxScore;
  verification: { asked: number; correct: number; accuracy: number | null };
  operational: { asked: number; correct: number; success: number | null; timesChosenWrongly: number };
  /** Sforzo medio tra i lettori con segnale, e quanti erano. */
  effort: { mean: number | null; readersWithSignal: number };
  /** Quota di lettori per cui la clausola era gialla o rossa nella propria sessione. */
  lostShare: number;
  friction: { level: FrictionLevel; indicators: FrictionIndicators; count: number; reasons: string[] };
}

export interface Aggregate {
  documentId: string;
  documentTitle: string;
  sessions: number;
  sessionsWithSignal: number;
  simulatedSessions: number;
  firstSession: number;
  lastSession: number;
  clauses: AggregateClause[];
}

export class AggregateError extends Error {}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function parseSessionExport(text: string, filename = "file"): SessionExport {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new AggregateError(`${filename}: non è un JSON valido.`);
  }
  const d = data as Partial<SessionExport>;
  if (d.schema !== "habeas-mentem-lab/session/v1" || !d.session || !Array.isArray(d.metrics) || !Array.isArray(d.clauses)) {
    throw new AggregateError(`${filename}: non è un'esportazione di sessione di Habeas Mentem Lab.`);
  }
  return d as SessionExport;
}

/** Soglie dell'aggregato: quote di lettori, non singoli esiti. Dichiarate qui e nel fascicolo. */
export const AGGREGATE_THRESHOLDS = {
  /** Quota di lettori troppo veloci, o tornati indietro, perché il tempo conti come indizio. */
  timeShare: 0.5,
  /** Accuratezza della verifica sotto la quale la clausola perde i lettori. */
  verifyAccuracy: 0.7,
  /** Riuscita della prova operativa sotto la quale il diritto non è esercitabile. */
  operateSuccess: 0.7,
  /** Risposte o compiti minimi perché verifica e prova contino. */
  minAnswers: 3,
  /** Lettori con segnale minimi perché il corpo conti. */
  minSignalReaders: 3,
};

export function aggregateSessions(exports: SessionExport[]): Aggregate {
  if (exports.length === 0) throw new AggregateError("Nessuna sessione da aggregare.");
  const first = exports[0];
  const docId = first.session.documentId;
  const mismatched = exports.filter((e) => e.session.documentId !== docId || e.clauses.length !== first.clauses.length);
  if (mismatched.length > 0) {
    throw new AggregateError(
      `Le sessioni devono riguardare lo stesso documento: ${mismatched.length} su ${exports.length} hanno un documento o un numero di clausole diverso (${mismatched.map((m) => m.session.id).join(", ")}).`,
    );
  }
  const T = AGGREGATE_THRESHOLDS;
  const withSignal = exports.filter((e) => e.metrics.some((m) => m.effort.sampleCount > 0));

  const clauses: AggregateClause[] = first.clauses.map((c) => {
    const rows = exports.map((e) => e.metrics.find((m) => m.clauseId === c.id)).filter((m): m is ClauseMetrics => !!m);
    const opened = rows.filter((m) => m.dwellMs > 0);
    const tooFast = opened.filter((m) => m.tooFastToRead).length;
    const returned = opened.filter((m) => m.returns > 0).length;
    const vAsked = rows.reduce((s, m) => s + m.verification.asked, 0);
    const vCorrect = rows.reduce((s, m) => s + m.verification.correct, 0);
    const oAsked = rows.reduce((s, m) => s + m.operational.asked, 0);
    const oCorrect = rows.reduce((s, m) => s + m.operational.correct, 0);
    const oWrong = rows.reduce((s, m) => s + m.operational.timesChosenWrongly, 0);
    const signalRows = rows.filter((m) => m.effort.sampleCount > 0);
    const effortMean = signalRows.length ? signalRows.reduce((s, m) => s + m.effort.mean, 0) / signalRows.length : null;
    const lost = exports.filter((e) => {
      const f = e.friction?.find((x) => x.clauseId === c.id);
      return f && f.level !== "verde";
    }).length;
    return {
      clauseId: c.id,
      index: c.index,
      heading: c.heading,
      wordCount: c.wordCount,
      readers: opened.length,
      dwellMedianMs: median(opened.map((m) => m.dwellMs)),
      tooFastShare: opened.length ? tooFast / opened.length : 0,
      returnedShare: opened.length ? returned / opened.length : 0,
      lx: rows[0]?.lx ?? first.metrics[0].lx,
      verification: { asked: vAsked, correct: vCorrect, accuracy: vAsked ? vCorrect / vAsked : null },
      operational: { asked: oAsked, correct: oCorrect, success: oAsked ? oCorrect / oAsked : null, timesChosenWrongly: oWrong },
      effort: { mean: effortMean, readersWithSignal: signalRows.length },
      lostShare: exports.length ? lost / exports.length : 0,
      friction: { level: "verde", indicators: { time: false, body: false, text: false, verify: false, operate: false }, count: 0, reasons: [] },
    };
  });

  // Corpo: terzo più alto dello sforzo medio tra le clausole con abbastanza lettori con segnale.
  const eligible = clauses.filter((c) => c.effort.mean !== null && c.effort.readersWithSignal >= T.minSignalReaders);
  const efforts = eligible.map((c) => c.effort.mean as number).sort((a, b) => a - b);
  const bodyThreshold = efforts.length >= 3 ? efforts[Math.floor((efforts.length * 2) / 3)] : Infinity;

  for (const c of clauses) {
    const pct = (x: number) => `${Math.round(x * 100)}%`;
    const indicators: FrictionIndicators = {
      time: c.readers > 0 && (c.tooFastShare >= T.timeShare || c.returnedShare >= T.timeShare),
      body: c.effort.mean !== null && c.effort.readersWithSignal >= T.minSignalReaders && efforts.length >= 3 && c.effort.mean >= bodyThreshold && c.effort.mean > 0,
      text: c.lx.total > LX_ACCESSIBILITY_THRESHOLD,
      verify: c.verification.asked >= T.minAnswers && (c.verification.accuracy as number) < T.verifyAccuracy,
      operate: c.operational.asked >= T.minAnswers && (c.operational.success as number) < T.operateSuccess,
    };
    const reasons: string[] = [];
    if (c.tooFastShare >= T.timeShare && c.readers > 0) reasons.push(`${pct(c.tooFastShare)} dei lettori troppo veloci`);
    else if (c.returnedShare >= T.timeShare && c.readers > 0) reasons.push(`${pct(c.returnedShare)} dei lettori tornati indietro`);
    if (indicators.body) reasons.push(`sforzo nel terzo più alto (${c.effort.readersWithSignal} lettori con segnale)`);
    if (indicators.text) reasons.push(`LX ${c.lx.total} sopra la soglia`);
    if (indicators.verify) reasons.push(`verifica: ${c.verification.correct}/${c.verification.asked} corrette`);
    if (indicators.operate) reasons.push(`prova operativa: ${c.operational.correct}/${c.operational.asked} riuscite`);
    const count = Object.values(indicators).filter(Boolean).length;
    const strong = indicators.verify || indicators.operate;
    let level: FrictionLevel = "verde";
    if (count >= 3 && strong) level = "rosso";
    else if (count >= 2 || strong) level = "giallo";
    c.friction = { level, indicators, count, reasons };
  }

  const times = exports.map((e) => e.session.createdAt);
  return {
    documentId: docId,
    documentTitle: first.session.documentTitle,
    sessions: exports.length,
    sessionsWithSignal: withSignal.length,
    simulatedSessions: exports.filter((e) => e.session.device?.simulated).length,
    firstSession: Math.min(...times),
    lastSession: Math.max(...times),
    clauses,
  };
}
