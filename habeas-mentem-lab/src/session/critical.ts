// I punti critici: dove il documento perde chi legge, a tre grane.
//
// Clausole, frasi e parole con il punteggio peggiore, in questa sessione e
// in tutti i lettori dell'archivio sullo stesso documento («37 lettori su 52
// hanno rallentato qui»). Per ognuno, una sostituzione proposta con le regole
// dichiarate di rewrite.ts. È la vista che serve a validare il metodo e a
// mostrare a chi scrive dove il testo non regge.

import type { Friction } from "./friction";
import type { ClauseMetrics } from "./metrics";
import type { Clause } from "./model";
import type { SegmentMetrics } from "./segments";
import { lxScore } from "./lx";
import { autoDraft, definitionFor, PLAIN_WORDS, proposalsFor, type Proposal } from "./rewrite";
import { contentWords, documentVersion, sentenceOfSegments, SENTENCE_SLOW, type DocumentModel, type LabModel, type LearnedWord, type SegmentPrior } from "./learning";

/** Lettori minimi perché il dato di popolazione venga mostrato. */
export const POPULATION_MIN_READERS = 3;
/** «Un cronometro e cinque lettori veri» (Habeas Mentem): sotto, il dato è esplorativo e lo dice. */
export const POPULATION_SOLID_READERS = 5;

export interface Population {
  readers: number;
  slow: number;
  share: number;
  msPerWordMedian?: number | null;
}

export interface CriticalClause {
  clauseId: string;
  index: number;
  heading: string | null;
  level: Friction["level"];
  count: number;
  reasons: string[];
  lx: number;
  population: { readers: number; lost: number; lostShare: number; verifyAccuracy: number | null } | null;
  proposal: Proposal | null;
  draft: { before: number; after: number } | null;
  score: number;
}

export interface CriticalSentence {
  clauseId: string;
  clauseIndex: number;
  index: number;
  text: string;
  wordCount: number;
  lx: number;
  /** Questa sessione: scarto medio del tempo (z) e ms per parola, se letta a porzioni. */
  session: { z: number; msPerWord: number; slow: boolean } | null;
  population: Population | null;
  proposal: Proposal | null;
  draft: { text: string; before: number; after: number } | null;
  score: number;
}

export interface CriticalWord {
  word: string;
  /** In questa sessione: in quante porzioni lente compare e lo z medio. */
  session: { segments: number; z: number } | null;
  /** Nell'archivio di questo documento (o di tutti i documenti, se indicato). */
  population: { sessions: number; timeZ: number; slowShare: number; scope: "documento" | "archivio" } | null;
  proposal: { after: string; why: string };
  score: number;
}

export interface CriticalPoints {
  clauses: CriticalClause[];
  sentences: CriticalSentence[];
  words: CriticalWord[];
  /** Lettori in archivio su questo documento, e quanti a porzioni. */
  readers: number;
  segmentedReaders: number;
  /** Il testo del documento per porzione, con il calore di popolazione e quello di questa sessione. */
  heat: { clauseId: string; segmentId: string; text: string; population: SegmentPrior | null; populationHeat: 0 | 1 | 2 | 3 | 4 | null; sessionHeat: 0 | 1 | 2 | 3 | 4 | null }[];
}

export function populationHeat(p: SegmentPrior | null | undefined): 0 | 1 | 2 | 3 | 4 | null {
  if (!p || p.readers < POPULATION_MIN_READERS) return null;
  if (p.slowShare >= 0.5) return 4;
  if (p.slowShare >= 0.3) return 3;
  if (p.slowShare >= 0.15) return 2;
  return 1;
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** Proposta di sostituzione per una parola: glossario, definizione, o spiegazione. */
export function wordProposal(word: string): { after: string; why: string } {
  for (const [re, rep, why] of PLAIN_WORDS) {
    const m = word.match(new RegExp(re.source, re.flags.replace("g", "")));
    if (m && m[0].length >= word.length - 1) return { after: word.replace(new RegExp(re.source, re.flags.replace("g", "")), rep), why };
  }
  const def = definitionFor(word);
  if (def) return { after: `${word}, cioè ${def}`, why: "Termine tecnico: definirlo alla prima occorrenza, in una riga." };
  return { after: "una parola comune, o la stessa parola spiegata alla prima occorrenza", why: "Nessuna resa piana nel glossario: decide il giurista, il laboratorio rimisura." };
}

function pseudoClause(text: string, id: string): Clause {
  return { id, index: 0, heading: null, text, wordCount: text.split(/\s+/).filter(Boolean).length };
}

export function criticalPoints(
  clauses: Clause[],
  metrics: ClauseMetrics[],
  friction: Friction[],
  segments: SegmentMetrics[],
  model: LabModel | null,
  documentId: string,
  limit = 5,
): CriticalPoints {
  const version = documentVersion(clauses);
  const pop: DocumentModel | null = model?.documents.find((d) => d.documentId === documentId && d.version === version) ?? null;
  const readers = pop?.sessions ?? 0;
  const segmentedReaders = pop?.segmentedSessions ?? 0;
  const rank = { rosso: 1, giallo: 0.6, verde: 0 } as const;

  // ── Clausole ──────────────────────────────────────────────────────────────
  const criticalClauses: CriticalClause[] = metrics.map((m) => {
    const f = friction.find((x) => x.clauseId === m.clauseId)!;
    const c = clauses.find((x) => x.id === m.clauseId)!;
    const p = pop?.clauses.find((x) => x.clauseId === m.clauseId) ?? null;
    const population = p && p.sessions > 0 ? { readers: p.sessions, lost: p.lost, lostShare: p.lostShare, verifyAccuracy: p.verifyAccuracy } : null;
    const sessionScore = rank[f.level] * 0.7 + Math.min(1, f.count / 4) * 0.3;
    const score = population && population.readers >= POPULATION_MIN_READERS ? 0.4 * sessionScore + 0.6 * population.lostShare : sessionScore + (m.lx.total / 100) * 0.1;
    const draft = autoDraft(c);
    return {
      clauseId: m.clauseId, index: m.index, heading: m.heading, level: f.level, count: f.count, reasons: f.reasons, lx: m.lx.total,
      population, proposal: proposalsFor(c, m.lx)[0] ?? null, draft: draft ? { before: draft.before, after: draft.after } : null, score,
    };
  });

  // ── Frasi ────────────────────────────────────────────────────────────────
  const sentenceMap = new Map<string, CriticalSentence>();
  for (const c of clauses) {
    const mine = segments.filter((s) => s.clauseId === c.id && s.z !== null && s.msPerWord !== null);
    const { sentences, bySegmentIndex } = sentenceOfSegments(c, mine);
    sentences.forEach((text, k) => {
      const key = `${c.id}#${k}`;
      const list = mine.filter((_, i) => bySegmentIndex[i] === k);
      let session: CriticalSentence["session"] = null;
      if (list.length) {
        const zs = list.map((s) => s.z as number);
        const z = zs.reduce((a, b) => a + b, 0) / zs.length;
        const words = list.reduce((n, s) => n + s.wordCount, 0);
        session = { z, msPerWord: list.reduce((n, s) => n + s.dwellMs, 0) / Math.max(1, words), slow: z > SENTENCE_SLOW.meanZ || zs.some((x) => x > SENTENCE_SLOW.anyZ) };
      }
      const p = pop?.sentences.find((x) => x.clauseId === c.id && x.index === k) ?? null;
      const population = p ? { readers: p.readers, slow: p.slowReaders, share: p.slowShare, msPerWordMedian: p.msPerWordMedian } : null;
      const lx = lxScore(text).total;
      sentenceMap.set(key, {
        clauseId: c.id, clauseIndex: c.index, index: k, text, wordCount: text.split(/\s+/).filter(Boolean).length, lx,
        session, population, proposal: null, draft: null,
        score: 0,
      });
    });
  }
  const criticalSentences = [...sentenceMap.values()].map((s) => {
    const sessionScore = s.session ? clamp01((s.session.z + 0.5) / 2.5) : null;
    const popScore = s.population && s.population.readers >= POPULATION_MIN_READERS ? s.population.share : null;
    const textScore = clamp01(s.lx / 100);
    let score: number;
    if (popScore !== null && sessionScore !== null) score = 0.6 * popScore + 0.3 * sessionScore + 0.1 * textScore;
    else if (popScore !== null) score = 0.85 * popScore + 0.15 * textScore;
    else if (sessionScore !== null) score = 0.8 * sessionScore + 0.2 * textScore;
    else score = textScore * 0.6;
    return { ...s, score };
  });
  criticalSentences.sort((a, b) => b.score - a.score);
  for (const s of criticalSentences.slice(0, limit * 2)) {
    const pc = pseudoClause(s.text, `${s.clauseId}#${s.index}`);
    s.proposal = proposalsFor(pc, lxScore(s.text))[0] ?? null;
    s.draft = autoDraft(pc);
  }

  // ── Parole ───────────────────────────────────────────────────────────────
  const words = new Map<string, CriticalWord>();
  const slowSegs = segments.filter((s) => s.z !== null && s.z > 1);
  const sessionWords = new Map<string, { n: number; z: number[] }>();
  for (const s of slowSegs) {
    for (const w of new Set(contentWords(s.text))) {
      const a = sessionWords.get(w) ?? { n: 0, z: [] };
      a.n++;
      a.z.push(s.z as number);
      sessionWords.set(w, a);
    }
  }
  const docText = clauses.map((c) => c.text).join(" ").toLowerCase();
  const inDoc = (w: string) => new RegExp(`(^|[^a-zà-ù])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-zà-ù]|$)`).test(docText);
  const addPop = (w: LearnedWord, scope: "documento" | "archivio") => {
    if (!inDoc(w.word)) return;
    const cur = words.get(w.word);
    if (cur?.population && cur.population.scope === "documento") return;
    words.set(w.word, { word: w.word, session: cur?.session ?? null, population: { sessions: w.sessions, timeZ: w.timeZ, slowShare: w.slowShare, scope }, proposal: wordProposal(w.word), score: 0 });
  };
  for (const w of pop?.words ?? []) addPop(w, "documento");
  for (const w of model?.words ?? []) addPop(w, "archivio");
  for (const [w, a] of sessionWords) {
    const cur = words.get(w);
    const session = { segments: a.n, z: a.z.reduce((x, y) => x + y, 0) / a.z.length };
    if (cur) cur.session = session;
    else words.set(w, { word: w, session, population: null, proposal: wordProposal(w), score: 0 });
  }
  const criticalWords = [...words.values()]
    .map((w) => {
      const pop = w.population ? clamp01(w.population.timeZ / 2.5) * Math.min(1, Math.log1p(w.population.sessions) / Math.log1p(10)) : null;
      const ses = w.session ? clamp01((w.session.z - 0.5) / 2) : null;
      const score = pop !== null && ses !== null ? 0.6 * pop + 0.4 * ses : pop !== null ? 0.8 * pop : ses !== null ? 0.6 * ses : 0;
      return { ...w, score };
    })
    .sort((a, b) => b.score - a.score);

  // ── Testo a calore ───────────────────────────────────────────────────────
  const heat: CriticalPoints["heat"] = [];
  for (const c of clauses) {
    const mine = segments.filter((s) => s.clauseId === c.id).sort((a, b) => a.index - b.index);
    if (mine.length) {
      for (const s of mine) {
        const p = pop?.segments.find((x) => x.segmentId === s.segmentId) ?? null;
        heat.push({ clauseId: c.id, segmentId: s.segmentId, text: s.text, population: p, populationHeat: populationHeat(p), sessionHeat: s.msPerWord === null ? null : s.heat });
      }
    } else {
      // Sessione a clausola intera: le porzioni vengono dall'archivio, se c'è.
      const ps = (pop?.segments ?? []).filter((x) => x.clauseId === c.id).sort((a, b) => a.index - b.index);
      if (ps.length) for (const p of ps) heat.push({ clauseId: c.id, segmentId: p.segmentId, text: p.text, population: p, populationHeat: populationHeat(p), sessionHeat: null });
      else heat.push({ clauseId: c.id, segmentId: `${c.id}s0`, text: c.text, population: null, populationHeat: null, sessionHeat: null });
    }
  }

  return {
    clauses: [...criticalClauses].sort((a, b) => b.score - a.score).slice(0, limit),
    sentences: criticalSentences.slice(0, limit),
    words: criticalWords.slice(0, limit),
    readers,
    segmentedReaders,
    heat,
  };
}

/** «37 lettori su 52»: la frase che conta, sempre con il denominatore. */
export function readersPhrase(p: Population | { lost: number; readers: number } | null, what = "hanno rallentato qui"): string | null {
  if (!p) return null;
  const n = "slow" in p ? p.slow : p.lost;
  if (p.readers < POPULATION_MIN_READERS) return `${p.readers} ${p.readers === 1 ? "lettore" : "lettori"} in archivio: troppo pochi per un dato di popolazione`;
  return `${n} ${n === 1 ? "lettore" : "lettori"} su ${p.readers} ${what} (${Math.round((n / p.readers) * 100)}%)${p.readers < POPULATION_SOLID_READERS ? ", esplorativo sotto cinque lettori" : ""}`;
}
