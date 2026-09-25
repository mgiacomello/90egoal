// La mappa della frizione: verde, giallo, rosso per clausola.
//
// Regola del libro: nessun sensore dimostra da solo la comprensione; la
// conoscenza nasce quando indizi indipendenti puntano nella stessa
// direzione. Qui ogni sensore alza al massimo un indizio per clausola e il
// colore dipende da quanti indizi indipendenti coincidono:
//
//   rosso   ≥ 3 indizi, di cui almeno uno da verifica o prova operativa
//   giallo  2 indizi, oppure 1 indizio da verifica o prova operativa
//   verde   altrimenti (nessun indizio, o un solo indizio "debole")
//
// Il corpo da solo non colora mai. Il tempo, da solo, dice solo che cosa
// non può essere stato letto. Il testo, da solo, è una diagnosi del
// documento, non della lettura.

import type { ClauseMetrics } from "./metrics";
import { LX_ACCESSIBILITY_THRESHOLD } from "./lx";

export type FrictionLevel = "verde" | "giallo" | "rosso";

export interface FrictionIndicators {
  /** Tempo: troppo veloce per averla letta, oppure ritorni indietro ripetuti. */
  time: boolean;
  /** Corpo: sforzo medio nel terzo più alto della sessione (solo se ci sono campioni). */
  body: boolean;
  /** Testo: LX sopra la soglia sperimentale di accessibilità. */
  text: boolean;
  /** Verifica: almeno una domanda su questa clausola sbagliata. */
  verify: boolean;
  /** Prova operativa: almeno un compito che cercava questa clausola fallito. */
  operate: boolean;
}

export interface Friction {
  clauseId: string;
  level: FrictionLevel;
  indicators: FrictionIndicators;
  /** Numero di indizi indipendenti che convergono. */
  count: number;
  /** Spiegazione breve, per la tabella e per il fascicolo. */
  reasons: string[];
}

export function frictionMap(metrics: ClauseMetrics[]): Friction[] {
  // Terzo più alto dello sforzo medio, calcolato solo sulle clausole con segnale.
  const efforts = metrics.filter((m) => m.effort.sampleCount > 0).map((m) => m.effort.mean).sort((a, b) => a - b);
  const bodyThreshold = efforts.length >= 3 ? efforts[Math.floor((efforts.length * 2) / 3)] : Infinity;

  return metrics.map((m) => {
    const indicators: FrictionIndicators = {
      time: m.tooFastToRead || m.returns >= 2,
      body: m.effort.sampleCount > 0 && efforts.length >= 3 && m.effort.mean >= bodyThreshold && m.effort.mean > 0,
      text: m.lx.total > LX_ACCESSIBILITY_THRESHOLD,
      verify: m.verification.asked > 0 && m.verification.correct < m.verification.asked,
      operate: m.operational.asked > 0 && m.operational.correct < m.operational.asked,
    };
    const reasons: string[] = [];
    if (m.tooFastToRead) reasons.push("tempo incompatibile con la lettura");
    else if (m.returns >= 2) reasons.push(`${m.returns} ritorni indietro`);
    if (indicators.body) reasons.push("sforzo nel terzo più alto della sessione");
    if (indicators.text) reasons.push(`LX ${m.lx.total} sopra la soglia`);
    if (indicators.verify) reasons.push(`verifica: ${m.verification.correct}/${m.verification.asked} corrette`);
    if (indicators.operate) reasons.push(`prova operativa: ${m.operational.correct}/${m.operational.asked} riuscite`);

    const count = Object.values(indicators).filter(Boolean).length;
    const strong = indicators.verify || indicators.operate;
    let level: FrictionLevel = "verde";
    if (count >= 3 && strong) level = "rosso";
    else if (count >= 2 || strong) level = "giallo";
    return { clauseId: m.clauseId, level, indicators, count, reasons };
  });
}
