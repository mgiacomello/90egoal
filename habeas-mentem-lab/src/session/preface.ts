// Le assunzioni della prefazione, alla prova.
//
// Luciano Floridi, nella prefazione a «Mente e Tecnologia» (Springer, 2026,
// pp. VII-X), formula alcune tesi che il laboratorio può mettere alla prova
// con i suoi sensori. Qui ogni tesi è citata alla lettera, tradotta in un
// indicatore misurabile, misurata su questa sessione e sull'archivio, e
// accompagnata da ciò che la smentirebbe (art. 6 della costituzione). È lo
// strumento concreto per validare, o correggere, quelle assunzioni.

import type { Friction } from "./friction";
import type { ClauseMetrics } from "./metrics";
import type { Document, Session } from "./model";
import type { LabModel } from "./learning";
import { BOOK_R } from "./calibrate";

export type AssumptionStatus = "sostenuta" | "non sostenuta" | "dati insufficienti" | "misura";

export interface Assumption {
  id: string;
  /** La frase della prefazione, alla lettera. */
  quote: string;
  source: string;
  /** La tesi in una riga, come la mette alla prova il laboratorio. */
  claim: string;
  /** L'indicatore: che cosa si misura e come si legge. */
  indicator: string;
  session: { value: string; detail: string } | null;
  population: { value: string; detail: string } | null;
  status: AssumptionStatus;
  verdict: string;
  falsifier: string;
}

/** Elementi che l'art. 13 GDPR pretende in un'informativa: presenti nel testo? */
export const FORMAL_ELEMENTS: [string, RegExp][] = [
  ["titolare", /\btitolare\b/i],
  ["finalità", /\bfinalit[àa](?![a-zà-ù])/i],
  ["base giuridica", /\bbas[ei] giuridic[ah]e?\b/i],
  ["destinatari", /\b(destinatari|comunichiamo|comunicat[oi] a|fornitori)\b/i],
  ["trasferimenti", /\b(trasferiment[oi]|paesi terzi|stati uniti|extra[- ]?ue)\b/i],
  ["conservazione", /\b(conservazione|conserviamo|per un periodo|mesi)\b/i],
  ["diritti", /\b(diritt[oi] di|accesso|rettifica|cancellazione|opporti|revocare)\b/i],
  ["reclamo", /\b(reclamo|garante|autorit[àa] di controllo)\b/i],
];

const pct = (x: number) => `${Math.round(x * 100)}%`;
const frac = (c: number, a: number) => `${c}/${a}`;

function accuracy(session: Session, themes: string[]): { asked: number; correct: number } {
  const rows = session.answers.filter((a) => a.theme && themes.includes(a.theme));
  return { asked: rows.length, correct: rows.filter((a) => a.correct).length };
}

export function prefaceAssumptions(input: {
  doc: Document;
  session: Session;
  metrics: ClauseMetrics[];
  friction: Friction[];
  model: LabModel | null;
}): Assumption[] {
  const { doc, session, metrics, friction, model } = input;
  const out: Assumption[] = [];
  const themed = (t: string) => model?.themes.find((x) => x.theme === t) ?? null;
  const hasTheme = (t: string) => doc.questions.some((q) => q.theme === t);

  // ── 1. Parole e inferenze ────────────────────────────────────────────────
  {
    const inf = accuracy(session, ["inferenza"]);
    const other = accuracy(session, ["cessione", "diritti", "durata", "base"]);
    const pInf = themed("inferenza");
    const pOther = (model?.themes ?? []).filter((t) => t.theme !== "inferenza" && t.theme !== "altro");
    const pOtherAsked = pOther.reduce((s, t) => s + t.asked, 0);
    const pOtherCorrect = pOther.reduce((s, t) => s + t.correct, 0);
    let status: AssumptionStatus = "dati insufficienti";
    let verdict = hasTheme("inferenza")
      ? "Servono almeno 10 risposte sulle inferenze in archivio per un confronto."
      : "Questo documento non ha domande sul tema «inferenza»: la tesi non è misurabile qui.";
    if (pInf && pInf.asked >= 10 && pOtherAsked >= 10) {
      const gap = pOtherCorrect / pOtherAsked - pInf.accuracy;
      if (pInf.accuracy < 0.7 && gap >= 0.1) {
        status = "sostenuta";
        verdict = `Sulle inferenze i lettori rispondono bene nel ${pct(pInf.accuracy)} dei casi, contro il ${pct(pOtherCorrect / pOtherAsked)} sugli altri temi: ciò che il segnale permette di ricavare resta fuori da ciò che il lettore ha capito di cedere.`;
      } else if (pInf.accuracy >= 0.7 && gap < 0.1) {
        status = "non sostenuta";
        verdict = `Sulle inferenze i lettori rispondono bene nel ${pct(pInf.accuracy)} dei casi, non peggio degli altri temi (${pct(pOtherCorrect / pOtherAsked)}): su questo documento la distanza tra parole e inferenze è colmata.`;
      } else {
        status = "misura";
        verdict = `Inferenze ${pct(pInf.accuracy)}, altri temi ${pct(pOtherCorrect / pOtherAsked)}: differenza sotto i dieci punti o accuratezza intermedia, il dato non decide.`;
      }
    }
    out.push({
      id: "inferenze",
      quote: "Il consenso si dà sulle parole di un documento, non sulle inferenze che il segnale rende possibili. […] Fra ciò che l'utente accetta di cedere e lo stato cognitivo che se ne desume corre una distanza che nessuna informativa tradizionale colma. Il consenso copre il primo ma non il secondo.",
      source: "Floridi, Prefazione, pp. VIII",
      claim: "Chi legge capisce i tempi, i diritti e le basi giuridiche più di quanto capisca che cosa verrà ricavato dai suoi segnali.",
      indicator: "Accuratezza delle domande di verifica sul tema «inferenza» (che cosa il titolare ricava dai dati) rispetto agli altri temi (cessione, diritti, durata, base). La tesi è sostenuta se le inferenze restano sotto il 70% e almeno dieci punti sotto il resto.",
      session: inf.asked ? { value: `${frac(inf.correct, inf.asked)} inferenze`, detail: `altri temi ${frac(other.correct, other.asked)}` } : null,
      population: pInf ? { value: `${pct(pInf.accuracy)} inferenze (${pInf.asked} risposte)`, detail: pOtherAsked ? `altri temi ${pct(pOtherCorrect / pOtherAsked)} (${pOtherAsked} risposte)` : "altri temi: nessuna risposta" } : null,
      status,
      verdict,
      falsifier: "Con almeno 30 lettori, accuratezza sulle inferenze pari o superiore agli altri temi: la distanza non esiste, o questa informativa l'ha colmata.",
    });
  }

  // ── 2. Correttezza formale e sostanza ────────────────────────────────────
  {
    const text = doc.clauses.map((c) => c.text).join("\n");
    const present = FORMAL_ELEMENTS.filter(([, re]) => re.test(text));
    const substance = accuracy(session, ["cessione", "inferenza"]);
    const sessionOk = substance.asked > 0 && substance.correct === substance.asked;
    const pC = themed("cessione");
    const pI = themed("inferenza");
    const pAsked = (pC?.asked ?? 0) + (pI?.asked ?? 0);
    const pCorrect = (pC?.correct ?? 0) + (pI?.correct ?? 0);
    let status: AssumptionStatus = "dati insufficienti";
    let verdict = "Servono almeno 10 risposte su cessione e inferenze in archivio.";
    if (pAsked >= 10) {
      const acc = pCorrect / pAsked;
      if (present.length >= 6 && acc < 0.7) {
        status = "sostenuta";
        verdict = `Il documento è formalmente completo (${present.length}/${FORMAL_ELEMENTS.length} elementi dell'art. 13), ma su che cosa viene ceduto e ricavato i lettori rispondono bene solo nel ${pct(acc)} dei casi: la correttezza formale non produce la sostanza.`;
      } else if (acc >= 0.7) {
        status = "non sostenuta";
        verdict = `Su che cosa viene ceduto e ricavato i lettori rispondono bene nel ${pct(acc)} dei casi: qui forma e sostanza coincidono.`;
      } else {
        status = "misura";
        verdict = `Documento con ${present.length}/${FORMAL_ELEMENTS.length} elementi formali e sostanza al ${pct(acc)}: forma incompleta e sostanza debole insieme, la tesi non è isolabile.`;
      }
    }
    out.push({
      id: "sostanza",
      quote: "Progettare un'informativa sui dati neurali che un utente non specialista non è in grado di capire è un modo per prendersi ciò che non è stato dato, e la correttezza formale del documento non cambia la sostanza.",
      source: "Floridi, Prefazione, p. X",
      claim: "Un documento può contenere tutto ciò che la legge chiede e non trasferire al lettore che cosa sta cedendo.",
      indicator: `Forma: elementi dell'art. 13 GDPR presenti nel testo (${FORMAL_ELEMENTS.map(([n]) => n).join(", ")}). Sostanza: quota di risposte esatte sui temi «cessione» e «inferenza». La tesi è sostenuta se la forma è quasi completa e la sostanza resta sotto il 70%.`,
      session: { value: `forma ${present.length}/${FORMAL_ELEMENTS.length}`, detail: substance.asked ? `sostanza ${frac(substance.correct, substance.asked)}${sessionOk ? ": questo lettore sa che cosa cede" : ""}` : "sostanza: nessuna domanda su cessione o inferenze" },
      population: pAsked ? { value: `sostanza ${pct(pCorrect / pAsked)}`, detail: `${pAsked} risposte su cessione e inferenze` } : null,
      status,
      verdict,
      falsifier: "Documenti formalmente completi in cui, con almeno 30 lettori, la sostanza supera stabilmente il 70%: la forma basterebbe.",
    });
  }

  // ── 3. Il costo di leggere ───────────────────────────────────────────────
  {
    const words = doc.clauses.reduce((s, c) => s + c.wordCount, 0);
    const totalMs = metrics.reduce((s, m) => s + m.dwellMs, 0);
    const plausibleMs = metrics.reduce((s, m) => s + m.plausibleReadMs, 0);
    const skipped = metrics.filter((m) => m.tooFastToRead).length;
    const popDoc = model?.documents.find((d) => d.documentId === doc.id);
    const popMedianMs = popDoc ? popDoc.clauses.reduce((s, c) => s + c.dwellMedianMs, 0) : null;
    const popSkipped = popDoc ? popDoc.clauses.filter((c) => c.tooFastShare >= 0.5).length : 0;
    const read = totalMs >= plausibleMs * 0.8 && skipped === 0;
    out.push({
      id: "costo",
      quote: "Uno o due potenziali acquirenti su mille aprono il testo del contratto di licenza. Nella stima del 2008 di McDonald e Cranor, leggere tutte le policy che si incontrano in un anno richiederebbe 244 ore.",
      source: "Floridi, Prefazione, pp. IX-X (Bakos et al. 2014; McDonald e Cranor 2008)",
      claim: "Leggere davvero costa più di quanto una persona è disposta a spendere, e la lettura che avviene è una scorsa.",
      indicator: "Tempo speso sul documento contro il tempo plausibile per leggerlo tutto a 250 parole al minuto; clausole scorse oltre 600 parole al minuto. Nell'archivio, tempo mediano dei lettori e clausole scorse dalla metà di loro.",
      session: { value: `${Math.round(totalMs / 60000)} min su ${Math.round(plausibleMs / 60000)} plausibili`, detail: `${words} parole · ${skipped} ${skipped === 1 ? "clausola scorsa" : "clausole scorse"}${read ? " · letto per intero" : ""}` },
      population: popDoc && popMedianMs !== null ? { value: `${Math.round(popMedianMs / 60000)} min mediani`, detail: `${popDoc.sessions} lettori · ${popSkipped} clausole scorse dalla metà dei lettori` } : null,
      status: "misura",
      verdict: read
        ? "Questo lettore ha letto per intero: il costo è stato pagato, e va detto quanto è costato."
        : `Questo lettore ha speso ${Math.round((totalMs / Math.max(1, plausibleMs)) * 100)}% del tempo plausibile: la lettura è stata, almeno in parte, una scorsa.`,
      falsifier: "Non è una tesi da smentire ma un costo da mostrare: il laboratorio lo misura in minuti reali, documento per documento.",
    });
  }

  // ── 4. Il segnale è un correlato ─────────────────────────────────────────
  {
    const bodyOnly = friction.filter((f) => f.indicators.body && !f.indicators.verify && !f.indicators.operate).length;
    const bodyAndFail = friction.filter((f) => f.indicators.body && (f.indicators.verify || f.indicators.operate)).length;
    const withBody = friction.filter((f) => f.indicators.body).length;
    const b = model?.body ?? null;
    let status: AssumptionStatus = "dati insufficienti";
    let verdict = "Servono almeno 30 lettori con segnale e 12 clausole per stimare quanto il corpo, da solo, predica la comprensione.";
    if (b && b.readers >= 30 && b.clauses >= 12 && b.r !== null) {
      if (b.r > -0.3) {
        status = "sostenuta";
        verdict = `Sforzo e comprensione correlano r ${b.r.toFixed(2)} su ${b.clauses} clausole: il corpo dice dove lo sforzo cresce, non se il testo è stato capito. La regola del laboratorio, «il corpo da solo non colora mai», regge.`;
      } else {
        status = "non sostenuta";
        verdict = `Sforzo e comprensione correlano r ${b.r.toFixed(2)} su ${b.clauses} clausole: qui il corpo predice la comprensione più di quanto la prefazione conceda. Da replicare prima di cambiare la regola.`;
      }
    }
    out.push({
      id: "correlato",
      quote: "Un sistema BCI registra l'attività cerebrale, elettrica, magnetica o emodinamica, la decodifica con modelli statistici e restituisce un output: quell'attività è al più un correlato dello stato mentale. […] La mente esce ancora opaca da quel laboratorio.",
      source: "Floridi, Prefazione, p. VIII",
      claim: "Lo sforzo misurato dalla fascia non dice se il lettore ha capito: è un correlato, da leggere solo insieme agli altri sensori.",
      indicator: "Correlazione, nell'archivio, tra sforzo medio per clausola e comprensione misurata (verifica, prova, tempo). In sessione: quante clausole col corpo acceso hanno anche una verifica o prova fallita. La tesi è sostenuta se |r| resta sotto 0,30.",
      session: withBody ? { value: `${bodyAndFail}/${withBody} clausole`, detail: `corpo acceso e verifica o prova fallita; ${bodyOnly} col solo corpo (mai colorate da sole)` } : { value: "senza fascia", detail: "nessun indizio corporeo in questa sessione" },
      population: b && b.clauses > 0 ? { value: b.r === null ? "r non calcolabile" : `r ${b.r.toFixed(2)}`, detail: `${b.clauses} clausole · ${b.readers} lettori con segnale` } : null,
      status,
      verdict,
      falsifier: "r sotto -0,50 con almeno 30 lettori e 12 clausole, replicato su un secondo documento: il corpo predirebbe la comprensione, e la regola andrebbe rivista.",
    });
  }

  // ── 5. Guardare all'inferenza, non al sensore ────────────────────────────
  {
    const by = { verify: 0, operate: 0, time: 0, text: 0, body: 0 };
    for (const f of friction) for (const k of Object.keys(by) as (keyof typeof by)[]) if (f.indicators[k]) by[k]++;
    const coloured = friction.filter((f) => f.level !== "verde").length;
    const decidedByBehaviour = friction.filter((f) => f.level !== "verde" && (f.indicators.verify || f.indicators.operate || f.indicators.time)).length;
    out.push({
      id: "inferenza-regolatore",
      quote: "Nelle BCI, il regolatore deve guardare all'inferenza: il sensore spiega perché la posta è alta, non dove è preferibile intervenire.",
      source: "Floridi, Prefazione, p. VIII",
      claim: "Dove intervenire lo dicono le prove di comprensione e il comportamento; il sensore alza la posta, non decide la mappa.",
      indicator: "Da quali sensori vengono i colori della mappa: verifica, prova operativa e tempo contro il corpo. Per costruzione il corpo da solo non colora; qui si conta quanto pesa davvero.",
      session: { value: `${decidedByBehaviour}/${coloured || 0} clausole colorate`, detail: `decise da verifica, prova o tempo · indizi: verifica ${by.verify}, prova ${by.operate}, tempo ${by.time}, testo ${by.text}, corpo ${by.body}` },
      population: null,
      status: "misura",
      verdict: coloured
        ? `Ogni clausola colorata ha almeno un indizio di comportamento o comprensione; il corpo ha aggiunto un indizio in ${by.body} ${by.body === 1 ? "clausola" : "clausole"}, mai da solo.`
        : "Nessuna clausola colorata in questa sessione.",
      falsifier: "Se la mappa cambiasse colore per il solo corpo, il laboratorio starebbe guardando il sensore, non l'inferenza: la regola lo vieta e i test lo verificano.",
    });
  }

  // ── 6. Tarato su misure dello stesso tipo ────────────────────────────────
  {
    const lx = model?.lx ?? null;
    let status: AssumptionStatus = "dati insufficienti";
    let verdict = "Servono almeno 5 lettori e 6 clausole con verifica o prova per la prima stima; il libro ne usa 18 documenti e un centinaio di lettori.";
    const r = lx?.r ?? lx?.defaultR ?? null;
    if (lx && r !== null && lx.sessions >= 5 && lx.clauses >= 6) {
      if (r <= -0.5) {
        status = "sostenuta";
        verdict = `Sul team, LX e comprensione correlano r ${r.toFixed(2)} (libro: ${BOOK_R.calibration} in calibrazione, ${BOOK_R.validation} in validazione): la taratura regge fuori dal laboratorio d'origine.`;
      } else if (r > -0.3 && lx.sessions >= 30) {
        status = "non sostenuta";
        verdict = `Sul team, LX e comprensione correlano r ${r.toFixed(2)} con ${lx.sessions} lettori: lontano dal libro. Il metodo dichiara che questo lo smentisce.`;
      } else {
        status = "misura";
        verdict = `r ${r.toFixed(2)} su ${lx.sessions} lettori e ${lx.clauses} clausole: dato ancora esplorativo.`;
      }
    }
    out.push({
      id: "taratura",
      quote: "Giacomello scrive di aver tarato, in uno studio che lui stesso definisce esplorativo, il suo indice di frizione cognitiva sulla base di misurazioni EEG del carico cognitivo in tempo reale: la comprensibilità dei contratti sulle interfacce, valutata con una tecnologia dello stesso tipo. È lì che i due versanti del libro si toccano.",
      source: "Floridi, Prefazione, p. X",
      claim: "La correlazione tra LX e comprensione misurata deve replicarsi su lettori nuovi, non solo sul corpus del libro.",
      indicator: `Correlazione tra LX e comprensione misurata sull'archivio del team (r; libro ${BOOK_R.calibration} e ${BOOK_R.validation}). Il modello la ricalcola da solo a ogni sessione nuova.`,
      session: null,
      population: lx && r !== null ? { value: `r ${r.toFixed(2)}`, detail: `${lx.sessions} lettori · ${lx.clauses} clausole · pesi ${lx.source === "appreso" ? "ricalibrati" : "del libro"}` } : null,
      status,
      verdict,
      falsifier: "Con almeno 30 lettori e 6 documenti, r sopra -0,30: la taratura non si replica.",
    });
  }

  return out;
}
