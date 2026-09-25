import { describe, expect, it } from "vitest";
import { computeBaseline, effortFromFrame, MovingAverage, summarize } from "../src/mendi/signal";
import type { Frame } from "../src/mendi/types";

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

  it("vale zero sulla baseline stessa e cresce quando il rosso viene assorbito di più dell'IR", () => {
    const b = computeBaseline(Array.from({ length: 10 }, () => frame()))!;
    expect(effortFromFrame(frame(), b)!.effort).toBeCloseTo(0, 10);
    // Attivazione: meno rosso trasmesso (più assorbito), IR un po' più trasmesso.
    const active = frame({ redLeft: 29000, redRight: 29000, irLeft: 50500, irRight: 50500 });
    expect(effortFromFrame(active, b)!.effort).toBeGreaterThan(0);
    const calm = frame({ redLeft: 31000, redRight: 31000 });
    expect(effortFromFrame(calm, b)!.effort).toBeLessThan(0);
  });

  it("segnala il movimento della testa e scarta i campioni saturi", () => {
    const b = computeBaseline(Array.from({ length: 10 }, () => frame()))!;
    const moving = effortFromFrame(frame({ accX: 8000 }), b)!;
    expect(moving.motion).toBeGreaterThan(0.1);
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
