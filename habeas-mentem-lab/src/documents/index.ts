// Documenti modello.
//
// Tre documenti scritti come li scriverebbe uno studio serio nel 2026, con
// la normativa citata al posto giusto (GDPR e Codice privacy, Codice del
// consumo, codice civile, Linee guida del Garante sui cookie, Data Privacy
// Framework, Regolamento sull'IA) e con la densità che cambia da clausola a
// clausola come nei documenti reali. Le società sono di fantasia. Per
// misurare documenti pubblici veri si usa "Incolla un tuo testo".

import { splitIntoClauses, type Document } from "../session/model";
import { informativaNeurotech, informativaNeurotechQuestions, informativaNeurotechTasks } from "./informativa-neurotech";
import { termini, terminiQuestions, terminiTasks } from "./termini-piattaforma";
import { cookie, cookieQuestions, cookieTasks } from "./banner-cookie";

export const DOCUMENTS: Document[] = [
  {
    id: "informativa-neurotech",
    title: "Informativa privacy — dispositivo di neurofeedback (modello)",
    source: "modello",
    clauses: splitIntoClauses(informativaNeurotech),
    questions: informativaNeurotechQuestions,
    tasks: informativaNeurotechTasks,
  },
  {
    id: "termini-piattaforma",
    title: "Termini di servizio — piattaforma digitale (modello)",
    source: "modello",
    clauses: splitIntoClauses(termini),
    questions: terminiQuestions,
    tasks: terminiTasks,
  },
  {
    id: "banner-cookie",
    title: "Informativa cookie estesa (modello)",
    source: "modello",
    clauses: splitIntoClauses(cookie),
    questions: cookieQuestions,
    tasks: cookieTasks,
  },
];

export function documentFromPastedText(title: string, text: string): Document {
  return {
    id: `incollato-${Date.now()}`,
    title: title.trim() || "Testo incollato",
    source: "incollato",
    clauses: splitIntoClauses(text),
    questions: [],
    tasks: [],
  };
}
