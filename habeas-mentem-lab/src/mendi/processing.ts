// Elaborazione in linea del segnale: quello che l'analisi fNIRS fa sempre,
// e che rende leggibile una risposta lenta e sepolta nel rumore.
//
// 1. Passa-banda emodinamico (0,01–0,2 Hz): via battito (~1 Hz), respiro
//    (~0,25 Hz) e deriva lenta. Filtri IIR causali, quindi usabili dal vivo.
// 2. Regressione del canale corto: il canale «pulse» della fascia vede
//    soprattutto la circolazione superficiale (cute, sistemica), che
//    contamina anche i canali frontali. Si stima in una finestra scorrevole
//    quanto il canale corto spiega del canale lungo e lo si sottrae.
// 3. Battito dal canale pulse: picchi dell'onda pletismografica, intervalli
//    tra battiti, frequenza (bpm) e variabilità (RMSSD). È un indicatore
//    SISTEMICO e rapido (2–5 s): il carico mentale alza il battito e abbassa
//    la variabilità, ma lo fanno anche emozione, postura e caffè. Va letto
//    come tale, mai come misura della comprensione.

/** Passa-basso Butterworth del 2° ordine (bilineare), causale. */
export class LowPass {
  private a1 = 0; private a2 = 0; private b0 = 0; private b1 = 0; private b2 = 0;
  private x1 = 0; private x2 = 0; private y1 = 0; private y2 = 0;
  private primed = false;
  constructor(cutoffHz: number, sampleHz: number) {
    const w = Math.tan((Math.PI * cutoffHz) / sampleHz);
    const k = Math.SQRT2;
    const n = 1 / (1 + k * w + w * w);
    this.b0 = w * w * n; this.b1 = 2 * this.b0; this.b2 = this.b0;
    this.a1 = 2 * (w * w - 1) * n; this.a2 = (1 - k * w + w * w) * n;
  }
  push(x: number): number {
    if (!this.primed) { this.x1 = this.x2 = x; this.y1 = this.y2 = x; this.primed = true; }
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
  reset(): void { this.primed = false; }
}

/** Passa-alto Butterworth del 2° ordine (bilineare), causale. */
export class HighPass {
  private a1 = 0; private a2 = 0; private b0 = 0; private b1 = 0; private b2 = 0;
  private x1 = 0; private x2 = 0; private y1 = 0; private y2 = 0;
  private primed = false;
  constructor(cutoffHz: number, sampleHz: number) {
    const w = Math.tan((Math.PI * cutoffHz) / sampleHz);
    const k = Math.SQRT2;
    const n = 1 / (1 + k * w + w * w);
    this.b0 = n; this.b1 = -2 * n; this.b2 = n;
    this.a1 = 2 * (w * w - 1) * n; this.a2 = (1 - k * w + w * w) * n;
  }
  push(x: number): number {
    if (!this.primed) { this.x1 = this.x2 = x; this.y1 = this.y2 = 0; this.primed = true; }
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

/**
 * Passa-banda = due passa-alto e due passa-basso in cascata (4° ordine):
 * il respiro (0,25 Hz) va attenuato di oltre 30 dB perché non copra il battito.
 */
export class BandPass {
  private hp1: HighPass; private hp2: HighPass; private lp1: LowPass; private lp2: LowPass;
  constructor(lowHz: number, highHz: number, sampleHz: number) {
    this.hp1 = new HighPass(lowHz, sampleHz); this.hp2 = new HighPass(lowHz, sampleHz);
    this.lp1 = new LowPass(highHz, sampleHz); this.lp2 = new LowPass(highHz, sampleHz);
  }
  push(x: number): number {
    return this.lp2.push(this.lp1.push(this.hp2.push(this.hp1.push(x))));
  }
}

/** Banda emodinamica standard. */
export const HEMO_BAND_HZ: [number, number] = [0.01, 0.2];

/** Regressione del canale corto su finestra scorrevole: lungo − β·corto, β ≥ 0. */
export class ShortChannelRegressor {
  private xs: number[] = []; private ys: number[] = [];
  constructor(private readonly window: number) {}
  push(long: number, short: number): { clean: number; beta: number } {
    this.xs.push(short); this.ys.push(long);
    if (this.xs.length > this.window) { this.xs.shift(); this.ys.shift(); }
    const n = this.xs.length;
    if (n < 50) return { clean: long, beta: 0 };
    let mx = 0, my = 0;
    for (let i = 0; i < n; i++) { mx += this.xs[i]; my += this.ys[i]; }
    mx /= n; my /= n;
    let sxy = 0, sxx = 0;
    for (let i = 0; i < n; i++) { const dx = this.xs[i] - mx; sxy += dx * (this.ys[i] - my); sxx += dx * dx; }
    const beta = sxx > 0 ? Math.max(0, Math.min(3, sxy / sxx)) : 0;
    return { clean: long - beta * short, beta };
  }
}

export interface PulseReading {
  /** Battiti al minuto (mediana degli ultimi intervalli), null finché non stabile. */
  bpm: number | null;
  /** RMSSD degli intervalli tra battiti negli ultimi 30 s (ms), null se pochi battiti. */
  rmssd: number | null;
  /** Qualità 0-1: quota di intervalli plausibili. */
  quality: number;
}

/** Rilevatore di battito dall'onda pletismografica (canale pulse, infrarosso). */
export class PulseDetector {
  private band: BandPass;
  private prev = 0; private prevPrev = 0;
  private lastPeakAt = 0;
  private threshold = 0;
  private ibis: { at: number; ms: number }[] = [];
  private envelope = 0;
  /** Si riarma solo dopo che l'onda è tornata sotto zero: niente doppi conteggi sull'onda dicrota. */
  private armed = true;
  constructor(sampleHz: number) {
    // 0,7–2,0 Hz (42–120 bpm): la seconda armonica del battito resta fuori, così l'onda dicrota non raddoppia il conteggio.
    this.band = new BandPass(0.7, 2.0, sampleHz);
  }
  /** `ir` è l'intensità infrarossa del canale pulse (scende alla sistole: usiamo −ir). */
  push(ir: number, timestamp: number): PulseReading | null {
    const v = this.band.push(-ir);
    this.envelope = Math.max(Math.abs(v), this.envelope * 0.995);
    this.threshold = this.envelope * 0.35;
    let beat = false;
    if (v < 0) this.armed = true;
    // Picco locale sopra soglia, riarmato dal passaggio per lo zero, con periodo refrattario di 400 ms (150 bpm).
    // Periodo refrattario: 400 ms, o il 60% dell'intervallo mediano corrente quando lo conosciamo.
    const recent = this.ibis.slice(-8).map((i) => i.ms).sort((a, b) => a - b);
    const refractory = recent.length >= 4 ? Math.max(400, 0.6 * recent[Math.floor(recent.length / 2)]) : 400;
    if (this.armed && this.prev > this.prevPrev && this.prev >= v && this.prev > this.threshold && timestamp - this.lastPeakAt > refractory) {
      this.armed = false;
      if (this.lastPeakAt > 0) {
        const ms = timestamp - this.lastPeakAt;
        if (ms >= 300 && ms <= 2000) this.ibis.push({ at: timestamp, ms });
      }
      this.lastPeakAt = timestamp;
      beat = true;
    }
    this.prevPrev = this.prev; this.prev = v;
    if (!beat) return null;
    const cutoff = timestamp - 30_000;
    this.ibis = this.ibis.filter((i) => i.at >= cutoff);
    return this.reading();
  }
  reading(): PulseReading {
    const recent = this.ibis.slice(-8).map((i) => i.ms);
    if (recent.length < 4) return { bpm: null, rmssd: null, quality: 0 };
    const sorted = [...recent].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const plausible = this.ibis.filter((i) => Math.abs(i.ms - median) / median < 0.3);
    const quality = plausible.length / this.ibis.length;
    let ss = 0, n = 0;
    for (let i = 1; i < plausible.length; i++) { const d = plausible[i].ms - plausible[i - 1].ms; ss += d * d; n++; }
    return {
      bpm: Math.round(60_000 / median),
      rmssd: n >= 5 ? Math.round(Math.sqrt(ss / n)) : null,
      quality,
    };
  }
  reset(): void {
    this.ibis = []; this.lastPeakAt = 0; this.envelope = 0;
  }
}

import type { EffortSample } from "./signal";

/** Banda usata per i dati registrati: 0,01–0,5 Hz (meno ritardo di fase del filtro; il modello HRF fa il resto). */
export const RECORD_BAND_HZ: [number, number] = [0.01, 0.5];

/**
 * Pipeline in linea: passa-banda su ΔHbO frontale e sul canale corto,
 * poi regressione del canale corto. Ritorna il campione con `effort` pulito
 * e i campi diagnostici valorizzati.
 */
export class EffortPipeline {
  private long: BandPass;
  private short: BandPass;
  private regressor: ShortChannelRegressor;
  constructor(sampleHz: number) {
    this.long = new BandPass(RECORD_BAND_HZ[0], RECORD_BAND_HZ[1], sampleHz);
    this.short = new BandPass(RECORD_BAND_HZ[0], RECORD_BAND_HZ[1], sampleHz);
    this.regressor = new ShortChannelRegressor(sampleHz * 60);
  }
  push(sample: EffortSample): EffortSample {
    const raw = sample.raw ?? sample.effort;
    const filtered = this.long.push(raw);
    if (sample.short === undefined) return { ...sample, effort: filtered, raw };
    const shortFiltered = this.short.push(sample.short);
    const { clean, beta } = this.regressor.push(filtered, shortFiltered);
    return { ...sample, effort: clean, raw, short: shortFiltered, shortBeta: beta };
  }
}
