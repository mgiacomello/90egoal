import { describe, expect, it } from "vitest";
import { DOCUMENTS } from "../src/documents";
import { frictionMap } from "../src/session/friction";
import { clauseMetrics } from "../src/session/metrics";
import type { Session } from "../src/session/model";

const doc = DOCUMENTS[0]; // informativa neurotech: c3 e c7 hanno LX alto

function session(over: Partial<Session> = {}): Session {
  return {
    id: "hm-test", participant: "ulisse-nodo-1", documentId: doc.id, documentTitle: doc.title,
    device: null, createdAt: 0, consent: { accepted: true, timestamp: 0 },
    // Lettura a 200 parole al minuto: 300 ms per parola, così nessuna clausola risulta "troppo veloce".
    events: (() => {
      let t = 0;
      return doc.clauses.flatMap((c) => {
        const enter = t;
        t += c.wordCount * 300;
        return [
          { type: "clause_enter" as const, timestamp: enter, clauseId: c.id, direction: "forward" as const },
          { type: "clause_leave" as const, timestamp: t - 500, clauseId: c.id },
        ];
      });
    })(),
    frames: [], answers: [], tasks: [],
    ...over,
  };
}

describe("mappa della frizione", () => {
  it("il solo LX alto resta verde: un indizio debole non colora", () => {
    const f = frictionMap(clauseMetrics(session(), doc.clauses));
    expect(f.every((x) => x.level === "verde")).toBe(true);
    expect(f.find((x) => x.clauseId === "c3")!.indicators.text).toBe(true);
  });

  it("una verifica sbagliata da sola porta a giallo", () => {
    const s = session({
      answers: [{ questionId: "q3", clauseId: "c3", chosenIndex: 0, correct: false, timestamp: 0, ms: 5000 }],
    });
    const f = frictionMap(clauseMetrics(s, doc.clauses));
    expect(f.find((x) => x.clauseId === "c3")!.level).toBe("giallo");
  });

  it("verifica sbagliata + prova fallita + LX alto = rosso; le altre clausole non cambiano", () => {
    const s = session({
      answers: [{ questionId: "q2", clauseId: "c7", chosenIndex: 0, correct: false, timestamp: 0, ms: 5000 }],
      tasks: [{ taskId: "t1", clauseId: "c7", chosenClauseId: "c3", correct: false, timestamp: 0, ms: 9000, opened: 3 }],
    });
    const m = clauseMetrics(s, doc.clauses);
    const f = frictionMap(m);
    const c7 = f.find((x) => x.clauseId === "c7")!;
    expect(c7.level).toBe("rosso");
    expect(c7.count).toBe(3);
    expect(c7.reasons.join(" ")).toContain("prova operativa");
    // c3 è stata scelta per sbaglio al posto di c7: lo registriamo, ma non la colora.
    expect(m.find((x) => x.clauseId === "c3")!.operational.timesChosenWrongly).toBe(1);
    expect(f.find((x) => x.clauseId === "c3")!.level).toBe("verde");
  });

  it("tempo + LX senza verifica = giallo, mai rosso", () => {
    const s = session({
      events: [
        { type: "clause_enter", timestamp: 0, clauseId: "c3", direction: "start" },
        { type: "reading_end", timestamp: 400 },
      ],
    });
    const c3 = frictionMap(clauseMetrics(s, doc.clauses)).find((x) => x.clauseId === "c3")!;
    expect(c3.indicators.time).toBe(true);
    expect(c3.indicators.text).toBe(true);
    expect(c3.level).toBe("giallo");
  });

  it("il corpo da solo non colora mai", () => {
    const frame = {
      timestamp: 1, accX: 0, accY: 0, accZ: 16384, angX: 0, angY: 0, angZ: 0, temperature: 33,
      irLeft: 1, redLeft: 1, ambLeft: 0, irRight: 1, redRight: 1, ambRight: 0, irPulse: 1, redPulse: 1, ambPulse: 0,
    };
    const s = session({
      frames: doc.clauses.map((c, i) => ({
        frame, clauseId: c.id, phase: "reading" as const,
        effort: { timestamp: 1, left: 0, right: 0, effort: c.id === "c9" ? 0.05 : 0.001 * i, motion: 0 },
      })),
    });
    const f = frictionMap(clauseMetrics(s, doc.clauses));
    // c9 ("Modifiche") ha LX basso: l'unico indizio è il corpo.
    const c9 = f.find((x) => x.clauseId === "c9")!;
    expect(c9.indicators.body).toBe(true);
    expect(c9.indicators.text).toBe(false);
    expect(c9.level).toBe("verde");
  });

  it("ogni documento modello ha domande e compiti che puntano a clausole esistenti", () => {
    for (const d of DOCUMENTS) {
      const ids = new Set(d.clauses.map((c) => c.id));
      expect(d.questions.length).toBe(3);
      expect(d.tasks.length).toBe(2);
      for (const q of d.questions) {
        expect(ids.has(q.clauseId)).toBe(true);
        expect(q.correctIndex).toBeLessThan(q.options.length);
      }
      for (const t of d.tasks) expect(ids.has(t.clauseId)).toBe(true);
    }
  });
});
