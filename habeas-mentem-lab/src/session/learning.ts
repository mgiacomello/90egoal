// Che cosa il laboratorio impara dall'archivio.
//
// L'archivio raccoglie le sessioni del team (senza tracciato grezzo, senza
// nomi). Da lì, senza intervento umano, il laboratorio ricava un modello:
//
//   1. pesi e soglia dell'LX ricalibrati sulla comprensione misurata
//      (verifica, prova operativa, tempo), con il metodo di calibrate.ts
//      esteso a tutti i documenti insieme;
//   2. quale strada (lingua, distanza semantica, ordine, affollamento)
//      predice di più la perdita del lettore: ordina le proposte di riscrittura;
//   3. per ogni documento e clausola, la storia: quanti lettori, quanti persi,
//      tempi mediani, verifica e prova;
//   4. le parole che rallentano: dai tempi per parola e dal segnale HRF sulle
//      porzioni, le parole che ricorrono nei punti lenti in più sessioni.
//
// Il modello è un JSON pubblico e ricalcolabile: ogni numero si rifà dai dati
// archiviati (art. 4 della costituzione, «il metodo è pubblico»).

import { aggregateSessions, type Aggregate, type SessionExport } from "./aggregate";
import { calibrate, comprehensionPoints, pearson, DEFAULT_WEIGHTS, type LxWeights } from "./calibrate";
import { LX_ACCESSIBILITY_THRESHOLD } from "./lx";
import type { FrictionLevel } from "./friction";
import type { SegmentMetrics } from "./segments";

export const MODEL_SCHEMA = "habeas-mentem-lab/model/v1";

export interface ClausePrior {
  clauseId: string;
  index: number;
  heading: string | null;
  readers: number;
  /** Quota di sessioni in cui la clausola è stata gialla o rossa. */
  lostShare: number;
  tooFastShare: number;
  returnedShare: number;
  dwellMedianMs: number;
  msPerWordMedian: number | null;
  verifyAccuracy: number | null;
  operateSuccess: number | null;
  effortMean: number | null;
  /** Livello aggregato con le soglie di aggregate.ts. */
  level: FrictionLevel;
}

export interface DocumentModel {
  documentId: string;
  documentTitle: string;
  sessions: number;
  realSessions: number;
  sessionsWithSignal: number;
  firstSession: number;
  lastSession: number;
  clauses: ClausePrior[];
}

export interface LearnedWord {
  word: string;
  /** Sessioni distinte in cui la parola è caduta in una porzione misurata. */
  sessions: number;
  occurrences: number;
  /** Scarto medio del tempo per parola (z) delle porzioni che la contengono. */
  timeZ: number;
  /** Scarto medio del segnale HRF (z) delle porzioni che la contengono, se misurato. */
  bodyZ: number | null;
  /** Quota di occorrenze in porzioni lente (z > 1). */
  slowShare: number;
}

export type Road = "syntactic" | "semantic" | "structural" | "conceptual";

export interface LabModel {
  schema: typeof MODEL_SCHEMA;
  computedAt: string;
  sessions: number;
  realSessions: number;
  sessionsWithSignal: number;
  documents: DocumentModel[];
  lx: {
    source: "predefinito" | "appreso";
    weights: LxWeights;
    threshold: number;
    r: number | null;
    defaultR: number | null;
    sessions: number;
    clauses: number;
    reason: string | null;
  };
  /** Correlazione tra ogni strada dell'LX e la comprensione: più negativa, più la strada pesa. */
  roads: { road: Road; r: number | null; points: number }[];
  words: LearnedWord[];
  notes: string[];
}

export const EMPTY_MODEL: LabModel = {
  schema: MODEL_SCHEMA,
  computedAt: new Date(0).toISOString(),
  sessions: 0, realSessions: 0, sessionsWithSignal: 0,
  documents: [],
  lx: { source: "predefinito", weights: DEFAULT_WEIGHTS, threshold: LX_ACCESSIBILITY_THRESHOLD, r: null, defaultR: null, sessions: 0, clauses: 0, reason: "Nessuna sessione in archivio." },
  roads: [],
  words: [],
  notes: [],
};

const STOPWORDS = new Set([
  "della", "delle", "degli", "dello", "dalla", "dalle", "dagli", "nella", "nelle", "negli", "sulla", "sulle", "sugli",
  "questo", "questa", "questi", "queste", "quello", "quella", "quelli", "quelle", "essere", "sono", "anche", "come", "dove",
  "quando", "sempre", "nostro", "nostra", "nostri", "nostre", "vostro", "vostra", "tuoi", "loro", "ogni", "tutti", "tutte",
  "senza", "oppure", "perché", "presso", "verso", "dopo", "prima", "entro", "mentre", "ancora", "quindi", "poiché", "cioè",
  "hanno", "abbiamo", "avere", "potrà", "potrai", "puoi", "possono", "possiamo", "viene", "vengono", "stato", "stata", "stati",
]);

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-zà-ù'’\s-]/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/^[’'-]+|[’'-]+$/g, ""))
    .filter((w) => w.length >= 5 && !STOPWORDS.has(w));
}

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export const WORD_MINIMUMS = { sessions: 3, timeZ: 0.5, keep: 30 };

/** Le parole che ricorrono nelle porzioni lente, in più sessioni. */
export function learnWords(exports: SessionExport[]): LearnedWord[] {
  const acc = new Map<string, { sessions: Set<string>; z: number[]; body: number[]; slow: number }>();
  for (const e of exports) {
    const segs = (e as SessionExport & { segments?: SegmentMetrics[] }).segments ?? [];
    for (const s of segs) {
      if (s.z === null || s.dwellMs <= 0) continue;
      const seen = new Set<string>();
      for (const w of tokens(s.text)) {
        if (seen.has(w)) continue;
        seen.add(w);
        const a = acc.get(w) ?? { sessions: new Set(), z: [], body: [], slow: 0 };
        a.sessions.add(e.session.id);
        a.z.push(s.z);
        if (s.model && s.model.z !== null && !e.session.device?.simulated) a.body.push(s.model.z);
        if (s.z > 1) a.slow++;
        acc.set(w, a);
      }
    }
  }
  const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  return [...acc.entries()]
    .filter(([, a]) => a.sessions.size >= WORD_MINIMUMS.sessions)
    .map(([word, a]) => ({
      word,
      sessions: a.sessions.size,
      occurrences: a.z.length,
      timeZ: mean(a.z),
      bodyZ: a.body.length >= 3 ? mean(a.body) : null,
      slowShare: a.slow / a.z.length,
    }))
    .filter((w) => w.timeZ >= WORD_MINIMUMS.timeZ)
    .sort((a, b) => b.timeZ * Math.log1p(b.sessions) - a.timeZ * Math.log1p(a.sessions))
    .slice(0, WORD_MINIMUMS.keep);
}

function documentModel(exports: SessionExport[], a: Aggregate): DocumentModel {
  const segsByClause = new Map<string, number[]>();
  for (const e of exports) {
    for (const s of (e as SessionExport & { segments?: SegmentMetrics[] }).segments ?? []) {
      if (s.msPerWord === null) continue;
      segsByClause.set(s.clauseId, [...(segsByClause.get(s.clauseId) ?? []), s.msPerWord]);
    }
  }
  return {
    documentId: a.documentId,
    documentTitle: a.documentTitle,
    sessions: a.sessions,
    realSessions: a.sessions - a.simulatedSessions,
    sessionsWithSignal: a.sessionsWithSignal,
    firstSession: a.firstSession,
    lastSession: a.lastSession,
    clauses: a.clauses.map((c) => ({
      clauseId: c.clauseId,
      index: c.index,
      heading: c.heading,
      readers: c.readers,
      lostShare: c.lostShare,
      tooFastShare: c.tooFastShare,
      returnedShare: c.returnedShare,
      dwellMedianMs: c.dwellMedianMs,
      msPerWordMedian: median(segsByClause.get(c.clauseId) ?? []),
      verifyAccuracy: c.verification.accuracy,
      operateSuccess: c.operational.success,
      effortMean: c.effort.mean,
      level: c.friction.level,
    })),
  };
}

/** Raggruppa le sessioni per documento, scartando quelle non aggregabili (documento cambiato). */
export function groupByDocument(exports: SessionExport[]): Map<string, SessionExport[]> {
  const groups = new Map<string, SessionExport[]>();
  for (const e of exports) {
    const key = `${e.session.documentId}/${e.clauses.length}`;
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }
  // Se lo stesso documento esiste in versioni con numero di clausole diverso, vale la più recente.
  const byDoc = new Map<string, SessionExport[]>();
  for (const list of groups.values()) {
    const id = list[0].session.documentId;
    const prev = byDoc.get(id);
    if (!prev || Math.max(...list.map((e) => e.session.createdAt)) > Math.max(...prev.map((e) => e.session.createdAt))) byDoc.set(id, list);
  }
  return byDoc;
}

/** Il modello appreso da tutte le sessioni archiviate. Puro: stessi dati, stesso modello. */
export function learn(exports: SessionExport[], now = new Date()): LabModel {
  if (exports.length === 0) return { ...EMPTY_MODEL, computedAt: now.toISOString() };
  const notes: string[] = [];
  const byDoc = groupByDocument(exports);
  const aggregates: Aggregate[] = [];
  const documents: DocumentModel[] = [];
  for (const list of byDoc.values()) {
    try {
      const a = aggregateSessions(list);
      aggregates.push(a);
      documents.push(documentModel(list, a));
    } catch (e) {
      notes.push(`Documento ${list[0].session.documentId} escluso: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  documents.sort((a, b) => b.sessions - a.sessions);

  // Calibrazione LX su tutte le clausole di tutti i documenti insieme.
  const used = documents.reduce((s, d) => s + d.sessions, 0);
  const pooled: Aggregate = {
    documentId: "tutti",
    documentTitle: "tutti i documenti",
    sessions: used,
    sessionsWithSignal: aggregates.reduce((s, a) => s + a.sessionsWithSignal, 0),
    simulatedSessions: aggregates.reduce((s, a) => s + a.simulatedSessions, 0),
    firstSession: Math.min(...aggregates.map((a) => a.firstSession)),
    lastSession: Math.max(...aggregates.map((a) => a.lastSession)),
    clauses: aggregates.flatMap((a) => a.clauses.map((c) => ({ ...c, clauseId: `${a.documentId}:${c.clauseId}` }))),
  };
  const cal = calibrate(pooled);
  const points = comprehensionPoints(pooled);
  const roads = (["syntactic", "semantic", "structural", "conceptual"] as Road[]).map((road) => ({
    road,
    r: pearson(points.map((p) => p.lx[road]), points.map((p) => p.comprehension)),
    points: points.length,
  }));

  // I pesi appresi valgono solo se migliorano davvero la correlazione, e non di un soffio.
  const learned = cal.eligible && cal.r !== null && cal.defaultR !== null && cal.r < cal.defaultR - 0.05;
  const threshold = learned && cal.threshold !== null && (cal.thresholdDrop ?? 0) >= 0.1 ? cal.threshold : LX_ACCESSIBILITY_THRESHOLD;
  if (cal.eligible && !learned) notes.push("I pesi predefiniti restano: la ricalibrazione non migliora la correlazione in modo apprezzabile (differenza sotto 0,05).");
  if (learned && threshold === LX_ACCESSIBILITY_THRESHOLD) notes.push("La soglia resta 45: nessun taglio separa la comprensione media di almeno 10 punti percentuali.");
  notes.push(...cal.caveats);

  const words = learnWords(exports);
  if (words.length === 0) notes.push("Nessuna parola lenta ricorrente: servono porzioni misurate in almeno tre sessioni.");

  return {
    schema: MODEL_SCHEMA,
    computedAt: now.toISOString(),
    sessions: exports.length,
    realSessions: exports.filter((e) => !e.session.device?.simulated).length,
    sessionsWithSignal: pooled.sessionsWithSignal,
    documents,
    lx: {
      source: learned ? "appreso" : "predefinito",
      weights: learned ? cal.weights : DEFAULT_WEIGHTS,
      threshold,
      r: cal.r,
      defaultR: cal.defaultR,
      sessions: cal.sessions,
      clauses: cal.clauses,
      reason: cal.reason,
    },
    roads,
    words,
    notes,
  };
}

/** Ordine delle strade dal modello: dalla più predittiva (r più negativo) alla meno. */
export function roadOrder(model: LabModel | null): Road[] {
  const base: Road[] = ["syntactic", "semantic", "structural", "conceptual"];
  if (!model || model.roads.length === 0 || model.sessions < 5) return base;
  const known = model.roads.filter((r) => r.r !== null);
  if (known.length < 2) return base;
  return [...known].sort((a, b) => (a.r as number) - (b.r as number)).map((r) => r.road).concat(base.filter((r) => !known.some((k) => k.road === r)));
}

/** Controlla che un JSON sia un modello del laboratorio. */
export function isLabModel(x: unknown): x is LabModel {
  const m = x as Partial<LabModel> | null;
  return !!m && m.schema === MODEL_SCHEMA && Array.isArray(m.documents) && !!m.lx && typeof m.lx.threshold === "number";
}

/** Le sessioni ricevute dall'archivio possono essere più vecchie dello schema: si accettano solo quelle leggibili. */
export function usableExports(rows: unknown[]): SessionExport[] {
  return rows.filter((r): r is SessionExport => {
    const d = r as Partial<SessionExport> | null;
    return !!d && d.schema === "habeas-mentem-lab/session/v1" && !!d.session && Array.isArray(d.metrics) && Array.isArray(d.clauses);
  });
}

/** Che cosa deve rimanere di una sessione nell'archivio: mai il tracciato grezzo, mai lo pseudonimo. */
export function archivable(raw: unknown): SessionExport | null {
  const list = usableExports([raw]);
  if (list.length === 0) return null;
  const e = list[0] as SessionExport & { segments?: SegmentMetrics[]; frameCount?: number; note?: string };
  const s = e.session as SessionExport["session"] & { frames?: unknown; participant?: string; vitals?: unknown; events?: unknown; consent?: unknown };
  const session = {
    id: String(s.id),
    documentId: String(s.documentId),
    documentTitle: String(s.documentTitle ?? ""),
    device: s.device ? { name: String(s.device.name ?? ""), simulated: !!s.device.simulated } : null,
    createdAt: Number(s.createdAt) || Date.now(),
    reading: (s as { reading?: unknown }).reading,
    answers: Array.isArray(s.answers) ? s.answers.map((a) => ({ clauseId: String(a.clauseId), correct: !!a.correct })) : [],
    tasks: Array.isArray(s.tasks) ? s.tasks.map((t) => ({ clauseId: String(t.clauseId), chosenClauseId: String(t.chosenClauseId), correct: !!t.correct })) : [],
  };
  return {
    schema: e.schema,
    exportedAt: e.exportedAt,
    session,
    clauses: e.clauses,
    metrics: e.metrics,
    friction: e.friction,
    ...(e.segments ? { segments: e.segments } : {}),
    ...(typeof e.frameCount === "number" ? { frameCount: e.frameCount } : {}),
  } as SessionExport;
}
