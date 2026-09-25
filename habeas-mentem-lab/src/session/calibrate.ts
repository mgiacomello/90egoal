// Tool 4: ricalibrare i pesi dell'LX Complexity Score sui dati raccolti.
//
// Nel libro (Springer, p. 147) «la ponderazione delle componenti è stata
// calibrata iterativamente […] con il coefficiente di correlazione tra
// punteggio LX aggregato e misura composita di comprensione come criterio:
// r = -0,71 sul corpus di calibrazione, r = -0,68 su quello di validazione».
// E: «sopra una certa soglia, poco sotto la metà della scala, la
// comprensione non cala: crolla».
//
// Qui rifacciamo lo stesso gesto, in piccolo e dichiarato: dalle sessioni
// aggregate costruiamo per ogni clausola una misura composita di
// comprensione (verifica, prova operativa, tempo compatibile con la lettura),
// cerchiamo i pesi delle quattro strade che rendono la correlazione più
// negativa, e la soglia oltre la quale la comprensione cade di più.
// Con poche clausole il risultato è esplorativo: lo diciamo nel fascicolo
// e il metodo dichiara in anticipo i risultati che lo smentirebbero
// (art. 6 della costituzione).

import type { Aggregate, AggregateClause } from "./aggregate";
import { LX_ACCESSIBILITY_THRESHOLD, type LxScore } from "./lx";

export interface LxWeights {
  syntactic: number;
  semantic: number;
  structural: number;
  conceptual: number;
}

/** I pesi con cui l'app calcola il totale oggi (src/session/lx.ts). */
export const DEFAULT_WEIGHTS: LxWeights = { syntactic: 0.35, semantic: 0.35, structural: 0.15, conceptual: 0.15 };

/** Correlazioni del libro, come riferimento nel confronto. */
export const BOOK_R = { calibration: -0.71, validation: -0.68 };

export const CALIBRATION_MINIMUMS = { sessions: 5, clauses: 6 };

export function lxTotalWith(lx: LxScore, w: LxWeights): number {
  return Math.round(lx.syntactic * w.syntactic + lx.semantic * w.semantic + lx.structural * w.structural + lx.conceptual * w.conceptual);
}

export interface ComprehensionPoint {
  clauseId: string;
  index: number;
  lx: LxScore;
  /** Misura composita 0-1: media delle componenti disponibili. */
  comprehension: number;
  components: { verify: number | null; operate: number | null; time: number };
}

/** La misura composita di comprensione per clausola, dai dati aggregati. */
export function comprehensionPoints(a: Aggregate): ComprehensionPoint[] {
  return a.clauses
    .filter((c) => c.readers > 0)
    .map((c) => {
      const verify = c.verification.accuracy;
      const operate = c.operational.success;
      const time = 1 - c.tooFastShare;
      const parts = [verify, operate, time].filter((x): x is number => x !== null);
      return {
        clauseId: c.clauseId,
        index: c.index,
        lx: c.lx,
        comprehension: parts.reduce((s, x) => s + x, 0) / parts.length,
        components: { verify, operate, time },
      };
    });
}

export function pearson(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return null;
  const mx = xs.reduce((s, x) => s + x, 0) / n;
  const my = ys.reduce((s, y) => s + y, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  if (sxx === 0 || syy === 0) return null;
  return sxy / Math.sqrt(sxx * syy);
}

export interface Calibration {
  eligible: boolean;
  reason: string | null;
  sessions: number;
  clauses: number;
  defaultWeights: LxWeights;
  /** Correlazione con i pesi di default. */
  defaultR: number | null;
  weights: LxWeights;
  /** Correlazione con i pesi ricalibrati. */
  r: number | null;
  /** Soglia oltre la quale la comprensione media cade di più, e di quanto. */
  threshold: number | null;
  thresholdDrop: number | null;
  points: ComprehensionPoint[];
  caveats: string[];
}

function rFor(points: ComprehensionPoint[], w: LxWeights): number | null {
  return pearson(points.map((p) => lxTotalWith(p.lx, w)), points.map((p) => p.comprehension));
}

/** Tutti i pesi a passo `step` che sommano a 1. */
function* simplex(step: number): Generator<LxWeights> {
  const n = Math.round(1 / step);
  for (let a = 0; a <= n; a++)
    for (let b = 0; a + b <= n; b++)
      for (let c = 0; a + b + c <= n; c++) {
        const d = n - a - b - c;
        yield { syntactic: a / n, semantic: b / n, structural: c / n, conceptual: d / n };
      }
}

function distance(a: LxWeights, b: LxWeights): number {
  return Math.hypot(a.syntactic - b.syntactic, a.semantic - b.semantic, a.structural - b.structural, a.conceptual - b.conceptual);
}

export function calibrate(a: Aggregate): Calibration {
  const points = comprehensionPoints(a);
  const base: Calibration = {
    eligible: false, reason: null, sessions: a.sessions, clauses: points.length,
    defaultWeights: DEFAULT_WEIGHTS, defaultR: rFor(points, DEFAULT_WEIGHTS),
    weights: DEFAULT_WEIGHTS, r: null, threshold: null, thresholdDrop: null, points, caveats: [],
  };
  if (a.sessions < CALIBRATION_MINIMUMS.sessions) {
    return { ...base, reason: `Servono almeno ${CALIBRATION_MINIMUMS.sessions} lettori (ora ${a.sessions}).` };
  }
  if (points.length < CALIBRATION_MINIMUMS.clauses) {
    return { ...base, reason: `Servono almeno ${CALIBRATION_MINIMUMS.clauses} clausole lette (ora ${points.length}).` };
  }
  if (base.defaultR === null) {
    return { ...base, reason: "La comprensione non varia tra le clausole: nessuna correlazione da calibrare." };
  }

  // Pesi: la correlazione più negativa; a parità, i pesi più vicini ai default.
  let best = DEFAULT_WEIGHTS;
  let bestR = base.defaultR;
  for (const w of simplex(0.05)) {
    const r = rFor(points, w);
    if (r === null) continue;
    if (r < bestR - 1e-9 || (Math.abs(r - bestR) < 1e-9 && distance(w, DEFAULT_WEIGHTS) < distance(best, DEFAULT_WEIGHTS))) {
      best = w;
      bestR = r;
    }
  }

  // Soglia: il taglio che separa di più la comprensione media, con almeno due clausole per lato.
  const totals = points.map((p) => lxTotalWith(p.lx, best));
  let threshold: number | null = null;
  let drop = 0;
  for (let t = 20; t <= 80; t++) {
    const below = points.filter((_, i) => totals[i] < t).map((p) => p.comprehension);
    const above = points.filter((_, i) => totals[i] >= t).map((p) => p.comprehension);
    if (below.length < 2 || above.length < 2) continue;
    const gap = below.reduce((s, x) => s + x, 0) / below.length - above.reduce((s, x) => s + x, 0) / above.length;
    if (gap > drop) {
      drop = gap;
      threshold = t;
    }
  }

  const caveats = [
    `Calibrazione esplorativa su ${points.length} clausole e ${a.sessions} lettori: il libro ne usa 18 documenti e 100 lettori. Le clausole sono poche: i pesi possono adattarsi al caso, non alla regola.`,
    "La misura composita di comprensione è la media di verifica, prova operativa e tempo compatibile con la lettura, dove disponibili; le clausole senza domande né compiti pesano solo con il tempo.",
    "Una correlazione non è una causa dimostrata. Il punteggio dice dove guardare, non che cosa è lecito.",
    `Che cosa smentirebbe il metodo: una correlazione positiva o vicina a zero anche con molti lettori, o pesi che cambiano da un documento all'altro senza regola.`,
  ];
  if (a.simulatedSessions > 0) caveats.unshift(`${a.simulatedSessions} sessioni con fascia simulata: il corpo non entra nella calibrazione, i tempi possono essere artificiali.`);

  return { ...base, eligible: true, weights: best, r: bestR, threshold, thresholdDrop: threshold ? drop : null, caveats };
}

export function describeWeights(w: LxWeights): string {
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  return `lingua ${pct(w.syntactic)} · distanza semantica ${pct(w.semantic)} · ordine ${pct(w.structural)} · affollamento ${pct(w.conceptual)}`;
}

export { LX_ACCESSIBILITY_THRESHOLD };
export type { AggregateClause };
