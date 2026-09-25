// Documenti di prova.
//
// Sono testi scritti per il laboratorio sul modello delle informative reali
// (struttura dell'art. 13 GDPR, termini di servizio, banner cookie), con la
// densità e il lessico tipici dei documenti che il libro descrive. Non sono
// documenti di aziende esistenti. Per testare informative pubbliche vere si
// usa "Incolla un tuo testo" nella schermata iniziale.

import { splitIntoClauses, type Document } from "../session/model";
import { informativaNeurotech } from "./informativa-neurotech";
import { termini } from "./termini-piattaforma";
import { cookie } from "./banner-cookie";

export const DOCUMENTS: Document[] = [
  {
    id: "informativa-neurotech",
    title: "Informativa privacy — dispositivo di neurofeedback (modello)",
    source: "modello",
    clauses: splitIntoClauses(informativaNeurotech),
  },
  {
    id: "termini-piattaforma",
    title: "Termini di servizio — piattaforma digitale (modello)",
    source: "modello",
    clauses: splitIntoClauses(termini),
  },
  {
    id: "banner-cookie",
    title: "Informativa cookie estesa (modello)",
    source: "modello",
    clauses: splitIntoClauses(cookie),
  },
];

export function documentFromPastedText(title: string, text: string): Document {
  return {
    id: `incollato-${Date.now()}`,
    title: title.trim() || "Testo incollato",
    source: "incollato",
    clauses: splitIntoClauses(text),
  };
}
