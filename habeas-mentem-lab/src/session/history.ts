// Storico locale delle sessioni, per documento.
//
// Resta nel browser (localStorage), senza nomi: per ogni sessione conserva
// l'identificativo, la data e, per clausola, il livello di frizione e gli
// indizi. Serve al fascicolo per dire «in N sessioni precedenti su questo
// documento la clausola X è stata gialla o rossa il Y% delle volte».

import type { Friction } from "./friction";
import type { ClauseMetrics } from "./metrics";
import type { LabModel } from "./learning";

export interface HistoryRecord {
  documentId: string;
  sessionId: string;
  createdAt: number;
  clauses: { id: string; level: Friction["level"]; tooFast: boolean; lx: number; verifyWrong: boolean; operateFailed: boolean }[];
}

const KEY = "hm-lab-history-v1";

export function loadHistory(): HistoryRecord[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as HistoryRecord[]) : [];
  } catch {
    return [];
  }
}

export function recordSession(documentId: string, sessionId: string, createdAt: number, metrics: ClauseMetrics[], friction: Friction[]): void {
  try {
    const all = loadHistory().filter((r) => r.sessionId !== sessionId);
    all.push({
      documentId, sessionId, createdAt,
      clauses: metrics.map((m) => {
        const f = friction.find((x) => x.clauseId === m.clauseId)!;
        return { id: m.clauseId, level: f.level, tooFast: m.tooFastToRead, lx: m.lx.total, verifyWrong: f.indicators.verify, operateFailed: f.indicators.operate };
      }),
    });
    localStorage.setItem(KEY, JSON.stringify(all.slice(-200)));
  } catch {
    // Senza localStorage (anteprime, navigazione privata) lo storico non esiste: non è bloccante.
  }
}

export interface ClauseHistory {
  clauseId: string;
  sessions: number;
  lostShare: number;
  verifyWrongShare: number;
  /** Tempo mediano per parola nelle sessioni archiviate (solo dall'archivio). */
  msPerWordMedian?: number | null;
}

export interface History {
  sessions: number;
  clauses: ClauseHistory[];
  /** Da dove vengono i numeri: l'archivio del team o solo questo browser. */
  source: "archivio" | "locale";
}

/**
 * Storico per clausola sullo stesso documento. Se il modello appreso
 * dall'archivio conosce il documento, vale quello (è la storia di tutto il
 * team, calcolata prima di questa sessione); altrimenti lo storico locale,
 * escludendo la sessione corrente.
 */
export function historyFor(documentId: string, excludeSessionId: string, history = loadHistory(), model: LabModel | null = null): History {
  const archived = model?.documents.find((d) => d.documentId === documentId);
  if (archived && archived.sessions > 0) {
    return {
      source: "archivio",
      sessions: archived.sessions,
      clauses: archived.clauses.map((c) => ({
        clauseId: c.clauseId,
        sessions: c.readers,
        lostShare: c.lostShare,
        verifyWrongShare: c.verifyAccuracy === null ? 0 : 1 - c.verifyAccuracy,
        msPerWordMedian: c.msPerWordMedian,
      })),
    };
  }
  const mine = history.filter((r) => r.documentId === documentId && r.sessionId !== excludeSessionId);
  const ids = new Set(mine.flatMap((r) => r.clauses.map((c) => c.id)));
  const clauses = [...ids].map((id) => {
    const rows = mine.map((r) => r.clauses.find((c) => c.id === id)).filter(Boolean) as HistoryRecord["clauses"];
    return {
      clauseId: id,
      sessions: rows.length,
      lostShare: rows.length ? rows.filter((c) => c.level !== "verde").length / rows.length : 0,
      verifyWrongShare: rows.length ? rows.filter((c) => c.verifyWrong).length / rows.length : 0,
    };
  });
  return { source: "locale", sessions: mine.length, clauses };
}
