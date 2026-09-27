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
import { LX_ACCESSIBILITY_THRESHOLD, lxScore, splitSentences } from "./lx";
import type { Clause } from "./model";
import type { FrictionLevel } from "./friction";
import { splitIntoSegments, type SegmentMetrics } from "./segments";

export const MODEL_SCHEMA = "habeas-mentem-lab/model/v1";

export interface ClausePrior {
  clauseId: string;
  index: number;
  heading: string | null;
  /** Sessioni del documento, e quante hanno aperto la clausola. */
  sessions: number;
  readers: number;
  /** Sessioni in cui la clausola è stata gialla o rossa, e la quota su tutte le sessioni. */
  lost: number;
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

/** Una porzione del documento vista da tutti i lettori che l'hanno letta a porzioni. */
export interface SegmentPrior {
  segmentId: string;
  clauseId: string;
  index: number;
  text: string;
  /** Lettori che hanno letto la porzione con tempo misurato. */
  readers: number;
  /** Lettori per cui la porzione è stata lenta (z > 1) o molto lenta (z > 2) rispetto alla loro sessione. */
  slowReaders: number;
  verySlowReaders: number;
  slowShare: number;
  msPerWordMedian: number | null;
  /** Scarto medio del tempo (z) e, se misurato con fascia vera, del segnale HRF. */
  timeZ: number;
  bodyZ: number | null;
}

/** Una frase (periodo) del documento, ricostruita dalle porzioni. */
export interface SentencePrior {
  clauseId: string;
  clauseIndex: number;
  /** Posizione della frase nella clausola (0-based). */
  index: number;
  text: string;
  wordCount: number;
  readers: number;
  /** Lettori per cui la frase è stata lenta: media z delle sue porzioni sopra 0,5 o una porzione sopra 1,5. */
  slowReaders: number;
  slowShare: number;
  msPerWordMedian: number | null;
  timeZ: number;
  lx: number;
}

export interface DocumentModel {
  documentId: string;
  /** Impronta del testo (clausole): sessioni di versioni diverse non si mescolano. */
  version: string;
  documentTitle: string;
  sessions: number;
  realSessions: number;
  sessionsWithSignal: number;
  /** Sessioni lette a porzioni, con tempi per parola. */
  segmentedSessions: number;
  firstSession: number;
  lastSession: number;
  clauses: ClausePrior[];
  segments: SegmentPrior[];
  sentences: SentencePrior[];
  /** Parole lente in questo documento (soglie del documento: almeno 2 lettori). */
  words: LearnedWord[];
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

/**
 * Art. 6 della costituzione: «il programma dichiara in anticipo i risultati che
 * lo smentirebbero». Restano nel modello, sempre, e nel fascicolo.
 */
export const FALSIFIERS = [
  "Che cosa smentirebbe il metodo: con almeno 30 lettori e 6 documenti, una correlazione tra LX e comprensione misurata sopra -0,30 (il libro: -0,71 e -0,68).",
  "Che cosa smentirebbe la soglia: nessun taglio dell'LX che separi la comprensione media di almeno dieci punti percentuali, con almeno 30 lettori.",
  "Che cosa smentirebbe le parole lente: parole segnalate che, riscritte o definite, non riducono il tempo per parola nelle sessioni successive.",
];

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

export function contentWords(text: string): string[] {
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
export function learnWords(exports: SessionExport[], minimums = WORD_MINIMUMS): LearnedWord[] {
  const acc = new Map<string, { sessions: Set<string>; z: number[]; body: number[]; slow: number }>();
  for (const e of exports) {
    const segs = (e as SessionExport & { segments?: SegmentMetrics[] }).segments ?? [];
    for (const s of segs) {
      if (s.z === null || s.dwellMs <= 0) continue;
      const seen = new Set<string>();
      for (const w of contentWords(s.text)) {
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
    .filter(([, a]) => a.sessions.size >= minimums.sessions)
    .map(([word, a]) => ({
      word,
      sessions: a.sessions.size,
      occurrences: a.z.length,
      timeZ: mean(a.z),
      bodyZ: a.body.length >= 3 ? mean(a.body) : null,
      slowShare: a.slow / a.z.length,
    }))
    .filter((w) => w.timeZ >= minimums.timeZ)
    .sort((a, b) => b.timeZ * Math.log1p(b.sessions) - a.timeZ * Math.log1p(a.sessions))
    .slice(0, minimums.keep);
}

export const SENTENCE_SLOW = { meanZ: 0.5, anyZ: 1.5 };

/** A quale frase della clausola appartiene ogni porzione: per conteggio cumulato di parole. */
export function sentenceOfSegments(clause: Clause, segments: { index: number; wordCount: number }[]): { sentences: string[]; bySegmentIndex: number[] } {
  const sentences = splitSentences(clause.text);
  if (sentences.length <= 1) return { sentences: sentences.length ? sentences : [clause.text], bySegmentIndex: segments.map(() => 0) };
  const bounds: number[] = [];
  let acc = 0;
  for (const st of sentences) {
    acc += st.split(/\s+/).filter(Boolean).length;
    bounds.push(acc);
  }
  const total = clause.text.split(/\s+/).filter(Boolean).length;
  const scale = bounds[bounds.length - 1] > 0 ? total / bounds[bounds.length - 1] : 1;
  // Le posizioni vengono dalla segmentazione canonica della clausola (deterministica),
  // non dalle sole porzioni misurate: una porzione non letta non sposta le altre.
  const startWord = new Map<number, number>();
  let w = 0;
  for (const sg of splitIntoSegments(clause)) {
    startWord.set(sg.index, w);
    w += sg.wordCount;
  }
  return {
    sentences,
    bySegmentIndex: segments.map((sg) => {
      const mid = (startWord.get(sg.index) ?? 0) + sg.wordCount / 2;
      const k = bounds.findIndex((b) => mid < b * scale);
      return k === -1 ? sentences.length - 1 : k;
    }),
  };
}

/** Porzioni e frasi del documento viste da tutti i lettori. */
export function learnSegments(exports: SessionExport[], clauses: Clause[]): { segments: SegmentPrior[]; sentences: SentencePrior[]; segmentedSessions: number } {
  const perSegment = new Map<string, { seg: SegmentMetrics; z: number[]; body: number[]; ms: number[] }>();
  const perSentence = new Map<string, { clause: Clause; index: number; text: string; wordCount: number; readers: number; slow: number; z: number[]; ms: number[] }>();
  let segmented = 0;
  for (const e of exports) {
    const segs = ((e as SessionExport & { segments?: SegmentMetrics[] }).segments ?? []).filter((s) => s.z !== null && s.msPerWord !== null);
    if (segs.length === 0) continue;
    segmented++;
    const real = !e.session.device?.simulated;
    for (const s of segs) {
      const a = perSegment.get(s.segmentId) ?? { seg: s, z: [], body: [], ms: [] };
      a.z.push(s.z as number);
      a.ms.push(s.msPerWord as number);
      if (real && s.model && s.model.z !== null) a.body.push(s.model.z);
      perSegment.set(s.segmentId, a);
    }
    // Frasi: per ogni clausola, le porzioni di questo lettore raggruppate per frase.
    for (const c of clauses) {
      const mine = segs.filter((s) => s.clauseId === c.id);
      if (!mine.length) continue;
      const { sentences, bySegmentIndex } = sentenceOfSegments(c, mine);
      const groups = new Map<number, SegmentMetrics[]>();
      mine.forEach((s, i) => groups.set(bySegmentIndex[i], [...(groups.get(bySegmentIndex[i]) ?? []), s]));
      for (const [k, list] of groups) {
        const key = `${c.id}#${k}`;
        const text = sentences[k] ?? c.text;
        const a = perSentence.get(key) ?? { clause: c, index: k, text, wordCount: text.split(/\s+/).filter(Boolean).length, readers: 0, slow: 0, z: [], ms: [] };
        const zs = list.map((s) => s.z as number);
        const meanZ = zs.reduce((x, y) => x + y, 0) / zs.length;
        const words = list.reduce((n, s) => n + s.wordCount, 0);
        const ms = list.reduce((n, s) => n + s.dwellMs, 0) / Math.max(1, words);
        a.readers++;
        if (meanZ > SENTENCE_SLOW.meanZ || zs.some((z) => z > SENTENCE_SLOW.anyZ)) a.slow++;
        a.z.push(meanZ);
        a.ms.push(ms);
        perSentence.set(key, a);
      }
    }
  }
  const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
  const clauseIndex = new Map(clauses.map((c) => [c.id, c.index]));
  const segments: SegmentPrior[] = [...perSegment.values()]
    .map(({ seg, z, body, ms }) => ({
      segmentId: seg.segmentId,
      clauseId: seg.clauseId,
      index: seg.index,
      text: seg.text,
      readers: z.length,
      slowReaders: z.filter((x) => x > 1).length,
      verySlowReaders: z.filter((x) => x > 2).length,
      slowShare: z.filter((x) => x > 1).length / z.length,
      msPerWordMedian: median(ms),
      timeZ: mean(z),
      bodyZ: body.length >= 3 ? mean(body) : null,
    }))
    .sort((a, b) => (clauseIndex.get(a.clauseId) ?? 0) - (clauseIndex.get(b.clauseId) ?? 0) || a.index - b.index);
  const sentences: SentencePrior[] = [...perSentence.values()]
    .map((a) => ({
      clauseId: a.clause.id,
      clauseIndex: a.clause.index,
      index: a.index,
      text: a.text,
      wordCount: a.wordCount,
      readers: a.readers,
      slowReaders: a.slow,
      slowShare: a.slow / a.readers,
      msPerWordMedian: median(a.ms),
      timeZ: mean(a.z),
      lx: lxScore(a.text).total,
    }))
    .sort((a, b) => a.clauseIndex - b.clauseIndex || a.index - b.index);
  return { segments, sentences, segmentedSessions: segmented };
}

function documentModel(exports: SessionExport[], a: Aggregate): DocumentModel {
  const learnedSegs = learnSegments(exports, exports[0].clauses);
  const segsByClause = new Map<string, number[]>();
  for (const e of exports) {
    for (const s of (e as SessionExport & { segments?: SegmentMetrics[] }).segments ?? []) {
      if (s.msPerWord === null) continue;
      segsByClause.set(s.clauseId, [...(segsByClause.get(s.clauseId) ?? []), s.msPerWord]);
    }
  }
  return {
    documentId: a.documentId,
    version: documentVersion(exports[0].clauses),
    documentTitle: a.documentTitle,
    sessions: a.sessions,
    realSessions: a.sessions - a.simulatedSessions,
    sessionsWithSignal: a.sessionsWithSignal,
    segmentedSessions: learnedSegs.segmentedSessions,
    firstSession: a.firstSession,
    lastSession: a.lastSession,
    segments: learnedSegs.segments,
    sentences: learnedSegs.sentences,
    words: learnWords(exports, { sessions: 2, timeZ: 0.5, keep: 25 }),
    clauses: a.clauses.map((c) => ({
      clauseId: c.clauseId,
      index: c.index,
      heading: c.heading,
      sessions: a.sessions,
      readers: c.readers,
      lost: c.lostCount,
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

/** Impronta breve del testo di un documento (djb2 sulle clausole): cambia se cambia una parola. */
export function documentVersion(clauses: { id: string; text: string }[]): string {
  let h = 5381;
  const src = clauses.map((c) => `${c.id}\u0001${c.text}`).join("\u0002");
  for (let i = 0; i < src.length; i++) h = ((h << 5) + h + src.charCodeAt(i)) | 0;
  return `${clauses.length}-${(h >>> 0).toString(16)}`;
}

/** Raggruppa le sessioni per documento, scartando quelle non aggregabili (documento cambiato). */
export function groupByDocument(exports: SessionExport[]): Map<string, SessionExport[]> {
  const groups = new Map<string, SessionExport[]>();
  for (const e of exports) {
    const key = `${e.session.documentId}/${documentVersion(e.clauses)}`;
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }
  // Se lo stesso documento esiste in versioni con testo diverso, vale la più recente.
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
  notes.push(...FALSIFIERS);

  return {
    schema: MODEL_SCHEMA,
    computedAt: now.toISOString(),
    sessions: used,
    realSessions: documents.reduce((s, d) => s + d.realSessions, 0),
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
    const d = r as Partial<SessionExport> & { segments?: unknown } | null;
    if (!d || d.schema !== "habeas-mentem-lab/session/v1" || !d.session || !Array.isArray(d.metrics) || !Array.isArray(d.clauses)) return false;
    const s = d.session as Partial<SessionExport["session"]>;
    if (typeof s.id !== "string" || typeof s.documentId !== "string") return false;
    if (!d.clauses.every((c) => c && typeof (c as Clause).id === "string" && typeof (c as Clause).text === "string")) return false;
    if (!d.metrics.every((m) => m && typeof m.clauseId === "string" && m.lx && typeof m.lx.total === "number")) return false;
    if (d.segments !== undefined) {
      if (!Array.isArray(d.segments)) return false;
      const okSeg = (x: unknown) => {
        const g = x as Partial<SegmentMetrics> | null;
        return !!g && typeof g.segmentId === "string" && typeof g.clauseId === "string" && typeof g.text === "string" && typeof g.index === "number" && typeof g.wordCount === "number" && typeof g.dwellMs === "number" && (g.z === null || typeof g.z === "number") && (g.msPerWord === null || typeof g.msPerWord === "number");
      };
      if (!d.segments.every(okSeg)) return false;
    }
    return true;
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
