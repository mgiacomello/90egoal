import { describe, expect, it } from "vitest";
import { DOCUMENTS } from "../src/documents";
import { LX_ACCESSIBILITY_THRESHOLD, lxScore } from "../src/session/lx";

describe("LX Complexity Score (stima euristica)", () => {
  it("una frase breve e piana resta sotto la soglia", () => {
    const s = lxScore("Puoi cancellare il tuo account quando vuoi. Ti basta un clic nelle impostazioni.");
    expect(s.total).toBeLessThan(LX_ACCESSIBILITY_THRESHOLD);
    expect(s.details.sentences).toBe(2);
  });

  it("una clausola densa di rinvii e termini non definiti supera la soglia", () => {
    const clause = DOCUMENTS[0].clauses[2].text; // 3. Finalità e basi giuridiche
    const s = lxScore(clause);
    expect(s.total).toBeGreaterThan(LX_ACCESSIBILITY_THRESHOLD);
    expect(s.details.citations).toBeGreaterThanOrEqual(3);
    expect(s.details.avgSentenceLength).toBeGreaterThan(30);
    expect(s.linguistic).toBeGreaterThan(50);
  });

  it("ogni dimensione e il totale stanno tra 0 e 100", () => {
    for (const d of DOCUMENTS) {
      for (const c of d.clauses) {
        const s = lxScore(c.text);
        for (const v of [s.linguistic, s.conceptual, s.structural, s.semantic, s.total]) {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(100);
        }
      }
    }
  });

  it("riconosce un termine definito nel testo come non 'orfano'", () => {
    const defined = lxScore("La pseudonimizzazione, cioè la sostituzione del nome con un codice, protegge i dati.");
    const orphan = lxScore("La pseudonimizzazione protegge i dati.");
    expect(defined.details.undefinedTerms).toBe(0);
    expect(orphan.details.undefinedTerms).toBe(1);
  });
});
