// Il livello «parola per parola».
//
// La fascia non può misurare una parola: la risposta emodinamica che il
// sensore ottico vede arriva 4-8 secondi dopo lo stimolo e dura altrettanto.
// Ciò che invece si misura con precisione per ogni parola è il TEMPO, se il
// testo viene presentato a porzioni (self-paced reading, il paradigma classico
// della psicolinguistica): ogni porzione ha un istante di comparsa e uno di
// uscita, e il tempo per parola è il suo tempo diviso per le parole che
// contiene. Il segnale corporeo viene attribuito a una porzione con un
// ritardo dichiarato (HEMODYNAMIC_LAG_MS): è un'attribuzione, non una misura
// della parola, e il fascicolo lo dice.

import { summarize, type EffortStats } from "../mendi/signal";
import type { Clause, Session } from "./model";

/** Ritardo con cui la risposta emodinamica segue lo stimolo (ms). */
export const HEMODYNAMIC_LAG_MS = 4000;
/** Finestra minima di attribuzione: sotto, il segnale non ha senso (ms). */
export const MIN_ATTRIBUTION_MS = 2000;
/** Parole per porzione: si spezza alla punteggiatura e prima dei connettivi. */
export const MAX_SEGMENT_WORDS = 5;
export const MIN_SEGMENT_WORDS = 2;

export type ReadingMode = "clausola" | "porzioni" | "scorrimento";

export const READING_MODES: { id: ReadingMode; label: string; note: string }[] = [
  { id: "clausola", label: "Clausola intera", note: "tutta la clausola sullo schermo; il tempo si misura per clausola" },
  { id: "porzioni", label: "A porzioni, al tuo ritmo", note: "poche parole alla volta, avanzi tu: il tempo si misura per parola" },
  { id: "scorrimento", label: "A porzioni, a scorrimento", note: "le porzioni avanzano da sole a un ritmo fisso; contano fermate e ritorni" },
];

export interface Segment {
  id: string;
  clauseId: string;
  /** Posizione dentro la clausola (0-based). */
  index: number;
  text: string;
  wordCount: number;
}

/** Connettivi prima dei quali conviene spezzare: sono giunture di senso. */
const BREAK_BEFORE = new Set([
  "e", "o", "ma", "se", "che", "cui", "quando", "salvo", "purché", "qualora", "ovvero", "nonché", "oppure",
  "affinché", "mentre", "poiché", "perché", "ove", "laddove", "tranne", "fermo", "ferma", "fatto", "fatta", "senza",
  "nonostante", "anche", "inoltre", "tuttavia", "pertanto", "quindi", "il", "la", "i", "le", "lo", "gli", "un", "una",
]);

/** Divide una clausola in porzioni di poche parole. La concatenazione delle porzioni è il testo originale. */
export function splitIntoSegments(clause: Clause): Segment[] {
  const words = clause.text.split(/\s+/).filter(Boolean);
  const segments: Segment[] = [];
  let current: string[] = [];
  const flush = () => {
    if (current.length === 0) return;
    segments.push({
      id: `${clause.id}s${segments.length + 1}`,
      clauseId: clause.id,
      index: segments.length,
      text: current.join(" "),
      wordCount: current.length,
    });
    current = [];
  };
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const next = words[i + 1];
    current.push(w);
    const endsWithPunct = /[.;:!?,)]$/.test(w) || /[.;:!?,]["»”']$/.test(w);
    const nextIsJoint = next !== undefined && BREAK_BEFORE.has(next.toLowerCase().replace(/^[«"“(]/, ""));
    const remaining = words.length - i - 1;
    // Non lasciare code di una sola parola: piuttosto allungare l'ultima porzione.
    if (remaining === 1) continue;
    if (current.length >= MAX_SEGMENT_WORDS) flush();
    else if (current.length >= MIN_SEGMENT_WORDS && (endsWithPunct || nextIsJoint)) flush();
  }
  flush();
  return segments;
}

export function segmentsFor(clauses: Clause[]): Segment[] {
  return clauses.flatMap(splitIntoSegments);
}

export interface SegmentMetrics {
  segmentId: string;
  clauseId: string;
  clauseIndex: number;
  index: number;
  text: string;
  wordCount: number;
  /** Tempo totale di esposizione (ms), sommando le visite. */
  dwellMs: number;
  /** Tempo per parola (ms), il dato che descrive la singola parola. */
  msPerWord: number | null;
  visits: number;
  returns: number;
  /** Fermate esplicite (modo a scorrimento). */
  pauses: number;
  /** Segnale corporeo attribuito con ritardo emodinamico (finestra [inizio+lag, fine+lag], min 2 s). */
  effort: EffortStats;
  /** Scarto standardizzato del tempo per parola rispetto alla sessione (z). */
  z: number | null;
  /** Livello di calore 0-4 per la vista parola per parola. */
  heat: 0 | 1 | 2 | 3 | 4;
}

interface Visit {
  segmentId: string;
  from: number;
  to: number;
}

/** Ricostruisce le visite alle porzioni dagli eventi. */
export function segmentVisits(session: Session): Visit[] {
  const visits: Visit[] = [];
  let open: { segmentId: string; since: number } | null = null;
  const close = (at: number) => {
    if (!open) return;
    visits.push({ segmentId: open.segmentId, from: open.since, to: at });
    open = null;
  };
  for (const ev of session.events) {
    if (ev.type === "segment_enter") {
      close(ev.timestamp);
      open = { segmentId: ev.segmentId, since: ev.timestamp };
    } else if (ev.type === "segment_leave" || ev.type === "clause_leave" || ev.type === "reading_end") {
      close(ev.timestamp);
    }
  }
  if (open) close(session.frames.at(-1)?.frame.timestamp ?? Date.now());
  return visits;
}

export function segmentMetrics(session: Session, clauses: Clause[]): SegmentMetrics[] {
  const segments = segmentsFor(clauses);
  const visits = segmentVisits(session);
  if (visits.length === 0) return [];
  const clauseIndex = new Map(clauses.map((c) => [c.id, c.index]));

  const returns = new Map<string, number>();
  const pauses = new Map<string, number>();
  for (const ev of session.events) {
    if (ev.type === "segment_enter" && ev.direction === "back") returns.set(ev.segmentId, (returns.get(ev.segmentId) ?? 0) + 1);
    if (ev.type === "segment_pause") pauses.set(ev.segmentId, (pauses.get(ev.segmentId) ?? 0) + 1);
  }

  const readingFrames = session.frames.filter((f) => f.phase === "reading" && f.effort);
  const rows = segments.map((s) => {
    const mine = visits.filter((v) => v.segmentId === s.id);
    const dwellMs = mine.reduce((sum, v) => sum + (v.to - v.from), 0);
    const samples = mine.flatMap((v) => {
      const from = v.from + HEMODYNAMIC_LAG_MS;
      const to = Math.max(v.to + HEMODYNAMIC_LAG_MS, from + MIN_ATTRIBUTION_MS);
      return readingFrames.filter((f) => f.frame.timestamp >= from && f.frame.timestamp < to).map((f) => f.effort!);
    });
    return {
      segmentId: s.id,
      clauseId: s.clauseId,
      clauseIndex: clauseIndex.get(s.clauseId) ?? 0,
      index: s.index,
      text: s.text,
      wordCount: s.wordCount,
      dwellMs,
      msPerWord: dwellMs > 0 ? dwellMs / s.wordCount : null,
      visits: mine.length,
      returns: returns.get(s.id) ?? 0,
      pauses: pauses.get(s.id) ?? 0,
      effort: summarize(samples),
      z: null as number | null,
      heat: 0 as 0 | 1 | 2 | 3 | 4,
    };
  });

  // Standardizzazione sul logaritmo del tempo per parola: la distribuzione è asimmetrica.
  const logs = rows.filter((r) => r.msPerWord !== null).map((r) => Math.log(r.msPerWord!));
  if (logs.length >= 2) {
    const mean = logs.reduce((a, b) => a + b, 0) / logs.length;
    const sd = Math.sqrt(logs.reduce((a, b) => a + (b - mean) ** 2, 0) / logs.length) || 1;
    for (const r of rows) {
      if (r.msPerWord === null) continue;
      r.z = (Math.log(r.msPerWord) - mean) / sd;
      r.heat = r.z >= 1.5 ? 4 : r.z >= 0.75 ? 3 : r.z >= 0.25 ? 2 : r.z >= -0.25 ? 1 : 0;
    }
  }
  return rows;
}

/** Le porzioni più lente della sessione, per il fascicolo. */
export function slowestSegments(rows: SegmentMetrics[], n = 10): SegmentMetrics[] {
  return rows
    .filter((r) => r.msPerWord !== null && r.wordCount >= MIN_SEGMENT_WORDS)
    .sort((a, b) => b.msPerWord! - a.msPerWord!)
    .slice(0, n);
}

/** Durata di esposizione di una porzione nel modo a scorrimento (ms). */
export function autoDurationMs(wordCount: number, wordsPerMinute: number): number {
  return Math.max(700, Math.round((wordCount / wordsPerMinute) * 60_000));
}
