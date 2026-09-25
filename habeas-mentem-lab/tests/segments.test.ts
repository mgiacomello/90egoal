import { describe, expect, it } from "vitest";
import type { Clause, Session } from "../src/session/model";
import {
  autoDurationMs,
  HEMODYNAMIC_LAG_MS,
  MAX_SEGMENT_WORDS,
  segmentMetrics,
  segmentsFor,
  slowestSegments,
  splitIntoSegments,
} from "../src/session/segments";

const clause = (id: string, index: number, text: string): Clause => ({
  id, index, heading: null, text, wordCount: text.split(/\s+/).length,
});

const c1 = clause("c1", 1, "Il fornitore, salvo diversa pattuizione scritta, non risponde dei danni indiretti che derivino dall'uso del servizio.");
const c2 = clause("c2", 2, "Il contratto si rinnova tacitamente.");

describe("divisione in porzioni", () => {
  it("ricompone il testo originale e non supera il massimo di parole", () => {
    const segs = splitIntoSegments(c1);
    expect(segs.map((s) => s.text).join(" ")).toBe(c1.text);
    expect(segs.every((s) => s.wordCount <= MAX_SEGMENT_WORDS)).toBe(true);
    expect(segs.reduce((n, s) => n + s.wordCount, 0)).toBe(c1.wordCount);
    expect(segs[0].id).toBe("c1s1");
  });

  it("spezza alla punteggiatura e prima dei connettivi, senza code di una parola", () => {
    const segs = splitIntoSegments(c1);
    expect(segs[0].text).toBe("Il fornitore,");
    expect(segs.every((s) => s.wordCount >= 2)).toBe(true);
  });

  it("una clausola breve resta una porzione sola", () => {
    expect(splitIntoSegments(c2)).toHaveLength(1);
  });

  it("il ritmo a scorrimento dà almeno 700 ms per porzione", () => {
    expect(autoDurationMs(1, 300)).toBe(700);
    expect(autoDurationMs(5, 150)).toBe(2000);
  });
});

describe("metriche per porzione", () => {
  const segs = segmentsFor([c1, c2]);
  const t0 = 1_000_000;
  const base: Session = {
    id: "s", participant: "p", documentId: "d", documentTitle: "d", device: null, createdAt: t0,
    consent: { accepted: true, timestamp: t0 },
    reading: { mode: "porzioni", wordsPerMinute: null, voiceRecorded: false },
    events: [], frames: [], answers: [], tasks: [],
  };

  it("calcola tempo per parola, ritorni, fermate e attribuzione ritardata del corpo", () => {
    const s: Session = { ...base, events: [], frames: [] };
    let t = t0;
    const enter = (seg: (typeof segs)[number], direction: "start" | "forward" | "back" | "auto", ms: number) => {
      s.events.push({ type: "segment_enter", timestamp: t, clauseId: seg.clauseId, segmentId: seg.id, direction });
      t += ms;
      s.events.push({ type: "segment_leave", timestamp: t, segmentId: seg.id });
    };
    // Prima porzione 1 s, seconda 6 s (lenta), ritorno alla prima per 1 s, poi tutte le altre a 500 ms.
    enter(segs[0], "start", 1000);
    enter(segs[1], "forward", 6000);
    s.events.push({ type: "segment_pause", timestamp: t, segmentId: segs[1].id });
    enter(segs[0], "back", 1000);
    for (const sg of segs.slice(2)) enter(sg, "forward", 500);
    s.events.push({ type: "reading_end", timestamp: t });

    // Campioni di sforzo: valore 1 solo nella finestra ritardata della seconda porzione (prima visita), 0 altrove.
    const secondFrom = t0 + 1000 + HEMODYNAMIC_LAG_MS;
    const secondTo = t0 + 7000 + HEMODYNAMIC_LAG_MS;
    for (let ts = t0; ts < t + 10_000; ts += 100) {
      const inWindow = ts >= secondFrom && ts < secondTo;
      s.frames.push({
        frame: { timestamp: ts, accX: 0, accY: 0, accZ: 16384, angX: 0, angY: 0, angZ: 0, temperature: 30, irLeft: 1, redLeft: 1, ambLeft: 0, irRight: 1, redRight: 1, ambRight: 0, irPulse: 0, redPulse: 0, ambPulse: 0 },
        clauseId: "c1", phase: "reading",
        effort: { timestamp: ts, left: 0, right: 0, effort: inWindow ? 1 : 0, motion: 0 },
      });
    }

    const rows = segmentMetrics(s, [c1, c2]);
    expect(rows).toHaveLength(segs.length);
    const first = rows[0];
    const second = rows[1];
    expect(first.dwellMs).toBe(2000);
    expect(first.visits).toBe(2);
    expect(first.returns).toBe(1);
    expect(second.pauses).toBe(1);
    expect(second.msPerWord).toBeCloseTo(6000 / segs[1].wordCount);
    // La porzione lenta è la più lenta e ha il calore massimo; il corpo ritardato la vede.
    expect(slowestSegments(rows, 1)[0].segmentId).toBe(second.segmentId);
    expect(second.heat).toBeGreaterThanOrEqual(3);
    expect(second.effort.mean).toBeGreaterThan(0.5);
    expect(rows[2].effort.mean).toBeLessThan(0.5);
  });

  it("senza eventi di porzione non produce righe (modo clausola intera)", () => {
    expect(segmentMetrics(base, [c1, c2])).toEqual([]);
  });
});
