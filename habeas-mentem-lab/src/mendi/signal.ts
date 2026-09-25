// Dal segnale grezzo a un indice di sforzo (proxy).
//
// Regola del libro: la comprensione si misura, la mente non si legge.
// Questo modulo NON dice "ha capito". Produce un indice relativo che
// segnala dove, rispetto alla baseline a riposo, il segnale emodinamico
// prefrontale si sposta. È un indizio, da leggere solo in convergenza con
// tempo di lettura, ritorni, test di comprensione e prova operativa.
//
// Metodo (dichiarato, standard fNIRS):
// 1. Sottrazione della luce ambiente: ir' = ir - amb, red' = red - amb.
// 2. Variazione di densità ottica per lunghezza d'onda (Beer-Lambert
//    modificata): ΔOD = -ln(I / I0), con I0 = media della baseline.
// 3. Inversione a due lunghezze d'onda con i coefficienti di estinzione di
//    emoglobina ossigenata (HbO) e deossigenata (HbR) a 660 nm (rosso) e
//    850 nm (infrarosso), tabelle di Prahl (cm⁻¹ / mM):
//      ΔHbO = (ε_HbR,850·ΔOD_660 − ε_HbR,660·ΔOD_850) / det
//      ΔHbR = (ε_HbO,660·ΔOD_850 − ε_HbO,850·ΔOD_660) / det
//    con det = ε_HbO,660·ε_HbR,850 − ε_HbO,850·ε_HbR,660, e percorso ottico
//    L·DPF = 3 cm · 6 = 18 cm: le unità sono µM stimati, confrontabili solo
//    dentro la sessione (le lunghezze d'onda reali della fascia non sono
//    pubblicate: 660/850 è l'ipotesi dichiarata).
// 4. Indice di sforzo = ΔHbO (attivazione prefrontale: sale HbO, scende HbR).
//    Media dei due canali frontali; media mobile per la vista dal vivo.
// 5. Movimento: giroscopio (±125 dps su int16) e modulo dell'accelerazione;
//    un campione è artefatto se la rotazione supera ROTATION_THRESHOLD_DPS o
//    l'accelerazione si scosta da 1 g oltre MOTION_THRESHOLD_G.

import type { Frame } from "./types";

/** Coefficienti di estinzione (cm⁻¹/mM), Prahl: HbO2 e Hb a 660 e 850 nm. */
export const EXTINCTION = {
  hbo660: 0.3200, hbr660: 3.2270,
  hbo850: 1.0580, hbr850: 0.6910,
};
/** Percorso ottico efficace L·DPF (cm). */
export const PATH_LENGTH_CM = 3 * 6;

/** Fondo scala del giroscopio: ±125 dps su int16 → 262.14 LSB per dps. */
export const GYRO_LSB_PER_DPS = 32768 / 125;
export const ROTATION_THRESHOLD_DPS = 12;

export interface Baseline {
  irLeft: number; redLeft: number; irRight: number; redRight: number;
  sampleCount: number;
}

export interface EffortSample {
  timestamp: number;
  /** ΔHbO canale sinistro (µM stimati, 0 = baseline). */
  left: number;
  /** ΔHbO canale destro. */
  right: number;
  /** Indice di sforzo: media dei due canali di ΔHbO. */
  effort: number;
  /** ΔHbR medio (scende durante l'attivazione). */
  hbr?: number;
  /** Scostamento del modulo dell'accelerazione da 1 g. */
  motion: number;
  /** Velocità angolare della testa (gradi al secondo). */
  rotation?: number;
}

/** Vero se il campione è un artefatto di movimento (rotazione o scossa). */
export function isArtifact(s: { motion: number; rotation?: number }): boolean {
  return s.motion > MOTION_THRESHOLD_G || (s.rotation ?? 0) > ROTATION_THRESHOLD_DPS;
}

/** Inversione a due lunghezze d'onda: da ΔOD (rosso, IR) a ΔHbO e ΔHbR in µM stimati. */
export function hemoglobin(odRed: number, odIr: number): { hbo: number; hbr: number } {
  const { hbo660: a, hbr660: b, hbo850: c, hbr850: d } = EXTINCTION;
  const det = a * d - c * b;
  const hbo = (d * odRed - b * odIr) / det / PATH_LENGTH_CM;
  const hbr = (a * odIr - c * odRed) / det / PATH_LENGTH_CM;
  return { hbo: hbo * 1000, hbr: hbr * 1000 };
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
  const l = hemoglobin(od(f.redLeft - f.ambLeft, b.redLeft), od(f.irLeft - f.ambLeft, b.irLeft));
  const r = hemoglobin(od(f.redRight - f.ambRight, b.redRight), od(f.irRight - f.ambRight, b.irRight));
  // Accelerometro ±2 g su int16: 16384 ≈ 1 g. A riposo il modulo vale ~1 g.
  const g = Math.hypot(f.accX, f.accY, f.accZ) / 16384;
  const rotation = Math.hypot(f.angX, f.angY, f.angZ) / GYRO_LSB_PER_DPS;
  return {
    timestamp: f.timestamp,
    left: l.hbo,
    right: r.hbo,
    effort: (l.hbo + r.hbo) / 2,
    hbr: (l.hbr + r.hbr) / 2,
    motion: Math.abs(g - 1),
    rotation,
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
    if (isArtifact(s)) artifacts++;
  }
  return {
    mean: sum / samples.length,
    peak,
    sampleCount: samples.length,
    motionArtifactRatio: artifacts / samples.length,
  };
}
