// Il fascicolo di comprensibilità.
//
// Dal libro: «Oggi quella prova è un log. La casella era spuntata, il tasto
// è stato premuto. Domani può essere un fascicolo. Il documento aveva un
// punteggio di complessità misurato e ridotto, il flusso è stato testato su
// lettori reali, la clausola critica è stata vista, il tempo era compatibile
// con la lettura.» E dal Cantiere: «Misure, dichiarazioni e test finiscono
// nel fascicolo, con la data, prima di ogni contestazione.»
//
// Questo modulo produce il PDF di una sessione: sintesi, metodo dichiarato
// (art. 4: il metodo è pubblico), tabella per clausola con la mappa della
// frizione, risposte e compiti, la costituzione applicata, lo spazio per il
// nome di chi risponde del documento e l'impronta dei dati esportati.

import { jsPDF } from "jspdf";
import autoTable, { type CellHookData } from "jspdf-autotable";
import { LX_ACCESSIBILITY_THRESHOLD } from "./lx";
import type { Friction } from "./friction";
import type { ClauseMetrics } from "./metrics";
import type { Document, Session } from "./model";
import { AGGREGATE_THRESHOLDS, type Aggregate } from "./aggregate";
import { BOOK_R, describeWeights, type Calibration } from "./calibrate";
import { highestEffortSegments, slowestSegments, type SegmentMetrics } from "./segments";
import { HRF_DESCRIPTION } from "./hrf";
import { HEAT, INK, INK_2, MUTED, PAGE, Page, safe } from "./report";

export interface DossierInput {
  session: Session;
  doc: Document;
  metrics: ClauseMetrics[];
  friction: Friction[];
  /** JSON della sessione già serializzato: l'impronta lo lega al fascicolo. */
  sessionJson: string;
  /** Nome di chi risponde del documento ("il nome sul cartello"). Facoltativo. */
  responsible?: string;
  /** Metriche parola per parola (solo nei modi a porzioni). */
  segments?: SegmentMetrics[];
  /** Varianza spiegata dal modello HRF sulle porzioni. */
  modelR2?: number | null;
}

/** SHA-256 esadecimale, con WebCrypto; in ambienti senza crypto ritorna null. */
export async function fingerprint(text: string): Promise<string | null> {
  try {
    const bytes = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return null;
  }
}

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleString("it-IT", { dateStyle: "long", timeStyle: "short" });
}

function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)} s`;
}

/** Le frasi di sintesi che il fascicolo dichiara: ciò che i dati mostrano, ciò che non mostrano. */
export function dossierSummary(input: DossierInput): string[] {
  const { session, doc, metrics, friction } = input;
  const totalMs = metrics.reduce((s, m) => s + m.dwellMs, 0);
  const tooFast = metrics.filter((m) => m.tooFastToRead).length;
  const overLx = metrics.filter((m) => m.lx.total > LX_ACCESSIBILITY_THRESHOLD).length;
  const lxMean = Math.round(metrics.reduce((s, m) => s + m.lx.total, 0) / Math.max(metrics.length, 1));
  const red = friction.filter((f) => f.level === "rosso").length;
  const yellow = friction.filter((f) => f.level === "giallo").length;
  const lines = [
    `Documento di ${doc.clauses.length} clausole, ${doc.clauses.reduce((s, c) => s + c.wordCount, 0)} parole. Lettura totale ${seconds(totalMs)}.`,
    `Tempo: ${tooFast} clausole su ${metrics.length} viste per un tempo incompatibile con la lettura completa (oltre 600 parole al minuto).`,
    `Testo: LX Complexity Score medio ${lxMean}/100; ${overLx} clausole sopra la soglia sperimentale di accessibilità (${LX_ACCESSIBILITY_THRESHOLD}).`,
  ];
  if (session.answers.length > 0) {
    const ok = session.answers.filter((a) => a.correct).length;
    lines.push(`Verifica: ${ok} risposte corrette su ${session.answers.length}.`);
  }
  if (session.tasks.length > 0) {
    const ok = session.tasks.filter((t) => t.correct).length;
    lines.push(`Prova operativa: ${ok} compiti riusciti su ${session.tasks.length}.`);
  }
  if (session.device) {
    const withSignal = metrics.filter((m) => m.effort.sampleCount > 0).length;
    lines.push(
      `Corpo: ${session.device.name}${session.device.simulated ? " (fascia simulata: segnale non reale)" : ""}, ${session.frames.length} campioni, segnale su ${withSignal} clausole.`,
    );
  } else {
    lines.push("Corpo: nessuna fascia collegata (il partecipante ha letto senza essere misurato).");
  }
  lines.push(`Frizione per convergenza: ${red} clausole rosse, ${yellow} gialle, ${friction.length - red - yellow} verdi.`);
  return lines;
}

const METHOD: string[] = [
  "Tempo: millisecondi per clausola, visite e ritorni; parole al minuto; sopra 600 wpm il tempo esclude la lettura completa.",
  "Corpo (se presente): fascia Mendi, ~25 Hz; baseline a riposo di 30 s; ΔOD per lunghezza d'onda rispetto alla baseline e inversione a due lunghezze d'onda (Beer-Lambert modificata, coefficienti di estinzione HbO/HbR a 660 e 850 nm, L·DPF = 18 cm): indice di sforzo = ΔHbO in µM stimati, media dei canali frontali, filtrato 0,01–0,5 Hz con regressione del canale corto (pulse) per la circolazione superficiale; artefatti = rotazione > 12°/s (giroscopio) o accelerazione oltre 0,15 g da 1 g, esclusi dal modello. Battito e variabilità dal canale pulse sono un indicatore sistemico, riportato a parte e mai usato nella mappa.",
  `Testo: stima euristica dell'LX Complexity Score (0-100) su quattro strade: lingua, affollamento, ordine, distanza semantica; calibrata sui valori del corpus BCI (Giacomello, Springer 2026); soglia ${LX_ACCESSIBILITY_THRESHOLD}.`,
  "Verifica: domande a risposta chiusa dopo la lettura, senza rileggere. Prova operativa: ritrovare la clausola che serve, con il documento riapribile.",
  "Convergenza: ogni sensore alza al massimo un indizio per clausola. Rosso con almeno tre indizi di cui uno da verifica o prova; giallo con due, o con una sola verifica o prova fallita; verde altrimenti. Il corpo da solo non colora mai.",
  "Limiti dichiarati: dati esplorativi di una sola sessione; l'LX è una stima di superficie, non il modello calibrato su EEG/fNIRS; il segnale della fascia è un indizio, non una lettura della mente; nessuna colonna, da sola, dice se una clausola è stata compresa.",
];

const CONSTITUTION: string[] = [
  "1. Una sola finalità: migliorare la comprensibilità del documento e provarne l'adeguatezza. Nessun uso secondario.",
  "2. Si misurano i documenti, mai le persone: nessun esito individuale fonda valutazioni sulla persona misurata.",
  "3. Il sensore meno invasivo, i dati minimi: pseudonimo casuale, nessuna rete, strumenti neurofisiologici solo in laboratorio con consenso pieno.",
  "4. Il metodo è pubblico: indicatori, formule e soglie sono dichiarati; ogni punteggio è ricalcolabile dai dati esportati.",
  "5. Nessuno è obbligato a essere misurato: partecipazione volontaria e revocabile, senza conseguenze.",
  "6. Chi misura accetta di essere misurato: il metodo dichiara in anticipo i propri limiti e i risultati che lo smentirebbero.",
];

const margin = 18;
const TABLE_STYLE = {
  margin: { left: margin, right: margin },
  theme: "grid" as const,
  styles: { font: "helvetica" as const, fontSize: 7, cellPadding: 1.4, overflow: "linebreak" as const, lineColor: [150, 147, 140] as [number, number, number], lineWidth: 0.1, textColor: [20, 19, 15] as [number, number, number] },
  headStyles: { fillColor: [243, 241, 234] as [number, number, number], textColor: [20, 19, 15] as [number, number, number], fontStyle: "bold" as const, lineColor: [20, 19, 15] as [number, number, number], lineWidth: 0.2 },
  alternateRowStyles: { fillColor: [255, 255, 255] as [number, number, number] },
};

const frictionColor = (levelColumn: number) => (data: CellHookData) => {
  if (data.section === "body" && data.column.index === levelColumn) {
    const v = String(data.cell.raw);
    data.cell.styles.fontStyle = "bold";
    data.cell.styles.textColor = v === "rosso" ? [154, 35, 35] : v === "giallo" ? [122, 83, 0] : [10, 109, 10];
  }
};

/** Lo scrittore di pagina: titoli, paragrafi, elenchi, con il cambio pagina. */
function writer(pdf: jsPDF) {
  const textWidth = pdf.internal.pageSize.getWidth() - margin * 2;
  const state = { y: margin };
  const heading = (text: string, size = 13) => {
    if (state.y > 260) {
      pdf.addPage();
      state.y = margin;
    }
    pdf.setFont("helvetica", "bold").setFontSize(size);
    pdf.text(text, margin, state.y);
    state.y += size * 0.6;
  };
  const paragraph = (text: string, size = 9.5, gap = 2) => {
    pdf.setFont("helvetica", "normal").setFontSize(size);
    const lines = pdf.splitTextToSize(text, textWidth) as string[];
    for (const line of lines) {
      if (state.y > 280) {
        pdf.addPage();
        state.y = margin;
      }
      pdf.text(line, margin, state.y);
      state.y += size * 0.5;
    }
    state.y += gap;
  };
  const bullets = (items: string[], size = 9) => {
    for (const item of items) paragraph(`• ${item}`, size, 1);
    state.y += 2;
  };
  const title = (text: string) => {
    pdf.setFont("helvetica", "bold").setFontSize(18);
    pdf.text(text, margin, state.y);
    state.y += 8;
  };
  const afterTable = () => {
    state.y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  };
  const frictionColor = (levelColumn: number) => (data: CellHookData) => {
    if (data.section === "body" && data.column.index === levelColumn) {
      const v = String(data.cell.raw);
      data.cell.styles.fontStyle = "bold";
      data.cell.styles.textColor = v === "rosso" ? [179, 38, 30] : v === "giallo" ? [160, 120, 0] : [46, 125, 79];
    }
  };
  const closing = async (pdf: jsPDF, json: string, responsible: string | undefined, para: typeof paragraph, head: typeof heading) => {
    head("Chi risponde di questo documento");
    para(
      responsible?.trim()
        ? `Responsabile del documento: ${responsible.trim()}`
        : "Responsabile del documento: ______________________________  (il nome sul cartello del cantiere)",
      9.5,
      2,
    );
    para("Data e firma: ______________________________", 9.5, 4);
    head("Impronta dei dati", 11);
    const hash = await fingerprint(json);
    para(
      hash
        ? `SHA-256 dei dati esportati: ${hash}. Chi possiede i dati può ricalcolare ogni numero di questo fascicolo.`
        : "Impronta non disponibile in questo ambiente. I dati esportati permettono comunque di ricalcolare ogni numero.",
      8,
      2,
    );
    para(`Generato ${fmtDate(Date.now())} da Habeas Mentem Lab (prototipo interno, non commerciale). Si misurano i documenti, mai le persone.`, 8, 0);
    void pdf;
  };
  return { state, heading, paragraph, bullets, title, afterTable, frictionColor, closing };
}

function readingModeLabel(session: Session): string {
  const r = session.reading;
  if (!r || r.mode === "clausola") return "clausola intera";
  if (r.mode === "porzioni") return "a porzioni, al ritmo del lettore";
  return `a porzioni, a scorrimento (${r.wordsPerMinute ?? "?"} parole al minuto)`;
}

export async function buildDossier(input: DossierInput): Promise<Blob> {
  const { session, doc, metrics, friction } = input;
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const pg = new Page(pdf);
  const byId = new Map(friction.map((f) => [f.clauseId, f]));
  const hasVerify = session.answers.length > 0;
  const hasOperate = session.tasks.length > 0;
  const hasBody = metrics.some((m) => m.effort.sampleCount > 0);
  const segs = input.segments ?? [];
  const totalMs = metrics.reduce((s, m) => s + m.dwellMs, 0);
  const words = doc.clauses.reduce((s, c) => s + c.wordCount, 0);
  const red = friction.filter((f) => f.level === "rosso").length;
  const yellow = friction.filter((f) => f.level === "giallo").length;
  const lxMean = Math.round(metrics.reduce((s, m) => s + m.lx.total, 0) / Math.max(1, metrics.length));
  const overLx = metrics.filter((m) => m.lx.total > LX_ACCESSIBILITY_THRESHOLD).length;
  const tooFast = metrics.filter((m) => m.tooFastToRead).length;
  const rank = { rosso: 2, giallo: 1, verde: 0 } as const;
  const worst = [...friction].sort((a, b) => rank[b.level] - rank[a.level] || b.count - a.count)[0];
  const worstM = worst ? metrics.find((m) => m.clauseId === worst.clauseId) : undefined;
  const clean = (h: string | null) => (h ? h.replace(/^\d+[.)]\s*/, "") : null);
  const nameOf = (m: ClauseMetrics) => clean(m.heading) ?? `clausola ${m.index}`;
  const vOk = session.answers.filter((a) => a.correct).length;
  const oOk = session.tasks.filter((t) => t.correct).length;
  const modeLabel = readingModeLabel(session);

  // ── 1. Copertina ─────────────────────────────────────────────────────────
  pg.frame();
  pg.smallcaps("Habeas Mentem Lab · Fascicolo di comprensibilità", PAGE.w / 2, pg.y, 7, INK_2, "center");
  pg.gap(16);
  pg.title(doc.title.replace(" (modello)", ""), 24);
  pg.gap(2);
  pg.p(`Sessione di lettura misurata: tempo, corpo, testo, verifica e prova operativa su ${doc.clauses.length} clausole, ${words} parole.`, 11, INK_2, 8);
  pg.meta([
    ["Sessione", session.id],
    ["Data", fmtDate(session.createdAt)],
    ["Partecipante", `${session.participant} (pseudonimo)`],
    ["Protocollo", `${modeLabel}${session.reading?.restSeconds ? `, pause di ${session.reading.restSeconds} s` : ""}${session.reading?.voiceRecorded ? ", voce registrata" : ""}`],
    ["Fascia", session.device ? `${session.device.name}${session.device.simulated ? " (simulata)" : ""}${session.device.firmwareVersion ? ` · fw ${session.device.firmwareVersion}` : ""}` : "nessuna: solo il tempo"],
    ["Responsabile", input.responsible?.trim() || "—"],
  ]);
  pg.gap(4);
  if (worst && worstM) {
    pg.keyBox(
      "Punto chiave",
      worst.level === "verde"
        ? `Nessuna clausola perde chi legge in questa sessione. Il punto più delicato è «${nameOf(worstM)}».`
        : `Il testo perde chi legge in «${nameOf(worstM)}» (clausola ${worstM.index}): ${worst.level}, ${worst.count} ${worst.count === 1 ? "indizio" : "indizi"} convergenti.`,
      `${worst.reasons.join(" · ") || "nessun indizio"} · LX ${worstM.lx.total}. Diagnosi del documento, non della persona.`,
    );
  }
  pg.tiles([
    { label: "Lettura", value: `${Math.round(totalMs / 1000)} s`, note: `${tooFast} clausole troppo veloci` },
    ...(hasVerify ? [{ label: "Verifica", value: `${vOk}/${session.answers.length}`, note: "risposte corrette" }] : []),
    ...(hasOperate ? [{ label: "Prova", value: `${oOk}/${session.tasks.length}`, note: "compiti riusciti" }] : []),
    { label: "Testo", value: `LX ${lxMean}`, note: `${overLx}/${metrics.length} sopra soglia ${LX_ACCESSIBILITY_THRESHOLD}` },
    { label: "Frizione", value: `${red} R · ${yellow} G`, note: `${friction.length - red - yellow} verdi` },
  ]);
  pg.section("In sintesi");
  pg.bullets(dossierSummary(input), 9.5);
  pdf.setFont("times", "italic").setFontSize(9.5).setTextColor(...INK_2);
  pdf.text("«si misurano i documenti, mai le persone»", PAGE.w / 2, PAGE.h - PAGE.margin - 6, { align: "center" });

  // ── 2. La mappa ──────────────────────────────────────────────────────────
  pg.newPage();
  pg.section("Tavola 1 · Dove il testo si perde");
  pg.snowMap(
    metrics.map((m) => {
      const f = byId.get(m.clauseId)!;
      return { index: m.index, heading: clean(m.heading), level: f.level, marks: f.count * 7, label: f.level === "rosso" ? "si perde" : f.level === "giallo" ? "attenzione" : "scorre" };
    }),
  );
  pg.caption(
    worst && worst.level !== "verde" && worstM
      ? `I trattini si addensano attorno alla riga ${worstM.index}, «${nameOf(worstM)}»: è lì che il documento perde chi legge.`
      : "I trattini sono radi e sparsi: nessuna riga li raccoglie. Il testo scorre.",
  );
  pg.plain("Ogni riga è una clausola, nell'ordine di lettura. I trattini sono gli indizi raccolti (tempo, corpo, testo, verifica, prova): dove si addensano, il testo perde chi legge. Il colore riassume la convergenza: rosso con almeno tre indizi di cui uno da verifica o prova, giallo con due o con una sola verifica o prova fallita, verde altrimenti. Il corpo da solo non colora mai.");
  pg.ensure(7 + metrics.length * 7.5 + 46);
  pg.section("Tavola 2 · Cruscotto per clausola");
  const effMax = Math.max(...metrics.map((m) => Math.abs(m.effortModel?.beta ?? m.effort.mean ?? 0)), 1e-9);
  pg.clauseBoard(
    metrics.map((m) => {
      const f = byId.get(m.clauseId)!;
      return {
        index: m.index, heading: clean(m.heading), dwellMs: m.dwellMs, plausibleMs: m.plausibleReadMs, tooFast: m.tooFastToRead,
        lx: m.lx.total, lxThreshold: LX_ACCESSIBILITY_THRESHOLD,
        verify: m.verification.asked ? `${m.verification.correct}/${m.verification.asked}` : "–",
        operate: m.operational.asked ? `${m.operational.correct}/${m.operational.asked}` : "–",
        effort: hasBody ? (m.effortModel?.beta ?? (m.effort.sampleCount ? m.effort.mean : null)) : null,
        effortMax: effMax, level: f.level,
      };
    }),
  );
  pg.plain("Tempo: la barra è il tempo speso sulla clausola; la tacca è il tempo plausibile per leggerla tutta a 250 parole al minuto; una barra rossa più corta della tacca oltre il limite di 600 parole al minuto esclude la lettura completa. LX: la barra è il punteggio 0-100, la tacca la soglia sperimentale. V · P: risposte corrette e compiti riusciti sulla clausola. Sforzo: peso attribuito con il modello della risposta emodinamica, in scala relativa alla sessione (a destra dello zero, più alto della baseline).");

  // ── 3. Tabella per clausola ──────────────────────────────────────────────
  pg.newPage();
  pg.section("Tavola 3 · Tabella per clausola");
  const head = ["#", "Clausola", "Parole", "Tempo", "wpm", "Rit.", "LX"];
  if (hasVerify) head.push("Verifica");
  if (hasOperate) head.push("Prova");
  if (hasBody) head.push("beta HRF ± e.s.");
  if (metrics.some((m) => m.pulse)) head.push("HR d");
  head.push("Frizione", "Indizi");
  const body = metrics.map((m) => {
    const f = byId.get(m.clauseId)!;
    const row: (string | number)[] = [
      m.index,
      safe(clean(m.heading) ?? doc.clauses[m.index - 1].text.slice(0, 40) + "…"),
      m.wordCount,
      seconds(m.dwellMs),
      m.wordsPerMinute === null ? "—" : `${Math.round(m.wordsPerMinute)}${m.tooFastToRead ? " !" : ""}`,
      m.returns,
      m.lx.total,
    ];
    if (hasVerify) row.push(m.verification.asked ? `${m.verification.correct}/${m.verification.asked}` : "—");
    if (hasOperate) row.push(m.operational.asked ? `${m.operational.correct}/${m.operational.asked}` : "—");
    if (hasBody) row.push(m.effortModel ? `${m.effortModel.beta.toFixed(3)} ± ${m.effortModel.se.toFixed(3)}` : m.effort.sampleCount ? m.effort.mean.toFixed(3) : "—");
    if (metrics.some((x) => x.pulse)) row.push(m.pulse?.deltaBpm != null ? `${m.pulse.deltaBpm >= 0 ? "+" : ""}${m.pulse.deltaBpm.toFixed(0)}` : "—");
    row.push(f.level, safe(f.reasons.join("; ")) || "nessuno");
    return row;
  });
  autoTable(pdf, {
    startY: pg.y,
    head: [head],
    body,
    ...TABLE_STYLE,
    styles: { ...TABLE_STYLE.styles, fontSize: 6.5, cellPadding: 1.2 },
    columnStyles: { 0: { cellWidth: 6 }, 1: { cellWidth: 34 }, 2: { cellWidth: 11 }, 3: { cellWidth: 12 }, 4: { cellWidth: 10 }, 5: { cellWidth: 8 }, 6: { cellWidth: 8 }, [head.length - 2]: { cellWidth: 14 } },
    didParseCell: frictionColor(head.length - 2),
  });
  pg.y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  pg.plain(`! = oltre 600 parole al minuto. LX 0-100, soglia ${LX_ACCESSIBILITY_THRESHOLD}; le quattro strade (lingua, affollamento, ordine, distanza semantica) sono nel JSON allegato. beta HRF = sforzo attribuito con il modello della risposta emodinamica (µM stimati, confrontabili solo dentro la sessione) con l'errore standard; HR d = battito medio sulla clausola meno battito a riposo, in bpm, indicatore sistemico. Nessuna colonna, da sola, dice se la clausola è stata compresa.`);

  // ── 4. Le quattro strade dell'LX ─────────────────────────────────────────
  pg.section("Tavola 4 · Le quattro strade della complessità");
  autoTable(pdf, {
    startY: pg.y,
    head: [["#", "Clausola", "Lingua", "Affollamento", "Ordine", "Distanza semantica", "LX", "Frase media (parole)", "Rinvii", "Termini non definiti"]],
    body: metrics.map((m) => [
      m.index, safe(clean(m.heading) ?? ""), m.lx.syntactic, m.lx.conceptual, m.lx.structural, m.lx.semantic, m.lx.total,
      Math.round(m.lx.details.avgSentenceLength), m.lx.details.citations, m.lx.details.undefinedTerms,
    ]),
    ...TABLE_STYLE,
    columnStyles: { 1: { cellWidth: 40 } },
  });
  pg.y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  pg.plain("Le quattro strade sono le dimensioni dell'LX Complexity Score: la lingua (lunghezza dei periodi, subordinate, passivi), l'affollamento (termini tecnici e rinvii per cento parole), l'ordine (dove stanno le cose che contano) e la distanza semantica (termini usati senza essere definiti). Per riprogettare una clausola si parte dalla strada con il valore più alto.");

  // ── 5. Il corpo ──────────────────────────────────────────────────────────
  if (hasBody) {
    pg.newPage();
    pg.section("Tavola 5 · Il corpo: sforzo attribuito per clausola");
    const withModel = metrics.filter((m) => m.effortModel);
    if (withModel.length) {
      pg.errorBars(withModel.map((m) => ({ index: m.index, value: m.effortModel!.beta, se: m.effortModel!.se, level: byId.get(m.clauseId)!.level })), "µM");
      pg.caption("un peso non distinguibile da zero entro due errori standard non è un indizio");
    }
    const vit = session.vitals ?? [];
    const restBpm = session.frames.length && vit.length ? Math.round(vit.filter((v) => v.phase === "baseline" && v.bpm && v.quality >= 0.7).reduce((a, v, _, arr) => a + v.bpm! / arr.length, 0)) : 0;
    pg.bullets([
      `Campioni registrati: ${session.frames.length}; con segnale utilizzabile in lettura: ${session.frames.filter((f) => f.phase === "reading" && f.effort).length}.`,
      `Artefatti di movimento (rotazione > 12°/s o accelerazione oltre 0,15 g): ${Math.round((metrics.reduce((s, m) => s + m.effort.motionArtifactRatio * m.effort.sampleCount, 0) / Math.max(1, metrics.reduce((s, m) => s + m.effort.sampleCount, 0))) * 100)}% dei campioni, esclusi dal modello.`,
      restBpm ? `Battito a riposo ${restBpm} bpm; per clausola, lo scarto è nella tabella (HR d bpm). È un indicatore sistemico: reagisce al carico ma anche a emozione, postura e caffè.` : "Battito non rilevato con qualità sufficiente.",
      HRF_DESCRIPTION + (input.modelR2 != null ? ` Varianza spiegata dal modello sulle porzioni: ${(input.modelR2 * 100).toFixed(0)}%.` : ""),
    ], 9);
    pg.plain("Il segnale della fascia è un indizio, mai una lettura della mente. Dice che in un passaggio lo sforzo, misurato come emoglobina ossigenata nella corteccia prefrontale, è cresciuto rispetto al riposo; non dice se il passaggio è stato compreso. Per questo il corpo, da solo, non colora mai una clausola.");
  }

  // ── 6. Parola per parola ─────────────────────────────────────────────────
  if (segs.length > 0) {
    pg.newPage();
    pg.section(`Tavola ${hasBody ? 6 : 5} · Parola per parola`);
    const read = segs.filter((r) => r.msPerWord !== null).map((r) => r.msPerWord!).sort((a, b) => a - b);
    const median = read.length ? read[Math.floor(read.length / 2)] : null;
    pg.p(`Presentazione ${modeLabel}. ${segs.length} porzioni; tempo per parola mediano ${median ? Math.round(median) : "—"} ms. Il colore è il tempo per parola rispetto alla sessione: azzurro sotto la norma, neutro nella norma, rame crescente per lento, molto lento, fermo. Le porzioni non lette sono in grigio.`, 9.5, INK_2, 4);
    // legenda
    const lx0 = pg.x0;
    ["veloce", "nella norma", "lento", "molto lento", "fermo"].forEach((l, i) => {
      pdf.setFillColor(...HEAT[i]);
      pdf.rect(lx0 + i * 32, pg.y - 3, 4, 3.2, "F");
      pdf.setFont("helvetica", "normal").setFontSize(6.5).setTextColor(...MUTED);
      pdf.text(l, lx0 + i * 32 + 5.5, pg.y - 0.4);
    });
    pg.gap(5);
    for (const c of doc.clauses) {
      const mine = segs.filter((r) => r.clauseId === c.id);
      if (!mine.length) continue;
      pg.ensure(14);
      pg.smallcaps(`${c.index}. ${clean(c.heading) ?? ""}`, pg.x0, pg.y, 6.5, MUTED);
      pg.gap(5);
      pg.heatText(mine.map((r) => ({ text: r.text, heat: r.msPerWord === null ? null : r.heat, msPerWord: r.msPerWord })));
    }
    pg.gap(2);
    pg.section("Le porzioni più lente");
    autoTable(pdf, {
      startY: pg.y,
      head: [["Cl.", "Porzione", "Parole", "ms/parola", "Rit.", "Ferm.", ...(hasBody ? ["beta HRF"] : [])]],
      body: slowestSegments(segs, 12).map((r) => [r.clauseIndex, safe(r.text), r.wordCount, Math.round(r.msPerWord!), r.returns, r.pauses, ...(hasBody ? [r.model ? `${r.model.beta.toFixed(3)} ± ${r.model.se.toFixed(3)}` : "—"] : [])]),
      ...TABLE_STYLE,
      columnStyles: { 1: { cellWidth: 80 } },
    });
    pg.y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
    if (hasBody && segs.some((r) => r.model)) {
      pg.section("Le porzioni con lo sforzo attribuito più alto");
      autoTable(pdf, {
        startY: pg.y,
        head: [["Cl.", "Porzione", "ms/parola", "beta HRF", "± e.s.", "Rit."]],
        body: highestEffortSegments(segs, 12).map((r) => [r.clauseIndex, safe(r.text), Math.round(r.msPerWord!), r.model!.beta.toFixed(3), r.model!.se.toFixed(3), r.returns]),
        ...TABLE_STYLE,
        columnStyles: { 1: { cellWidth: 80 } },
      });
      pg.y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
    }
    pg.plain("Il tempo per parola è esatto: ogni porzione ha un istante di comparsa e uno di uscita. Il segnale corporeo, invece, è attribuito con un modello della risposta emodinamica: con porzioni di uno o due secondi e una risposta che dura trenta, i pesi di porzioni vicine restano correlati, e il dato diventa credibile sulle porzioni lunghe o riviste.");
  }

  // ── 7. Verifica e prova ──────────────────────────────────────────────────
  if (hasVerify || hasOperate) {
    pg.newPage();
    pg.section("Verifica e prova operativa");
    if (hasVerify) {
      autoTable(pdf, {
        startY: pg.y,
        head: [["Domanda", "Cl.", "Risposta data", "Esito", "Tempo"]],
        body: session.answers.map((a) => {
          const q = doc.questions.find((x) => x.id === a.questionId);
          return [safe(q?.prompt ?? a.questionId), doc.clauses.find((c) => c.id === a.clauseId)?.index ?? a.clauseId, safe(q ? q.options[a.chosenIndex] : String(a.chosenIndex)), a.correct ? "corretta" : "errata", seconds(a.ms)];
        }),
        ...TABLE_STYLE,
        columnStyles: { 0: { cellWidth: 70 }, 2: { cellWidth: 55 } },
      });
      pg.y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
    }
    if (hasOperate) {
      autoTable(pdf, {
        startY: pg.y,
        head: [["Compito", "Cl. giusta", "Cl. scelta", "Esito", "Aperte", "Tempo"]],
        body: session.tasks.map((t) => {
          const task = doc.tasks.find((x) => x.id === t.taskId);
          const idx = (id: string) => doc.clauses.find((c) => c.id === id)?.index ?? id;
          return [safe(task?.prompt ?? t.taskId), idx(t.clauseId), idx(t.chosenClauseId), t.correct ? "riuscito" : "fallito", t.opened, seconds(t.ms)];
        }),
        ...TABLE_STYLE,
        columnStyles: { 0: { cellWidth: 80 } },
      });
      pg.y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
    }
    pg.plain("La verifica misura la comprensione dichiarata: domande a risposta chiusa dopo la lettura, senza rileggere. La prova operativa misura la comprensione in atto: ritrovare la clausola che serve, con il documento riapribile. Sono i due indizi che pesano di più nella convergenza.");
  } else {
    pg.newPage();
  }

  // ── 8. Metodo, costituzione, responsabile, impronta ──────────────────────
  pg.section("Metodo dichiarato");
  pg.bullets(METHOD, 8.5);
  pg.section("La costituzione della misurazione, applicata");
  pg.bullets(CONSTITUTION, 8.5);
  pg.ensure(48);
  pg.section("Chi risponde di questo documento");
  pg.p(input.responsible?.trim() ? `Responsabile del documento: ${input.responsible.trim()}` : "Responsabile del documento: ______________________________  (il nome sul cartello)", 10, INK, 3);
  pg.p("Data e firma: ______________________________", 10, INK, 5);
  pg.section("Impronta dei dati");
  const hash = await fingerprint(input.sessionJson);
  pg.p(hash ? `SHA-256 del JSON di sessione: ${hash}. Chi possiede i dati può ricalcolare ogni numero di questo fascicolo.` : "Impronta non disponibile in questo ambiente. I dati esportati permettono comunque di ricalcolare ogni numero.", 8, INK_2, 2);
  pg.caption("ars sine scientia nihil est");

  pg.footerAll(`Fascicolo di comprensibilità · ${session.id}`);
  return pdf.output("blob");
}

// ── Fascicolo aggregato ──────────────────────────────────────────────────────

export interface AggregateDossierInput {
  aggregate: Aggregate;
  /** JSON dell'aggregato (per l'impronta). */
  aggregateJson: string;
  responsible?: string;
  calibration?: Calibration;
}

export function aggregateSummary(a: Aggregate): string[] {
  const T = AGGREGATE_THRESHOLDS;
  const red = a.clauses.filter((c) => c.friction.level === "rosso").length;
  const yellow = a.clauses.filter((c) => c.friction.level === "giallo").length;
  const worst = [...a.clauses].sort((x, y) => y.lostShare - x.lostShare)[0];
  const vAsked = a.clauses.reduce((s, c) => s + c.verification.asked, 0);
  const vCorrect = a.clauses.reduce((s, c) => s + c.verification.correct, 0);
  const oAsked = a.clauses.reduce((s, c) => s + c.operational.asked, 0);
  const oCorrect = a.clauses.reduce((s, c) => s + c.operational.correct, 0);
  const lines = [
    `${a.sessions} lettori sullo stesso documento (${a.clauses.length} clausole), dal ${fmtDate(a.firstSession)} al ${fmtDate(a.lastSession)}.${a.simulatedSessions ? ` Attenzione: ${a.simulatedSessions} sessioni con fascia simulata (segnale non reale).` : ""}`,
    `Corpo: ${a.sessionsWithSignal} lettori con segnale della fascia${a.sessionsWithSignal < T.minSignalReaders ? ` (sotto il minimo di ${T.minSignalReaders}: il corpo non conta come indizio)` : ""}.`,
    `Frizione per convergenza tra lettori: ${red} clausole rosse, ${yellow} gialle, ${a.clauses.length - red - yellow} verdi.`,
  ];
  if (vAsked) lines.push(`Verifica: ${vCorrect} risposte corrette su ${vAsked} (${Math.round((vCorrect / vAsked) * 100)}%).`);
  if (oAsked) lines.push(`Prova operativa: ${oCorrect} compiti riusciti su ${oAsked} (${Math.round((oCorrect / oAsked) * 100)}%).`);
  if (worst && worst.lostShare > 0) {
    lines.push(`La clausola che perde più lettori è la ${worst.index}${worst.heading ? ` (${worst.heading})` : ""}: gialla o rossa per il ${Math.round(worst.lostShare * 100)}% dei lettori nella propria sessione.`);
  }
  return lines;
}

export async function buildAggregateDossier(input: AggregateDossierInput): Promise<Blob> {
  const a = input.aggregate;
  const T = AGGREGATE_THRESHOLDS;
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const w = writer(pdf);
  const { heading, paragraph, bullets } = w;

  w.title("Fascicolo di comprensibilità — aggregato");
  paragraph(`Documento: ${a.documentTitle}`, 10, 0);
  paragraph(`${a.sessions} sessioni aggregate in forma anonima · Habeas Mentem Lab, LX Reader`, 9, 4);

  heading("1. Sintesi");
  bullets(aggregateSummary(a));

  heading("2. Dove i lettori si perdono");
  const hasVerify = a.clauses.some((c) => c.verification.asked > 0);
  const hasOperate = a.clauses.some((c) => c.operational.asked > 0);
  const hasBody = a.sessionsWithSignal > 0;
  const head = ["#", "Clausola", "Parole", "Lettori", "Tempo mediano", "Troppo veloci", "Tornati", "LX"];
  if (hasVerify) head.push("Verifica");
  if (hasOperate) head.push("Prova");
  if (hasBody) head.push("Sforzo (n)");
  head.push("Persi", "Frizione", "Indizi");
  const pct = (x: number | null) => (x === null ? "—" : `${Math.round(x * 100)}%`);
  const body = a.clauses.map((c) => {
    const row: (string | number)[] = [
      c.index,
      c.heading ?? "—",
      c.wordCount,
      c.readers,
      seconds(c.dwellMedianMs),
      pct(c.tooFastShare),
      pct(c.returnedShare),
      c.lx.total,
    ];
    if (hasVerify) row.push(c.verification.asked ? `${c.verification.correct}/${c.verification.asked}` : "—");
    if (hasOperate) row.push(c.operational.asked ? `${c.operational.correct}/${c.operational.asked}${c.operational.timesChosenWrongly ? ` (scelta per errore ${c.operational.timesChosenWrongly})` : ""}` : "—");
    if (hasBody) row.push(c.effort.mean === null ? "—" : `${c.effort.mean.toFixed(4)} (${c.effort.readersWithSignal})`);
    row.push(pct(c.lostShare), c.friction.level, c.friction.reasons.join("; ") || "nessuno");
    return row;
  });
  autoTable(pdf, {
    startY: w.state.y,
    head: [head],
    body,
    ...TABLE_STYLE,
    columnStyles: { 1: { cellWidth: 40 }, [head.length - 1]: { cellWidth: 60 } },
    didParseCell: w.frictionColor(head.length - 2),
  });
  w.afterTable();
  paragraph(
    "Persi = quota di lettori per cui la clausola era gialla o rossa nella propria sessione. Le quote sono calcolate sui lettori che hanno aperto la clausola.",
    8,
    4,
  );

  heading("3. Metodo dichiarato (aggregato)");
  bullets(
    [
      ...METHOD.slice(0, 4),
      `Convergenza tra lettori: il tempo conta se almeno il ${Math.round(T.timeShare * 100)}% dei lettori è stato troppo veloce o è tornato indietro; la verifica conta con almeno ${T.minAnswers} risposte e accuratezza sotto il ${Math.round(T.verifyAccuracy * 100)}%; la prova con almeno ${T.minAnswers} compiti e riuscita sotto il ${Math.round(T.operateSuccess * 100)}%; il corpo con almeno ${T.minSignalReaders} lettori con segnale e sforzo medio nel terzo più alto. Rosso con almeno tre indizi di cui uno da verifica o prova; giallo con due, o con una sola verifica o prova; verde altrimenti.`,
      "Anonimato: gli pseudonimi delle sessioni non sono riportati; conta solo quanti lettori erano. I dati restano aggregati.",
      METHOD[5],
    ],
    8.5,
  );

  if (input.calibration) {
    const c = input.calibration;
    const fr = (r: number | null) => (r === null ? "—" : r.toFixed(2));
    heading("4. Ricalibrazione dell'LX sui dati");
    if (!c.eligible) {
      paragraph(`${c.reason} Con i pesi attuali (${describeWeights(c.defaultWeights)}) la correlazione tra LX e comprensione è r = ${fr(c.defaultR)}.`, 8.5, 3);
    } else {
      bullets(
        [
          `Pesi attuali: ${describeWeights(c.defaultWeights)} → r = ${fr(c.defaultR)}.`,
          `Pesi ricalibrati su ${c.clauses} clausole e ${c.sessions} lettori: ${describeWeights(c.weights)} → r = ${fr(c.r)}. Nel libro: r = ${BOOK_R.calibration} in calibrazione, ${BOOK_R.validation} in validazione.`,
          c.threshold
            ? `Soglia osservata: ${c.threshold}/100 (sopra, la comprensione media cala di ${Math.round((c.thresholdDrop ?? 0) * 100)} punti); soglia del libro: ${LX_ACCESSIBILITY_THRESHOLD}.`
            : "Nessuna soglia netta osservabile con questi dati.",
          ...c.caveats,
        ],
        8.5,
      );
    }
  }

  heading(`${input.calibration ? 5 : 4}. La costituzione della misurazione, applicata`);
  bullets(CONSTITUTION, 8.5);

  await w.closing(pdf, input.aggregateJson, input.responsible, paragraph, heading);
  return pdf.output("blob");
}
