import { describe, expect, it } from "vitest";
import { computeBaseline, effortFromFrame, isArtifact, MovingAverage, summarize } from "../src/mendi/signal";
import type { Frame } from "../src/mendi/types";
import * as sig from "../src/mendi/signal";

function frame(over: Partial<Frame> = {}): Frame {
  return {
    timestamp: 0,
    accX: 0, accY: 0, accZ: 16384,
    angX: 0, angY: 0, angZ: 0,
    temperature: 33,
    irLeft: 50000, redLeft: 30000, ambLeft: 1000,
    irRight: 50000, redRight: 30000, ambRight: 1000,
    irPulse: 60000, redPulse: 35000, ambPulse: 900,
    ...over,
  };
}

describe("indice di sforzo", () => {
  it("richiede almeno 10 campioni utilizzabili per la baseline", () => {
    expect(computeBaseline(Array.from({ length: 9 }, () => frame()))).toBeNull();
    const b = computeBaseline(Array.from({ length: 10 }, () => frame()))!;
    expect(b.irLeft).toBe(49000); // ambiente sottratta
    expect(b.sampleCount).toBe(10);
  });

  it("vale zero sulla baseline; l'attivazione (più assorbimento IR, meno rosso) alza HbO e abbassa HbR", () => {
    const b = computeBaseline(Array.from({ length: 10 }, () => frame()))!;
    const rest = effortFromFrame(frame(), b)!;
    expect(rest.effort).toBeCloseTo(0, 10);
    expect(rest.hbr).toBeCloseTo(0, 10);
    // Attivazione prefrontale: sale HbO (assorbe di più a 850 nm → meno IR trasmesso),
    // scende HbR (assorbe di più a 660 nm → più rosso trasmesso).
    const active = frame({ irLeft: 49000, irRight: 49000, redLeft: 30400, redRight: 30400 });
    const a = effortFromFrame(active, b)!;
    expect(a.effort).toBeGreaterThan(0);
    expect(a.hbr!).toBeLessThan(0);
    const calm = frame({ irLeft: 51000, irRight: 51000, redLeft: 29600, redRight: 29600 });
    expect(effortFromFrame(calm, b)!.effort).toBeLessThan(0);
  });

  it("l'inversione a due lunghezze d'onda è coerente con i coefficienti di estinzione", () => {
    // ΔOD prodotti da HbO = +1 mM·cm e HbR = 0 devono tornare HbO > 0, HbR ≈ 0.
    const { EXTINCTION, hemoglobin, PATH_LENGTH_CM } = sig;
    const od660 = EXTINCTION.hbo660 * PATH_LENGTH_CM * 0.001;
    const od850 = EXTINCTION.hbo850 * PATH_LENGTH_CM * 0.001;
    const h = hemoglobin(od660, od850);
    expect(h.hbo).toBeCloseTo(1, 6);
    expect(h.hbr).toBeCloseTo(0, 6);
  });

  it("segnala il movimento della testa (scossa o rotazione) e scarta i campioni saturi", () => {
    const b = computeBaseline(Array.from({ length: 10 }, () => frame()))!;
    const moving = effortFromFrame(frame({ accX: 12000 }), b)!;
    expect(moving.motion).toBeGreaterThan(0.15);
    expect(isArtifact(moving)).toBe(true);
    // Rotazione lenta: il modulo dell'accelerazione resta 1 g, ma il giroscopio la vede.
    const turning = effortFromFrame(frame({ angY: Math.round(20 * (32768 / 125)) }), b)!;
    expect(turning.motion).toBeLessThan(0.05);
    expect(turning.rotation!).toBeCloseTo(20, 0);
    expect(isArtifact(turning)).toBe(true);
    expect(isArtifact(effortFromFrame(frame(), b)!)).toBe(false);
    expect(effortFromFrame(frame({ irLeft: 500, ambLeft: 1000 }), b)).toBeNull();
  });

  it("riassume media, picco e quota di artefatti", () => {
    const s = summarize([
      { timestamp: 0, left: 0, right: 0, effort: 0.1, motion: 0 },
      { timestamp: 1, left: 0, right: 0, effort: 0.3, motion: 0.5 },
    ]);
    expect(s.mean).toBeCloseTo(0.2);
    expect(s.peak).toBeCloseTo(0.3);
    expect(s.motionArtifactRatio).toBe(0.5);
    expect(summarize([]).sampleCount).toBe(0);
  });

  it("media mobile su finestra fissa", () => {
    const m = new MovingAverage(2);
    expect(m.push(1)).toBe(1);
    expect(m.push(3)).toBe(2);
    expect(m.push(5)).toBe(4);
  });
});
