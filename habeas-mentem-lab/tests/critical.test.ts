import { describe, expect, it } from "vitest";
import { criticalPoints, populationHeat, readersPhrase, wordProposal } from "../src/session/critical";
import { learn, sentenceOfSegments } from "../src/session/learning";
import { lxScore } from "../src/session/lx";
import { frictionMap } from "../src/session/friction";
import type { SessionExport } from "../src/session/aggregate";
import type { ClauseMetrics } from "../src/session/metrics";
import type { Clause } from "../src/session/model";
import type { SegmentMetrics } from "../src/session/segments";
import { splitIntoSegments } from "../src/session/segments";

const clauses: Clause[] = [
  { id: "c1", index: 1, heading: "1. Conservazione", text: "Conserviamo i tuoi dati per dodici mesi. Poi li cancelliamo senza eccezioni.", wordCount: 12 },
  { id: "c2", index: 2, heading: "2. Base giuridica", text: "Ai sensi dell'art. 6, par. 1, lett. b), GDPR, nonché dell'art. 9, il titolare del trattamento, qualora sussista un legittimo interesse, effettua la profilazione ovvero la comunicazione a terzi. Puoi opporti in ogni momento scrivendo al titolare.", wordCount: 45 },
];

function metric(c: Clause, over: Partial<ClauseMetrics> = {}): ClauseMetrics {
  return {
    clauseId: c.id, index: c.index, heading: c.heading, wordCount: c.wordCount,
    dwellMs: 8000, visits: 1, returns: 0, wordsPerMinute: 200, plausibleReadMs: c.wordCount * 240, tooFastToRead: false,
    effort: { mean: 0, peak: 0, sampleCount: 0, motionArtifactRatio: 0 }, effortModel: null, pulse: null, lx: lxScore(c.text),
    verification: { asked: 0, correct: 0, meanMs: null }, operational: { asked: 0, correct: 0, meanMs: null, timesChosenWrongly: 0 },
    ...over,
  };
}

/** Porzioni con z: la prima frase di c2 (i rinvii) lenta per tutti, il resto normale. */
function segments(slowZ = 1.8): SegmentMetrics[] {
  return clauses.flatMap((c) => splitIntoSegments(c)).map((s) => {
    const slow = s.clauseId === "c2" && /art\.|GDPR|titolare|qualora|legittimo|profilazione/.test(s.text);
    const z = slow ? slowZ : -0.3;
    const msPerWord = slow ? 900 : 280;
    return {
      segmentId: s.id, clauseId: s.clauseId, clauseIndex: s.clauseId === "c1" ? 1 : 2, index: s.index, text: s.text, wordCount: s.wordCount,
      dwellMs: msPerWord * s.wordCount, msPerWord, visits: 1, returns: 0, pauses: 0,
      effort: { mean: 0, peak: 0, sampleCount: 0, motionArtifactRatio: 0 }, model: null, z, heat: slow ? 3 : 1,
    };
  });
}

function session(i: number): SessionExport {
  const metrics = clauses.map((c) => metric(c, c.id === "c2" ? { tooFastToRead: i % 2 === 0, verification: { asked: 1, correct: i % 3 === 0 ? 1 : 0, meanMs: 2000 } } : {}));
  return {
    schema: "habeas-mentem-lab/session/v1", exportedAt: new Date().toISOString(),
    session: { id: `hm-crit-${i}`, documentId: "doc-crit", documentTitle: "Prova", device: { name: "Mendi", simulated: false }, createdAt: 1700000000000 + i * 1000, answers: [], tasks: [] },
    clauses, metrics, friction: frictionMap(metrics),
    ...({ segments: segments(1.5 + (i % 3) * 0.3) } as object),
  } as SessionExport;
}

describe("punti critici", () => {
  it("assegna le porzioni alle frasi per conteggio di parole", () => {
    const segs = splitIntoSegments(clauses[1]);
    const { sentences, bySegmentIndex } = sentenceOfSegments(clauses[1], segs);
    expect(sentences).toHaveLength(2);
    expect(bySegmentIndex[0]).toBe(0);
    expect(bySegmentIndex[bySegmentIndex.length - 1]).toBe(1);
  });

  it("senza archivio ordina per questa sessione e propone sostituzioni", () => {
    const metrics = clauses.map((c) => metric(c));
    const crit = criticalPoints(clauses, metrics, frictionMap(metrics), segments(), null, "doc-crit");
    expect(crit.readers).toBe(0);
    expect(crit.sentences[0].clauseId).toBe("c2");
    expect(crit.sentences[0].index).toBe(0);
    expect(crit.sentences[0].session?.slow).toBe(true);
    expect(crit.sentences[0].draft?.after).toBeLessThan(crit.sentences[0].draft?.before ?? 0);
    expect(crit.words.length).toBeGreaterThan(0);
    expect(crit.words.every((w) => w.session)).toBe(true);
    expect(crit.heat.filter((h) => h.clauseId === "c2").every((h) => h.populationHeat === null)).toBe(true);
  });

  it("con l'archivio conta i lettori: «N su M hanno rallentato qui»", () => {
    const model = learn(Array.from({ length: 6 }, (_, i) => session(i)));
    const d = model.documents[0];
    expect(d.segmentedSessions).toBe(6);
    const slowSentence = d.sentences.find((s) => s.clauseId === "c2" && s.index === 0)!;
    expect(slowSentence.readers).toBe(6);
    expect(slowSentence.slowReaders).toBe(6);
    const easy = d.sentences.find((s) => s.clauseId === "c1")!;
    expect(easy.slowReaders).toBe(0);
    expect(d.words.some((w) => w.word === "titolare" || w.word === "trattamento")).toBe(true);

    const metrics = clauses.map((c) => metric(c));
    const crit = criticalPoints(clauses, metrics, frictionMap(metrics), segments(), model, "doc-crit");
    expect(crit.readers).toBe(6);
    expect(crit.sentences[0].population).toEqual(expect.objectContaining({ readers: 6, slow: 6, share: 1 }));
    expect(readersPhrase(crit.sentences[0].population)).toBe("6 lettori su 6 hanno rallentato qui (100%)");
    const seg = crit.heat.find((h) => h.population && h.population.slowShare === 1)!;
    expect(seg.populationHeat).toBe(4);
    expect(crit.clauses[0].clauseId).toBe("c2");
    expect(crit.clauses[0].population?.readers).toBe(6);
  });

  it("sessione a clausola intera: le porzioni vengono dall'archivio", () => {
    const model = learn(Array.from({ length: 4 }, (_, i) => session(i)));
    const metrics = clauses.map((c) => metric(c));
    const crit = criticalPoints(clauses, metrics, frictionMap(metrics), [], model, "doc-crit");
    expect(crit.heat.length).toBeGreaterThan(2);
    expect(crit.heat.some((h) => h.populationHeat === 4)).toBe(true);
    expect(crit.sentences[0].session).toBeNull();
    expect(crit.sentences[0].population?.readers).toBe(4);
  });

  it("calore di popolazione e proposte per parola", () => {
    expect(populationHeat(null)).toBeNull();
    expect(populationHeat({ readers: 2, slowShare: 1 } as never)).toBeNull();
    expect(populationHeat({ readers: 10, slowShare: 0.1 } as never)).toBe(1);
    expect(populationHeat({ readers: 10, slowShare: 0.35 } as never)).toBe(3);
    expect(wordProposal("qualora").after).toBe("se");
    expect(wordProposal("titolare del trattamento").after).toMatch(/cioè/);
    expect(wordProposal("zzzz").why).toMatch(/glossario/);
    expect(readersPhrase({ readers: 2, slow: 2, share: 1 })).toMatch(/troppo pochi/);
  });
});

describe("correzioni dalla revisione", () => {
  it("«eventuale» diventa «possibile», non «possibil$1»", async () => {
    const { autoDraft, definitionFor } = await import("../src/session/rewrite");
    const d = autoDraft({ id: "x", index: 1, heading: null, text: "Le eventuali modifiche e l'eventuale revoca saranno comunicate.", wordCount: 9 });
    expect(d?.text ?? "").not.toContain("$1");
    expect(d?.text ?? "").toContain("possibili");
    expect(definitionFor("trattamento")).toBeUndefined();
    expect(definitionFor("titolare del trattamento")).toBeDefined();
  });

  it("una porzione non letta non sposta le frasi delle successive", () => {
    const segs = splitIntoSegments(clauses[1]);
    const full = sentenceOfSegments(clauses[1], segs);
    const withoutSecond = sentenceOfSegments(clauses[1], segs.filter((_, i) => i !== 1));
    expect(withoutSecond.bySegmentIndex).toEqual(full.bySegmentIndex.filter((_, i) => i !== 1));
  });

  it("i conteggi «persi» usano tutte le sessioni come denominatore", () => {
    const model = learn(Array.from({ length: 6 }, (_, i) => session(i)));
    const c2 = model.documents[0].clauses.find((c) => c.clauseId === "c2")!;
    expect(c2.sessions).toBe(6);
    expect(c2.lost).toBe(Math.round(c2.lostShare * 6));
    const metrics = clauses.map((c) => metric(c));
    const crit = criticalPoints(clauses, metrics, frictionMap(metrics), segments(), model, "doc-crit");
    expect(crit.clauses.find((k) => k.clauseId === "c2")!.population).toEqual(expect.objectContaining({ readers: 6, lost: c2.lost }));
  });

  it("sessioni di versioni diverse dello stesso documento non si mescolano", () => {
    const changed = clauses.map((c) => (c.id === "c1" ? { ...c, text: c.text + " Una parola in più." } : c));
    const model = learn(Array.from({ length: 4 }, (_, i) => session(i)));
    const metrics = changed.map((c) => metric(c));
    const crit = criticalPoints(changed, metrics, frictionMap(metrics), [], model, "doc-crit");
    expect(crit.readers).toBe(0);
    expect(model.sessions).toBe(4);
  });

  it("usableExports rifiuta porzioni malformate e id mancanti", async () => {
    const { usableExports } = await import("../src/session/learning");
    const good = session(1);
    const badSeg = { ...good, segments: [{}] };
    const noId = { ...good, session: { ...good.session, id: undefined } };
    expect(usableExports([good, badSeg, noId])).toHaveLength(1);
  });
});
