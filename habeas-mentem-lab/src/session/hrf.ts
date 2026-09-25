// Attribuzione modellata del segnale corporeo.
//
// La fascia non misura una parola: la risposta emodinamica che il sensore
// ottico vede comincia 1-2 s dopo lo stimolo, ha il picco intorno a 5-6 s,
// torna a zero verso i 16 s con un piccolo sottoscatto. Qui non spostiamo
// una finestra: costruiamo, per ogni porzione (o clausola), il segnale che
// ci ASPETTEREMMO se solo quella porzione avesse prodotto sforzo (la sua
// esposizione convoluta con la risposta canonica) e stimiamo tutti i pesi
// insieme, ai minimi quadrati, sul segnale davvero registrato. È il modello
// lineare generale (GLM) dell'analisi fNIRS/fMRI. Le porzioni vicine si
// sovrappongono nel segnale: risolverle insieme le separa invece di
// confonderle. Resta un'attribuzione modellata, non una misura della parola.

import type { EffortSample } from "../mendi/signal";

/** Risposta emodinamica canonica: doppia gamma (Glover 1999 / SPM). Tempo in secondi. */
export const HRF = {
  peakS: 6,
  undershootS: 16,
  /** Rapporto tra ampiezza del sottoscatto e del picco. */
  undershootRatio: 1 / 6,
  /** Durata della risposta considerata (s). */
  lengthS: 30,
  /** Dispersione delle due gamma. */
  dispersion: 1,
};

/** Frequenza a cui si campiona il modello (Hz): il segnale è lento, 10 Hz bastano. */
export const MODEL_HZ = 10;

function gammaPdf(t: number, shape: number, scale: number): number {
  if (t <= 0) return 0;
  // Γ(shape) via Lanczos per shape non intero.
  return (Math.pow(t, shape - 1) * Math.exp(-t / scale)) / (Math.pow(scale, shape) * gamma(shape));
}

function gamma(z: number): number {
  const g = 7;
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));
  z -= 1;
  let x = c[0];
  for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
  const t = z + g + 0.5;
  return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
}

/** Il nucleo della risposta, campionato a MODEL_HZ e normalizzato a picco 1. */
export function hrfKernel(hz = MODEL_HZ): number[] {
  const n = Math.round(HRF.lengthS * hz);
  const d = HRF.dispersion;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / hz;
    out.push(gammaPdf(t, HRF.peakS / d, d) - HRF.undershootRatio * gammaPdf(t, HRF.undershootS / d, d));
  }
  const peak = Math.max(...out);
  return out.map((v) => v / peak);
}

export interface Interval {
  id: string;
  from: number;
  to: number;
}

export interface GlmResult {
  /** Peso stimato per ogni id (sforzo attribuito, unità del proxy). */
  beta: Map<string, number>;
  /** Errore standard di ogni peso. */
  se: Map<string, number>;
  /** Quanta varianza del segnale il modello spiega (0-1). */
  r2: number;
  /** Campioni del segnale usati. */
  samples: number;
  /** Frequenza del modello. */
  hz: number;
}

/**
 * Stima i pesi con il GLM: segnale ≈ Σ β_i (esposizione_i ⊗ HRF) + costante + deriva.
 * `effort` sono i campioni registrati (qualsiasi frequenza), `intervals` le
 * esposizioni (una per porzione; più visite della stessa porzione sommano
 * nello stesso regressore).
 */
export function fitHrfGlm(effort: EffortSample[], intervals: Interval[], hz = MODEL_HZ): GlmResult | null {
  const ids = [...new Set(intervals.map((i) => i.id))];
  if (effort.length < 2 || ids.length === 0) return null;
  const t0 = Math.min(effort[0].timestamp, ...intervals.map((i) => i.from));
  const t1 = Math.max(effort[effort.length - 1].timestamp, ...intervals.map((i) => i.to)) + HRF.lengthS * 1000;
  const n = Math.ceil(((t1 - t0) / 1000) * hz) + 1;

  // Segnale ricampionato a hz: media dei campioni in ogni cella; le celle vuote (fuori lettura) non entrano nel fit.
  const y = new Float64Array(n);
  const count = new Int32Array(n);
  for (const s of effort) {
    if (s.motion > 0.15) continue; // artefatti di movimento fuori dal modello
    const k = Math.round(((s.timestamp - t0) / 1000) * hz);
    if (k >= 0 && k < n) {
      y[k] += s.effort;
      count[k]++;
    }
  }
  const rows: number[] = [];
  for (let k = 0; k < n; k++) if (count[k] > 0) {
    y[k] /= count[k];
    rows.push(k);
  }
  if (rows.length < ids.length + 3) return null;

  // Regressori: box-car di esposizione ⊗ HRF, uno per id; poi costante e deriva lineare.
  const kernel = hrfKernel(hz);
  const p = ids.length + 2;
  const X: Float64Array[] = ids.map(() => new Float64Array(n));
  const idx = new Map(ids.map((id, i) => [id, i]));
  for (const iv of intervals) {
    const col = X[idx.get(iv.id)!];
    const a = Math.max(0, Math.round(((iv.from - t0) / 1000) * hz));
    const b = Math.min(n - 1, Math.round(((iv.to - t0) / 1000) * hz));
    for (let k = a; k <= b; k++) {
      for (let j = 0; j < kernel.length && k + j < n; j++) col[k + j] += kernel[j] / hz;
    }
  }
  const constant = new Float64Array(n).fill(1);
  const drift = new Float64Array(n);
  for (let k = 0; k < n; k++) drift[k] = (k / n) * 2 - 1;
  X.push(constant, drift);

  // Equazioni normali con una piccola cresta per la stabilità: (XᵀX + λI) β = Xᵀy.
  const A: number[][] = Array.from({ length: p }, () => new Array<number>(p).fill(0));
  const b = new Array<number>(p).fill(0);
  for (const k of rows) {
    for (let i = 0; i < p; i++) {
      const xi = X[i][k];
      if (xi === 0) continue;
      b[i] += xi * y[k];
      for (let j = i; j < p; j++) A[i][j] += xi * X[j][k];
    }
  }
  for (let i = 0; i < p; i++) for (let j = 0; j < i; j++) A[i][j] = A[j][i];
  const lambda = 1e-6 * (A.reduce((s, r, i) => s + r[i], 0) / p || 1);
  for (let i = 0; i < ids.length; i++) A[i][i] += lambda;
  const inv = invert(A);
  if (!inv) return null;
  const beta = inv.map((r) => r.reduce((s, v, j) => s + v * b[j], 0));

  // Residui, R², errori standard.
  let ssRes = 0;
  let ssTot = 0;
  const mean = rows.reduce((s, k) => s + y[k], 0) / rows.length;
  for (const k of rows) {
    let yhat = 0;
    for (let i = 0; i < p; i++) yhat += beta[i] * X[i][k];
    ssRes += (y[k] - yhat) ** 2;
    ssTot += (y[k] - mean) ** 2;
  }
  const dof = Math.max(1, rows.length - p);
  const sigma2 = ssRes / dof;
  const result: GlmResult = { beta: new Map(), se: new Map(), r2: ssTot > 0 ? 1 - ssRes / ssTot : 0, samples: rows.length, hz };
  ids.forEach((id, i) => {
    result.beta.set(id, beta[i]);
    result.se.set(id, Math.sqrt(Math.max(0, sigma2 * inv[i][i])));
  });
  return result;
}

/** Inversa con Gauss-Jordan e pivot parziale; null se singolare. */
function invert(M: number[][]): number[][] | null {
  const n = M.length;
  const A = M.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    if (Math.abs(A[piv][c]) < 1e-12) return null;
    [A[c], A[piv]] = [A[piv], A[c]];
    const d = A[c][c];
    for (let j = 0; j < 2 * n; j++) A[c][j] /= d;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = A[r][c];
      if (f === 0) continue;
      for (let j = 0; j < 2 * n; j++) A[r][j] -= f * A[c][j];
    }
  }
  return A.map((r) => r.slice(n));
}

/** Descrizione del modello per fascicolo e interfaccia. */
export const HRF_DESCRIPTION =
  `Il segnale corporeo è attribuito con un modello della risposta emodinamica (doppia gamma, picco a ${HRF.peakS} s, ` +
  `sottoscatto a ${HRF.undershootS} s, ${HRF.lengthS} s di durata): ogni porzione ha un regressore pari alla sua esposizione ` +
  `convoluta con la risposta, e i pesi si stimano tutti insieme ai minimi quadrati, con costante e deriva lineare; i campioni con ` +
  `movimento sono esclusi. Le sovrapposizioni tra porzioni vicine vengono così separate. È un'attribuzione modellata, non una misura della parola.`;
