import { describe, expect, it } from "vitest";
import { DOCUMENTS } from "../src/documents";
import { clausesCsv, framesCsv } from "../src/session/export";
import { clauseMetrics } from "../src/session/metrics";
import { splitIntoClauses, type Session } from "../src/session/model";

describe("divisione in clausole", () => {
  it("riconosce titoli brevi senza punto e blocchi separati da riga vuota", () => {
    const clauses = splitIntoClauses(`
1. Titolare

Testo della prima clausola.

Seconda clausola senza titolo, con più parole.
`);
    expect(clauses).toHaveLength(2);
    expect(clauses[0].heading).toBe("1. Titolare");
    expect(clauses[0].wordCount).toBe(4);
    expect(clauses[1].heading).toBeNull();
  });

  it("i documenti modello hanno tutti almeno 5 clausole con titolo", () => {
    for (const d of DOCUMENTS) {
      expect(d.clauses.length).toBeGreaterThanOrEqual(5);
      expect(d.clauses.every((c) => c.heading)).toBe(true);
    }
  });
});

describe("metriche per clausola", () => {
  const doc = DOCUMENTS[2]; // cookie
  const [c1, c2] = doc.clauses;

  const session: Session = {
    id: "hm-test",
    participant: "ulisse-albero-123",
    documentId: doc.id,
    documentTitle: doc.title,
    device: null,
    createdAt: 0,
    consent: { accepted: true, timestamp: 0 },
    answers: [],
    tasks: [],
    events: [
      { type: "clause_enter", timestamp: 0, clauseId: c1.id, direction: "start" },
      { type: "clause_leave", timestamp: 500, clauseId: c1.id },
      { type: "clause_enter", timestamp: 500, clauseId: c2.id, direction: "forward" },
      { type: "clause_leave", timestamp: 20_500, clauseId: c2.id },
      { type: "clause_enter", timestamp: 20_500, clauseId: c1.id, direction: "back" },
      { type: "clause_leave", timestamp: 30_500, clauseId: c1.id },
      { type: "reading_end", timestamp: 30_500 },
    ],
    frames: [
      {
        frame: {
          timestamp: 600, accX: 0, accY: 0, accZ: 16384, angX: 0, angY: 0, angZ: 0, temperature: 33,
          irLeft: 1, redLeft: 1, ambLeft: 0, irRight: 1, redRight: 1, ambRight: 0, irPulse: 1, redPulse: 1, ambPulse: 0,
        },
        clauseId: c2.id,
        phase: "reading",
        effort: { timestamp: 600, left: 0.2, right: 0.4, effort: 0.3, motion: 0 },
      },
    ],
  };

  it("somma le visite, conta i ritorni e segnala la lettura impossibile", () => {
    const m = clauseMetrics(session, doc.clauses);
    expect(m[0].dwellMs).toBe(10_500); // 500 + 10 000
    expect(m[0].visits).toBe(2);
    expect(m[0].returns).toBe(1);
    expect(m[1].dwellMs).toBe(20_000);
    expect(m[1].effort.mean).toBeCloseTo(0.3);
    expect(m[1].effort.sampleCount).toBe(1);
    expect(m[2].dwellMs).toBe(0);
    expect(m[2].wordsPerMinute).toBeNull();
  });

  it("marca come troppo veloce una clausola vista per mezzo secondo", () => {
    const quick: Session = {
      ...session,
      events: [
        { type: "clause_enter", timestamp: 0, clauseId: c2.id, direction: "start" },
        { type: "reading_end", timestamp: 500 },
      ],
      frames: [],
      answers: [],
      tasks: [],
    };
    const m = clauseMetrics(quick, doc.clauses);
    expect(m[1].tooFastToRead).toBe(true);
    expect(m[1].wordsPerMinute!).toBeGreaterThan(600);
  });

  it("esporta CSV con intestazione e una riga per clausola / per frame", () => {
    const m = clauseMetrics(session, doc.clauses);
    const csv = clausesCsv(session, m);
    expect(csv.split("\n").filter(Boolean)).toHaveLength(doc.clauses.length + 1);
    expect(csv.startsWith("session,participant,document,clause,")).toBe(true);
    const frames = framesCsv(session);
    expect(frames.split("\n").filter(Boolean)).toHaveLength(2);
    expect(frames).toContain("0.30000");
  });
});
