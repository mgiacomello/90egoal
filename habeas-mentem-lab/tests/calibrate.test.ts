import { describe, expect, it } from "vitest";
import type { Aggregate, AggregateClause } from "../src/session/aggregate";
import { calibrate, comprehensionPoints, DEFAULT_WEIGHTS, lxTotalWith, pearson } from "../src/session/calibrate";
import { lxScore } from "../src/session/lx";

/** Un aggregato sintetico: la comprensione cala quando cresce la distanza semantica. */
function fakeAggregate(sessions: number, nClauses: number): Aggregate {
  const clauses: AggregateClause[] = Array.from({ length: nClauses }, (_, i) => {
    const lx = lxScore("Testo di prova che serve solo a produrre un oggetto.");
    // Forziamo le dimensioni: la semantica cresce con i; le altre variano senza legame con la comprensione.
    lx.syntactic = 20 + ((i * 37) % 50); lx.structural = 10 + ((i * 53) % 60); lx.conceptual = 5 + ((i * 29) % 45); lx.semantic = 10 + i * 10;
    lx.total = lxTotalWith(lx, DEFAULT_WEIGHTS);
    const comprehension = Math.max(0, 1 - i * 0.1);
    return {
      clauseId: `c${i + 1}`, index: i + 1, heading: `Clausola ${i + 1}`, wordCount: 50,
      readers: sessions, dwellMedianMs: 20_000, tooFastShare: 1 - comprehension, returnedShare: 0, lx,
      verification: { asked: sessions, correct: Math.round(sessions * comprehension), accuracy: comprehension },
      operational: { asked: 0, correct: 0, success: null, timesChosenWrongly: 0 },
      effort: { mean: null, readersWithSignal: 0 },
      lostShare: 0,
      friction: { level: "verde", indicators: { time: false, body: false, text: false, verify: false, operate: false }, count: 0, reasons: [] },
    };
  });
  return { documentId: "d", documentTitle: "Doc", sessions, sessionsWithSignal: 0, simulatedSessions: 0, firstSession: 0, lastSession: 0, clauses };
}

describe("ricalibrazione LX (tool 4)", () => {
  it("pearson: correlazione perfetta negativa e casi degeneri", () => {
    expect(pearson([1, 2, 3, 4], [4, 3, 2, 1])).toBeCloseTo(-1);
    expect(pearson([1, 1, 1], [1, 2, 3])).toBeNull();
    expect(pearson([1, 2], [2, 1])).toBeNull();
  });

  it("rifiuta con pochi lettori o poche clausole, dichiarando il motivo", () => {
    expect(calibrate(fakeAggregate(3, 9)).reason).toMatch(/almeno 5 lettori/);
    expect(calibrate(fakeAggregate(6, 4)).reason).toMatch(/almeno 6 clausole/);
  });

  it("sposta il peso sulla dimensione che spiega la comprensione", () => {
    const cal = calibrate(fakeAggregate(8, 9));
    expect(cal.eligible).toBe(true);
    expect(cal.r).not.toBeNull();
    expect(cal.r!).toBeLessThanOrEqual(cal.defaultR!);
    expect(cal.r!).toBeLessThan(-0.9);
    expect(cal.weights.semantic).toBeGreaterThan(cal.defaultWeights.semantic);
    expect(cal.weights.syntactic + cal.weights.semantic + cal.weights.structural + cal.weights.conceptual).toBeCloseTo(1);
    expect(cal.threshold).not.toBeNull();
    expect(cal.thresholdDrop!).toBeGreaterThan(0);
    expect(cal.caveats.length).toBeGreaterThanOrEqual(4);
  });

  it("la misura composita usa solo le componenti disponibili", () => {
    const pts = comprehensionPoints(fakeAggregate(5, 3));
    expect(pts[0].components.operate).toBeNull();
    expect(pts[0].comprehension).toBeCloseTo(1);
    expect(pts[2].comprehension).toBeCloseTo(0.8);
  });
});
