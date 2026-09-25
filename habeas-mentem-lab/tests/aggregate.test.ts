import { describe, expect, it } from "vitest";
import { DOCUMENTS } from "../src/documents";
import { AggregateError, aggregateSessions, parseSessionExport } from "../src/session/aggregate";
import { aggregateSummary } from "../src/session/dossier";
import { sessionJson } from "../src/session/export";
import { frictionMap } from "../src/session/friction";
import { clauseMetrics } from "../src/session/metrics";
import type { Session } from "../src/session/model";

const doc = DOCUMENTS[0];

/** Una sessione sintetica: lettura di `dwell` ms per clausola, con verifica e prova impostabili. */
function makeExport(id: string, dwell: number, opts: { c7wrong?: boolean; t2fail?: boolean; fast4?: boolean } = {}) {
  const session: Session = {
    id, participant: "x", documentId: doc.id, documentTitle: doc.title, device: null,
    createdAt: 1_790_000_000_000, consent: { accepted: true, timestamp: 1_790_000_000_000 },
    events: doc.clauses.flatMap((c, i) => {
      const ms = opts.fast4 && c.id === "c4" ? 300 : dwell;
      return [
        { type: "clause_enter" as const, timestamp: i * 60_000, clauseId: c.id, direction: "forward" as const },
        { type: "clause_leave" as const, timestamp: i * 60_000 + ms, clauseId: c.id },
      ];
    }),
    frames: [],
    answers: [
      { questionId: "q1", clauseId: "c5", chosenIndex: 1, correct: true, timestamp: 0, ms: 3000 },
      { questionId: "q2", clauseId: "c7", chosenIndex: 0, correct: !opts.c7wrong, timestamp: 0, ms: 3000 },
      { questionId: "q3", clauseId: "c3", chosenIndex: 2, correct: true, timestamp: 0, ms: 3000 },
    ],
    tasks: [
      { taskId: "t1", clauseId: "c7", chosenClauseId: "c7", correct: true, timestamp: 0, ms: 5000, opened: 1 },
      { taskId: "t2", clauseId: "c6", chosenClauseId: opts.t2fail ? "c5" : "c6", correct: !opts.t2fail, timestamp: 0, ms: 5000, opened: 2 },
    ],
  };
  const metrics = clauseMetrics(session, doc.clauses);
  const friction = frictionMap(metrics);
  return parseSessionExport(sessionJson(session, doc.clauses, metrics, friction), id);
}

describe("fascicolo aggregato", () => {
  it("rifiuta JSON che non sono esportazioni di sessione", () => {
    expect(() => parseSessionExport("{}")).toThrow(AggregateError);
    expect(() => parseSessionExport("non json")).toThrow(AggregateError);
  });

  it("rifiuta sessioni su documenti diversi", () => {
    const a = makeExport("a", 40_000);
    const b = { ...makeExport("b", 40_000), session: { ...a.session, id: "b", documentId: "altro" } };
    expect(() => aggregateSessions([a, b])).toThrow(/stesso documento/);
  });

  it("cinque lettori: la clausola 7 diventa rossa per convergenza, la 4 gialla per il tempo", () => {
    const exports = [
      makeExport("a", 40_000, { c7wrong: true, fast4: true }),
      makeExport("b", 40_000, { c7wrong: true, fast4: true }),
      makeExport("c", 40_000, { c7wrong: true, fast4: true }),
      makeExport("d", 40_000, { c7wrong: false, t2fail: true }),
      makeExport("e", 40_000, { c7wrong: true, t2fail: true }),
    ];
    const a = aggregateSessions(exports);
    expect(a.sessions).toBe(5);
    expect(a.sessionsWithSignal).toBe(0);
    const c7 = a.clauses.find((c) => c.clauseId === "c7")!;
    expect(c7.verification).toMatchObject({ asked: 5, correct: 1 });
    expect(c7.friction.indicators.verify).toBe(true);
    expect(c7.friction.indicators.text).toBe(true); // LX 52
    // verifica + testo = 2 indizi con uno forte → almeno giallo; con la quota "persi" alta
    expect(["giallo", "rosso"]).toContain(c7.friction.level);
    expect(c7.lostShare).toBeGreaterThanOrEqual(0.8);

    const c4 = a.clauses.find((c) => c.clauseId === "c4")!;
    expect(c4.tooFastShare).toBeCloseTo(0.6);
    expect(c4.friction.indicators.time).toBe(true);
    expect(c4.friction.level).toBe("giallo"); // tempo + LX, nessuna verifica: mai rosso

    const c6 = a.clauses.find((c) => c.clauseId === "c6")!;
    expect(c6.operational).toMatchObject({ asked: 5, correct: 3 });
    expect(c6.friction.indicators.operate).toBe(true); // 60% < 70%
    expect(c6.friction.level).toBe("giallo");

    const c5 = a.clauses.find((c) => c.clauseId === "c5")!;
    expect(c5.operational.timesChosenWrongly).toBe(2);
    expect(c5.friction.level).toBe("verde");
  });

  it("con pochi lettori la verifica non conta ancora", () => {
    const a = aggregateSessions([makeExport("a", 40_000, { c7wrong: true }), makeExport("b", 40_000, { c7wrong: true })]);
    const c7 = a.clauses.find((c) => c.clauseId === "c7")!;
    expect(c7.verification.asked).toBe(2);
    expect(c7.friction.indicators.verify).toBe(false);
  });

  it("la sintesi dichiara lettori, segnale e la clausola che perde più lettori", () => {
    const a = aggregateSessions([makeExport("a", 40_000, { c7wrong: true }), makeExport("b", 40_000, { c7wrong: true }), makeExport("c", 40_000)]);
    const text = aggregateSummary(a).join("\n");
    expect(text).toContain("3 lettori sullo stesso documento");
    expect(text).toContain("0 lettori con segnale");
    expect(text).toMatch(/La clausola che perde più lettori è la 7/);
  });
});
