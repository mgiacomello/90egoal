// Dal segnale grezzo a un indice di sforzo (proxy).
//
// Regola del libro: la comprensione si misura, la mente non si legge.
// Questo modulo NON dice "ha capito". Produce un indice relativo che
// segnala dove, rispetto alla baseline a riposo, il segnale emodinamico
// prefrontale si sposta. È un indizio, da leggere solo in convergenza con
// tempo di lettura, ritorni, test di comprensione e prova operativa.
//
// Metodo (volutamente semplice e dichiarato):
// 1. Sottrazione della luce ambiente: ir' = ir - amb, red' = red - amb.
// 2. Densità ottica relativa (legge di Beer-Lambert modificata, senza DPF):
//    od = -ln(I / I0), con I0 = media della baseline.
// 3. Proxy di ossigenazione: hbo ≈ odRed - k·odIr (k = 1 come prima
//    approssimazione, coefficienti di estinzione non applicati).
//    In fNIRS l'aumento di ossiemoglobina durante attivazione riduce
//    l'assorbimento dell'IR e aumenta quello del rosso: il segno è coerente.
// 4. Media dei due canali frontali (sinistro, destro) e media mobile.
// L'indice ha unità arbitrarie ed è confrontabile solo dentro la stessa sessione.

import type { Frame } from "./types";

export interface Baseline {
  irLeft: number; redLeft: number; irRight: number; redRight: number;
  sampleCount: number;
}

export interface EffortSample {
  timestamp: number;
  /** Proxy HbO canale sinistro (unità arbitrarie, 0 = baseline). */
  left: number;
  /** Proxy HbO canale destro. */
  right: number;
  /** Media dei due canali. */
  effort: number;
  /** Ampiezza del movimento della testa (g), per scartare gli artefatti. */
  motion: number;
}

export function computeBaseline(frames: Frame[]): Baseline | null {
  const valid = frames.filter(isUsable);
  if (valid.length < 10) return null;
  const mean = (pick: (f: Frame) => number) =>
    valid.reduce((s, f) => s + pick(f), 0) / valid.length;
  return {
    irLeft: mean((f) => f.irLeft - f.ambLeft),
    redLeft: mean((f) => f.redLeft - f.ambLeft),
    irRight: mean((f) => f.irRight - f.ambRight),
    redRight: mean((f) => f.redRight - f.ambRight),
    sampleCount: valid.length,
  };
}

/** Un campione con intensità nulle o negative dopo la sottrazione è inutilizzabile. */
export function isUsable(f: Frame): boolean {
  return (
    f.irLeft - f.ambLeft > 0 && f.redLeft - f.ambLeft > 0 &&
    f.irRight - f.ambRight > 0 && f.redRight - f.ambRight > 0
  );
}

function od(intensity: number, reference: number): number {
  if (intensity <= 0 || reference <= 0) return 0;
  return -Math.log(intensity / reference);
}

export function effortFromFrame(f: Frame, b: Baseline): EffortSample | null {
  if (!isUsable(f)) return null;
  const left = od(f.redLeft - f.ambLeft, b.redLeft) - od(f.irLeft - f.ambLeft, b.irLeft);
  const right = od(f.redRight - f.ambRight, b.redRight) - od(f.irRight - f.ambRight, b.irRight);
  // Accelerometro ±2 g su int16: 16384 ≈ 1 g. A riposo il modulo vale ~1 g.
  const g = Math.hypot(f.accX, f.accY, f.accZ) / 16384;
  return {
    timestamp: f.timestamp,
    left, right,
    effort: (left + right) / 2,
    motion: Math.abs(g - 1),
  };
}

/** Media mobile su una finestra di N campioni (25 campioni ≈ 1 s). */
export class MovingAverage {
  private buf: number[] = [];
  constructor(private readonly size: number) {}
  push(v: number): number {
    this.buf.push(v);
    if (this.buf.length > this.size) this.buf.shift();
    return this.buf.reduce((s, x) => s + x, 0) / this.buf.length;
  }
  reset(): void {
    this.buf = [];
  }
}

export interface EffortStats {
  mean: number;
  peak: number;
  sampleCount: number;
  /** Quota di campioni con movimento della testa oltre soglia. */
  motionArtifactRatio: number;
}

export const MOTION_THRESHOLD_G = 0.15;

export function summarize(samples: EffortSample[]): EffortStats {
  if (samples.length === 0) return { mean: 0, peak: 0, sampleCount: 0, motionArtifactRatio: 0 };
  let sum = 0;
  let peak = -Infinity;
  let artifacts = 0;
  for (const s of samples) {
    sum += s.effort;
    if (s.effort > peak) peak = s.effort;
    if (s.motion > MOTION_THRESHOLD_G) artifacts++;
  }
  return {
    mean: sum / samples.length,
    peak,
    sampleCount: samples.length,
    motionArtifactRatio: artifacts / samples.length,
  };
}
