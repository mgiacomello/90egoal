import { describe, expect, it } from "vitest";
import { prefaceAssumptions, FORMAL_ELEMENTS } from "../src/session/preface";
import { learn, EMPTY_MODEL } from "../src/session/learning";
import { DOCUMENTS } from "../src/documents";
import { clauseMetrics } from "../src/session/metrics";
import { frictionMap } from "../src/session/friction";
import type { Session } from "../src/session/model";
import type { SessionExport } from "../src/session/aggregate";

const doc = DOCUMENTS[0];

function session(i: number, inferenceRight: boolean): Session {
  const t0 = 1700000000000;
  const events: Session["events"] = [];
  let t = t0;
  for (const c of doc.clauses) {
    events.push({ type: "clause_enter", clauseId: c.id, timestamp: t, direction: "forward" } as Session["events"][number]);
    t += c.wordCount * 300;
    events.push({ type: "clause_leave", clauseId: c.id, timestamp: t } as Session["events"][number]);
  }
  return {
    id: `hm-pref-${i}`, participant: "x", documentId: doc.id, documentTitle: doc.title, device: null, createdAt: t0 + i,
    consent: { accepted: true, timestamp: t0 }, events, frames: [],
    answers: doc.questions.map((q) => ({ questionId: q.id, clauseId: q.clauseId, chosenIndex: 0, correct: q.theme === "inferenza" || q.theme === "cessione" ? inferenceRight : true, theme: q.theme, timestamp: t, ms: 2000 })),
    tasks: [],
  };
}

function exportOf(s: Session): SessionExport {
  const metrics = clauseMetrics(s, doc.clauses);
  return { schema: "habeas-mentem-lab/session/v1", exportedAt: "", session: { ...s, frames: undefined } as unknown as SessionExport["session"], clauses: doc.clauses, metrics, friction: frictionMap(metrics) };
}

describe("le assunzioni della prefazione", () => {
  it("il documento modello ha domande su inferenza e cessione, e tutti gli elementi formali", () => {
    expect(doc.questions.some((q) => q.theme === "inferenza")).toBe(true);
    expect(doc.questions.some((q) => q.theme === "cessione")).toBe(true);
    const text = doc.clauses.map((c) => c.text).join("\n");
    expect(FORMAL_ELEMENTS.filter(([, re]) => re.test(text)).length).toBe(FORMAL_ELEMENTS.length);
  });

  it("senza archivio: sei tesi, con dati insufficienti o misura, mai un verdetto", () => {
    const s = session(0, false);
    const metrics = clauseMetrics(s, doc.clauses);
    const items = prefaceAssumptions({ doc, session: s, metrics, friction: frictionMap(metrics), model: null });
    expect(items).toHaveLength(6);
    expect(items.every((a) => a.status === "dati insufficienti" || a.status === "misura")).toBe(true);
    expect(items[0].session?.value).toBe("0/1 inferenze");
    expect(items.every((a) => a.quote.length > 40 && a.falsifier.length > 20)).toBe(true);
  });

  it("con l'archivio: lettori che sbagliano le inferenze sostengono la tesi, lettori che le azzeccano no", () => {
    const wrong = learn(Array.from({ length: 12 }, (_, i) => exportOf(session(i, false))));
    expect(wrong.themes.find((t) => t.theme === "inferenza")?.accuracy).toBe(0);
    const s = session(99, false);
    const metrics = clauseMetrics(s, doc.clauses);
    const a = prefaceAssumptions({ doc, session: s, metrics, friction: frictionMap(metrics), model: wrong });
    expect(a.find((x) => x.id === "inferenze")?.status).toBe("sostenuta");
    expect(a.find((x) => x.id === "sostanza")?.status).toBe("sostenuta");

    const right = learn(Array.from({ length: 12 }, (_, i) => exportOf(session(i, true))));
    const b = prefaceAssumptions({ doc, session: s, metrics, friction: frictionMap(metrics), model: right });
    expect(b.find((x) => x.id === "inferenze")?.status).toBe("non sostenuta");
    expect(b.find((x) => x.id === "sostanza")?.status).toBe("non sostenuta");
  });

  it("il modello vuoto ha i campi corpo e temi", () => {
    expect(EMPTY_MODEL.body.r).toBeNull();
    expect(EMPTY_MODEL.themes).toEqual([]);
  });
});
