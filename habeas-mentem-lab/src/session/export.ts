// Esportazione: tutto resta nel browser finché l'utente non scarica.

import type { ClauseMetrics } from "./metrics";
import type { Clause, Session } from "./model";

function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const cols = Object.keys(rows[0]);
  const lines = [cols.join(",")];
  for (const r of rows) lines.push(cols.map((c) => csvEscape(r[c])).join(","));
  return lines.join("\n") + "\n";
}

/** Un record per frame: il dataset grezzo, annotato con fase e clausola. */
export function framesCsv(session: Session): string {
  return toCsv(
    session.frames.map((a) => ({
      session: session.id,
      participant: session.participant,
      timestamp_ms: a.frame.timestamp,
      phase: a.phase,
      clause: a.clauseId ?? "",
      ir_l: a.frame.irLeft, red_l: a.frame.redLeft, amb_l: a.frame.ambLeft,
      ir_r: a.frame.irRight, red_r: a.frame.redRight, amb_r: a.frame.ambRight,
      ir_p: a.frame.irPulse, red_p: a.frame.redPulse, amb_p: a.frame.ambPulse,
      acc_x: a.frame.accX, acc_y: a.frame.accY, acc_z: a.frame.accZ,
      ang_x: a.frame.angX, ang_y: a.frame.angY, ang_z: a.frame.angZ,
      temp_c: a.frame.temperature.toFixed(2),
      effort_left: a.effort ? a.effort.left.toFixed(5) : "",
      effort_right: a.effort ? a.effort.right.toFixed(5) : "",
      effort: a.effort ? a.effort.effort.toFixed(5) : "",
      motion_g: a.effort ? a.effort.motion.toFixed(3) : "",
    })),
  );
}

/** Un record per clausola: la tabella da cui partirà la mappa della frizione. */
export function clausesCsv(session: Session, metrics: ClauseMetrics[]): string {
  return toCsv(
    metrics.map((m) => ({
      session: session.id,
      participant: session.participant,
      document: session.documentTitle,
      clause: m.clauseId,
      index: m.index,
      heading: m.heading ?? "",
      words: m.wordCount,
      dwell_ms: m.dwellMs,
      visits: m.visits,
      returns: m.returns,
      wpm: m.wordsPerMinute === null ? "" : m.wordsPerMinute.toFixed(0),
      too_fast_to_read: m.tooFastToRead,
      effort_mean: m.effort.mean.toFixed(5),
      effort_peak: m.effort.peak.toFixed(5),
      effort_samples: m.effort.sampleCount,
      motion_artifact_ratio: m.effort.motionArtifactRatio.toFixed(3),
      lx_total: m.lx.total,
      lx_linguistic: m.lx.linguistic,
      lx_conceptual: m.lx.conceptual,
      lx_structural: m.lx.structural,
      lx_semantic: m.lx.semantic,
    })),
  );
}

export function sessionJson(session: Session, clauses: Clause[], metrics: ClauseMetrics[]): string {
  return JSON.stringify(
    {
      schema: "habeas-mentem-lab/session/v1",
      exportedAt: new Date().toISOString(),
      session: { ...session, frames: undefined },
      clauses,
      metrics,
      frameCount: session.frames.length,
      note:
        "L'indice di sforzo è un proxy relativo alla baseline della stessa sessione. " +
        "L'LX score è una stima euristica di superficie, non il modello NLC calibrato. " +
        "Nessuno dei due misura la comprensione. Vanno letti solo in convergenza con gli altri sensori.",
    },
    null,
    2,
  );
}

export function download(filename: string, content: string, type = "text/plain"): void {
  const blob = new Blob([content], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
