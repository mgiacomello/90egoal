import { describe, expect, it } from "vitest";
import { DOCUMENTS } from "../src/documents";
import { frictionMap } from "../src/session/friction";
import { clauseMetrics } from "../src/session/metrics";
import { lxScore, LX_ACCESSIBILITY_THRESHOLD } from "../src/session/lx";
import type { Session } from "../src/session/model";
import { autoDraft, documentAdvice, proposalsFor, readClauses } from "../src/session/rewrite";

const doc = DOCUMENTS[0];

describe("proposte di riscrittura", () => {
  it("sulla clausola delle basi giuridiche propone di spezzare, definire e spostare i rinvii", () => {
    const c3 = doc.clauses[2];
    const p = proposalsFor(c3, lxScore(c3.text));
    const kinds = new Set(p.map((x) => x.kind));
    expect(kinds.has("spezza")).toBe(true);
    expect(kinds.has("rinvii")).toBe(true);
    expect(kinds.has("parola")).toBe(true);
    for (const x of p) {
      expect(x.before.length).toBeGreaterThan(0);
      expect(x.after.length).toBeGreaterThan(0);
      expect(x.why.length).toBeGreaterThan(0);
    }
  });

  it("la bozza automatica abbassa l'LX della clausola più densa e viene rimisurata con lo stesso metro", () => {
    const c3 = doc.clauses[2];
    const d = autoDraft(c3)!;
    expect(d).not.toBeNull();
    expect(d.before).toBe(lxScore(c3.text).total);
    expect(d.after).toBe(lxScore(d.text).total);
    expect(d.after).toBeLessThan(d.before);
    expect(d.text).not.toContain("ai sensi");
  });

  it("una clausola già semplice non riceve proposte inutili", () => {
    const c9 = doc.clauses[8];
    const p = proposalsFor(c9, lxScore(c9.text));
    expect(p.filter((x) => x.kind === "spezza")).toHaveLength(0);
    expect(lxScore(c9.text).total).toBeLessThan(LX_ACCESSIBILITY_THRESHOLD);
  });

  it("l'interpretazione legge i sensori insieme e assegna le priorità", () => {
    let t = 0;
    const session: Session = {
      id: "s", participant: "p", documentId: doc.id, documentTitle: doc.title, device: null, createdAt: 0,
      consent: { accepted: true, timestamp: 0 },
      events: doc.clauses.flatMap((c) => {
        const enter = t; t += c.wordCount * 300;
        return [
          { type: "clause_enter" as const, timestamp: enter, clauseId: c.id, direction: "forward" as const },
          { type: "clause_leave" as const, timestamp: t - 100, clauseId: c.id },
        ];
      }),
      frames: [],
      answers: [{ questionId: "q3", clauseId: "c3", chosenIndex: 0, correct: false, timestamp: 0, ms: 4000 }],
      tasks: [{ taskId: "t1", clauseId: "c7", chosenClauseId: "c3", correct: false, timestamp: 0, ms: 9000, opened: 3 }],
    };
    const metrics = clauseMetrics(session, doc.clauses);
    const friction = frictionMap(metrics);
    const readings = readClauses(doc.clauses, metrics, friction);
    const c3 = readings.find((r) => r.clauseId === "c3")!;
    expect(c3.priority).toBe(1);
    expect(c3.interpretation.join(" ")).toContain("Verifica: 0/1");
    expect(c3.interpretation.join(" ")).toContain("Scelta per errore");
    expect(["lingua", "ordine"]).toContain(c3.leadRoad?.road);
    const advice = documentAdvice(readings);
    expect(advice[0]).toMatch(/^Ordine di intervento: 3/);
    expect(advice.some((a) => a.includes("abbassano l'LX"))).toBe(true);
  });
});
