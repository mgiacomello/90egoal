import { describe, expect, it } from "vitest";
import { archivable, groupByDocument, learn, learnWords, roadOrder, isLabModel, usableExports } from "../src/session/learning";
import { historyFor } from "../src/session/history";
import { lxScore, lxThreshold, setLxModel, LX_ACCESSIBILITY_THRESHOLD } from "../src/session/lx";
import { proposalsFor, setLearnedModel } from "../src/session/rewrite";
import type { SessionExport } from "../src/session/aggregate";
import type { ClauseMetrics } from "../src/session/metrics";
import type { Clause } from "../src/session/model";

const clauses: Clause[] = [
  { id: "c1", index: 1, heading: "1. Titolare", text: "Noi conserviamo i tuoi dati per dodici mesi. Poi li cancelliamo.", wordCount: 12 },
  { id: "c2", index: 2, heading: "2. Rinvii", text: "Ai sensi dell'art. 6, par. 1, lett. b), GDPR, nonché dell'art. 9, il titolare del trattamento, qualora sussista un legittimo interesse, effettua la profilazione ovvero la comunicazione a terzi, fermo restando quanto previsto dall'art. 13.", wordCount: 40 },
  { id: "c3", index: 3, heading: "3. Diritti", text: "Puoi chiedere una copia dei dati. Puoi chiederne la cancellazione.", wordCount: 11 },
];

function metric(c: Clause, over: Partial<ClauseMetrics> & { dwell?: number }): ClauseMetrics {
  const lx = lxScore(c.text);
  return {
    clauseId: c.id, index: c.index, heading: c.heading, wordCount: c.wordCount,
    dwellMs: over.dwell ?? 6000, visits: 1, returns: 0, wordsPerMinute: 200, plausibleReadMs: c.wordCount * 240, tooFastToRead: false,
    effort: { mean: 0, peak: 0, sampleCount: 0, motionArtifactRatio: 0 },
    effortModel: null, pulse: null, lx,
    verification: { asked: 0, correct: 0, meanMs: null },
    operational: { asked: 0, correct: 0, meanMs: null, timesChosenWrongly: 0 },
    ...over,
  };
}

/** Una sessione realistica: la clausola 2 (quella difficile) perde il lettore. */
function session(i: number, opts: { simulated?: boolean; hardLost?: boolean } = {}): SessionExport {
  const lost = opts.hardLost ?? i % 3 !== 0;
  const metrics = clauses.map((c) =>
    c.id === "c2"
      ? metric(c, { dwell: lost ? 2000 : 14000, tooFastToRead: lost, verification: { asked: 1, correct: lost ? 0 : 1, meanMs: 3000 }, operational: { asked: 1, correct: lost ? 0 : 1, meanMs: 5000, timesChosenWrongly: 0 } })
      : metric(c, { verification: { asked: 1, correct: 1, meanMs: 2000 } }),
  );
  const friction = clauses.map((c) => ({
    clauseId: c.id,
    level: (c.id === "c2" && lost ? "rosso" : "verde") as "rosso" | "verde",
    indicators: { time: c.id === "c2" && lost, body: false, text: c.id === "c2", verify: c.id === "c2" && lost, operate: c.id === "c2" && lost },
    count: c.id === "c2" && lost ? 4 : c.id === "c2" ? 1 : 0,
    reasons: [],
  }));
  const segments = [
    { segmentId: "s1", clauseId: "c1", clauseIndex: 1, index: 0, text: "Noi conserviamo i tuoi dati", wordCount: 5, dwellMs: 1500, msPerWord: 300, visits: 1, returns: 0, pauses: 0, effort: metrics[0].effort, model: null, z: -0.5 },
    { segmentId: "s2", clauseId: "c2", clauseIndex: 2, index: 1, text: "il titolare del trattamento", wordCount: 4, dwellMs: 3200, msPerWord: 800, visits: 1, returns: 0, pauses: 0, effort: metrics[0].effort, model: null, z: 1.6 },
    { segmentId: "s3", clauseId: "c2", clauseIndex: 2, index: 2, text: "fermo restando quanto previsto", wordCount: 4, dwellMs: 2800, msPerWord: 700, visits: 1, returns: 0, pauses: 0, effort: metrics[0].effort, model: null, z: 1.2 },
    { segmentId: "s4", clauseId: "c3", clauseIndex: 3, index: 3, text: "Puoi chiedere una copia dei dati", wordCount: 6, dwellMs: 1800, msPerWord: 300, visits: 1, returns: 0, pauses: 0, effort: metrics[0].effort, model: null, z: -0.4 },
  ];
  return {
    schema: "habeas-mentem-lab/session/v1",
    exportedAt: new Date(1700000000000 + i * 3600_000).toISOString(),
    session: {
      id: `hm-test-${i}`, documentId: "doc-test", documentTitle: "Documento di prova",
      device: { name: "Mendi", simulated: !!opts.simulated }, createdAt: 1700000000000 + i * 3600_000,
      answers: [], tasks: [],
    },
    clauses, metrics, friction,
    ...({ segments } as object),
  } as SessionExport;
}

describe("learning", () => {
  it("con archivio vuoto restituisce il modello predefinito", () => {
    const m = learn([]);
    expect(m.sessions).toBe(0);
    expect(m.lx.source).toBe("predefinito");
    expect(m.lx.threshold).toBe(LX_ACCESSIBILITY_THRESHOLD);
    expect(isLabModel(m)).toBe(true);
  });

  it("impara per documento e per clausola: la clausola difficile ha lostShare alto", () => {
    const m = learn(Array.from({ length: 6 }, (_, i) => session(i)));
    expect(m.sessions).toBe(6);
    expect(m.documents).toHaveLength(1);
    const d = m.documents[0];
    const c2 = d.clauses.find((c) => c.clauseId === "c2")!;
    const c1 = d.clauses.find((c) => c.clauseId === "c1")!;
    expect(c2.lostShare).toBeGreaterThan(0.5);
    expect(c1.lostShare).toBe(0);
    expect(c2.verifyAccuracy).toBeLessThan(0.5);
    expect(c2.msPerWordMedian).toBeGreaterThan(c1.msPerWordMedian ?? 0);
  });

  it("le parole lente ricorrenti emergono dalle porzioni", () => {
    const words = learnWords(Array.from({ length: 4 }, (_, i) => session(i)));
    const names = words.map((w) => w.word);
    expect(names).toContain("titolare");
    expect(names).toContain("trattamento");
    expect(names).not.toContain("conserviamo");
    expect(words[0].sessions).toBe(4);
  });

  it("non impara parole da meno di tre sessioni", () => {
    expect(learnWords([session(1)])).toHaveLength(0);
    expect(learnWords([session(1), session(2)])).toHaveLength(0);
  });

  it("il modello è deterministico: stessi dati, stesso modello", () => {
    const list = Array.from({ length: 5 }, (_, i) => session(i));
    const now = new Date("2026-01-01T00:00:00Z");
    expect(JSON.stringify(learn(list, now))).toBe(JSON.stringify(learn([...list].reverse(), now)));
  });

  it("le strade sono ordinate dalla più predittiva, solo con abbastanza sessioni", () => {
    expect(roadOrder(null)).toEqual(["syntactic", "semantic", "structural", "conceptual"]);
    const m = learn(Array.from({ length: 6 }, (_, i) => session(i)));
    const order = roadOrder(m);
    expect(order).toHaveLength(4);
    expect(new Set(order).size).toBe(4);
  });

  it("raggruppa per documento e sceglie la versione più recente se il numero di clausole cambia", () => {
    const old = session(0);
    const shorter = { ...session(9), clauses: clauses.slice(0, 2), metrics: session(9).metrics.slice(0, 2) } as SessionExport;
    const g = groupByDocument([old, shorter]);
    expect(g.get("doc-test")).toHaveLength(1);
    expect(g.get("doc-test")![0].session.id).toBe("hm-test-9");
  });

  it("archivable toglie tracciato, pseudonimo, eventi e battiti", () => {
    const raw = { ...session(1), session: { ...session(1).session, participant: "volpe-lenta-42", frames: [1, 2, 3], events: [{}], vitals: [{}], consent: { accepted: true } } };
    const a = archivable(raw)!;
    const s = a.session as unknown as Record<string, unknown>;
    expect(s.participant).toBeUndefined();
    expect(s.frames).toBeUndefined();
    expect(s.events).toBeUndefined();
    expect(s.vitals).toBeUndefined();
    expect(s.id).toBe("hm-test-1");
    expect((a as unknown as { segments: unknown[] }).segments).toHaveLength(4);
    expect(archivable({ schema: "altro" })).toBeNull();
    expect(usableExports([raw, null, 3, { schema: "x" }])).toHaveLength(1);
  });

  it("lo storico preferisce l'archivio al browser quando conosce il documento", () => {
    const m = learn(Array.from({ length: 4 }, (_, i) => session(i)));
    const h = historyFor("doc-test", "hm-test-99", [], m);
    expect(h.source).toBe("archivio");
    expect(h.sessions).toBe(4);
    expect(h.clauses.find((c) => c.clauseId === "c2")!.lostShare).toBeGreaterThanOrEqual(0.5);
    const none = historyFor("altro-doc", "x", [], m);
    expect(none.source).toBe("locale");
    expect(none.sessions).toBe(0);
  });

  it("il modello entra nell'LX (pesi e soglia) e nelle proposte (parole lente prima)", () => {
    const m = learn(Array.from({ length: 4 }, (_, i) => session(i)));
    const before = lxScore(clauses[1].text).total;
    setLxModel({ weights: { syntactic: 0.7, semantic: 0.1, structural: 0.1, conceptual: 0.1 }, threshold: 40 });
    expect(lxThreshold()).toBe(40);
    expect(lxScore(clauses[1].text).total).not.toBe(before);
    setLxModel(null);
    expect(lxThreshold()).toBe(LX_ACCESSIBILITY_THRESHOLD);
    expect(lxScore(clauses[1].text).total).toBe(before);

    setLearnedModel(m);
    const props = proposalsFor(clauses[1], lxScore(clauses[1].text));
    const learnedWord = props.find((p) => p.title.includes("(archivio)"));
    expect(learnedWord).toBeDefined();
    expect(learnedWord!.why).toMatch(/4 sessioni/);
    setLearnedModel(null);
    expect(proposalsFor(clauses[1], lxScore(clauses[1].text)).some((p) => p.title.includes("(archivio)"))).toBe(false);
  });
});
