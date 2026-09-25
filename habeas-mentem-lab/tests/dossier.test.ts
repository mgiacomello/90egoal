import { describe, expect, it } from "vitest";
import { DOCUMENTS } from "../src/documents";
import { buildDossier, dossierSummary, fingerprint } from "../src/session/dossier";
import { sessionJson } from "../src/session/export";
import { frictionMap } from "../src/session/friction";
import { clauseMetrics } from "../src/session/metrics";
import type { Session } from "../src/session/model";

const doc = DOCUMENTS[0];

const session: Session = {
  id: "hm-test", participant: "circe-vela-404", documentId: doc.id, documentTitle: doc.title,
  device: null, createdAt: 1_790_000_000_000, consent: { accepted: true, timestamp: 1_790_000_000_000 },
  events: doc.clauses.flatMap((c, i) => [
    { type: "clause_enter" as const, timestamp: i * 15_000, clauseId: c.id, direction: "forward" as const },
    { type: "clause_leave" as const, timestamp: i * 15_000 + 14_000, clauseId: c.id },
  ]),
  frames: [],
  answers: [
    { questionId: "q1", clauseId: "c5", chosenIndex: 1, correct: true, timestamp: 0, ms: 4000 },
    { questionId: "q2", clauseId: "c7", chosenIndex: 0, correct: false, timestamp: 0, ms: 6000 },
  ],
  tasks: [{ taskId: "t1", clauseId: "c7", chosenClauseId: "c7", correct: true, timestamp: 0, ms: 8000, opened: 2 }],
};

describe("fascicolo di comprensibilità", () => {
  const metrics = clauseMetrics(session, doc.clauses);
  const friction = frictionMap(metrics);
  const json = sessionJson(session, doc.clauses, metrics, friction);

  it("la sintesi dichiara ogni sensore, compreso quello assente", () => {
    const lines = dossierSummary({ session, doc, metrics, friction, sessionJson: json });
    expect(lines.join("\n")).toContain("Verifica: 1 risposte corrette su 2");
    expect(lines.join("\n")).toContain("Prova operativa: 1 compiti riusciti su 1");
    expect(lines.join("\n")).toContain("nessuna fascia collegata");
    expect(lines.join("\n")).toMatch(/Frizione per convergenza: \d+ clausole rosse/);
  });

  it("l'impronta è un SHA-256 stabile del JSON", async () => {
    const a = await fingerprint("habeas mentem");
    const b = await fingerprint("habeas mentem");
    expect(a).toHaveLength(64);
    expect(a).toBe(b);
    expect(await fingerprint("habeas mentem.")).not.toBe(a);
  });

  it("produce un PDF non vuoto con più pagine", async () => {
    const blob = await buildDossier({ session, doc, metrics, friction, sessionJson: json, responsible: "Marco Giacomello" });
    expect(blob.type).toBe("application/pdf");
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(bytes.length).toBeGreaterThan(10_000);
    const text = new TextDecoder("latin1").decode(bytes);
    expect(text.startsWith("%PDF")).toBe(true);
    expect((text.match(/\/Type\s*\/Page[^s]/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });
});
