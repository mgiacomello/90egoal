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
import autoTable from "jspdf-autotable";
import { LX_ACCESSIBILITY_THRESHOLD } from "./lx";
import type { Friction } from "./friction";
import type { ClauseMetrics } from "./metrics";
import type { Document, Session } from "./model";

export interface DossierInput {
  session: Session;
  doc: Document;
  metrics: ClauseMetrics[];
  friction: Friction[];
  /** JSON della sessione già serializzato: l'impronta lo lega al fascicolo. */
  sessionJson: string;
  /** Nome di chi risponde del documento ("il nome sul cartello"). Facoltativo. */
  responsible?: string;
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
  "Corpo (se presente): fascia Mendi, ~25 Hz; baseline a riposo di 30 s; indice di sforzo = od(rosso) - od(IR) rispetto alla baseline, media dei canali frontali, unità arbitrarie; campioni con movimento > 0,15 g segnalati come artefatti.",
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

export async function buildDossier(input: DossierInput): Promise<Blob> {
  const { session, doc, metrics, friction } = input;
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const W = pdf.internal.pageSize.getWidth();
  const margin = 16;
  const textWidth = W - margin * 2;
  let y = margin;

  const heading = (text: string, size = 13) => {
    if (y > 260) {
      pdf.addPage();
      y = margin;
    }
    pdf.setFont("helvetica", "bold").setFontSize(size);
    pdf.text(text, margin, y);
    y += size * 0.6;
  };
  const paragraph = (text: string, size = 9.5, gap = 2) => {
    pdf.setFont("helvetica", "normal").setFontSize(size);
    const lines = pdf.splitTextToSize(text, textWidth) as string[];
    for (const line of lines) {
      if (y > 280) {
        pdf.addPage();
        y = margin;
      }
      pdf.text(line, margin, y);
      y += size * 0.5;
    }
    y += gap;
  };
  const bullets = (items: string[], size = 9) => {
    for (const item of items) paragraph(`• ${item}`, size, 1);
    y += 2;
  };

  // Intestazione
  pdf.setFont("helvetica", "bold").setFontSize(18);
  pdf.text("Fascicolo di comprensibilità", margin, y);
  y += 8;
  pdf.setFont("helvetica", "normal").setFontSize(9.5);
  paragraph(`Documento: ${doc.title}`, 10, 0);
  paragraph(`Sessione ${session.id} · partecipante ${session.participant} · ${fmtDate(session.createdAt)}`, 9, 0);
  paragraph(
    `Consenso del partecipante registrato ${session.consent.timestamp ? fmtDate(session.consent.timestamp) : "—"} · Habeas Mentem Lab, LX Reader`,
    9,
    4,
  );

  heading("1. Sintesi");
  bullets(dossierSummary(input));

  heading("2. Mappa della frizione per clausola");
  const byId = new Map(friction.map((f) => [f.clauseId, f]));
  const hasVerify = session.answers.length > 0;
  const hasOperate = session.tasks.length > 0;
  const hasBody = metrics.some((m) => m.effort.sampleCount > 0);
  const head = ["#", "Clausola", "Parole", "Tempo", "wpm", "Rit.", "LX"];
  if (hasVerify) head.push("Verifica");
  if (hasOperate) head.push("Prova");
  if (hasBody) head.push("Sforzo");
  head.push("Frizione", "Indizi");
  const body = metrics.map((m) => {
    const f = byId.get(m.clauseId)!;
    const row: (string | number)[] = [
      m.index,
      m.heading ?? doc.clauses[m.index - 1].text.slice(0, 40) + "…",
      m.wordCount,
      seconds(m.dwellMs),
      m.wordsPerMinute === null ? "—" : `${Math.round(m.wordsPerMinute)}${m.tooFastToRead ? " !" : ""}`,
      m.returns,
      m.lx.total,
    ];
    if (hasVerify) row.push(m.verification.asked ? `${m.verification.correct}/${m.verification.asked}` : "—");
    if (hasOperate) row.push(m.operational.asked ? `${m.operational.correct}/${m.operational.asked}` : "—");
    if (hasBody) row.push(m.effort.sampleCount ? m.effort.mean.toFixed(4) : "—");
    row.push(f.level, f.reasons.join("; ") || "nessuno");
    return row;
  });
  autoTable(pdf, {
    startY: y,
    head: [head],
    body,
    margin: { left: margin, right: margin },
    styles: { font: "helvetica", fontSize: 7.5, cellPadding: 1.5, overflow: "linebreak" },
    headStyles: { fillColor: [47, 79, 111] },
    columnStyles: { 1: { cellWidth: 34 }, [head.length - 1]: { cellWidth: 46 } },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === head.length - 2) {
        const v = String(data.cell.raw);
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.textColor = v === "rosso" ? [179, 38, 30] : v === "giallo" ? [160, 120, 0] : [46, 125, 79];
      }
    },
  });
  y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  paragraph(
    "! = oltre 600 parole al minuto. LX in scala 0-100 (le quattro strade nel JSON allegato). Lo sforzo è la variazione media rispetto alla baseline, unità arbitrarie, confrontabile solo dentro la sessione.",
    8,
    4,
  );

  if (hasVerify || hasOperate) {
    heading("3. Verifica e prova operativa");
    if (hasVerify) {
      autoTable(pdf, {
        startY: y,
        head: [["Domanda", "Clausola", "Risposta data", "Esito", "Tempo"]],
        body: session.answers.map((a) => {
          const q = doc.questions.find((x) => x.id === a.questionId);
          return [
            q?.prompt ?? a.questionId,
            doc.clauses.find((c) => c.id === a.clauseId)?.index ?? a.clauseId,
            q ? q.options[a.chosenIndex] : String(a.chosenIndex),
            a.correct ? "corretta" : "errata",
            seconds(a.ms),
          ];
        }),
        margin: { left: margin, right: margin },
        styles: { font: "helvetica", fontSize: 7.5, cellPadding: 1.5, overflow: "linebreak" },
        headStyles: { fillColor: [47, 79, 111] },
        columnStyles: { 0: { cellWidth: 70 }, 2: { cellWidth: 55 } },
      });
      y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
    }
    if (hasOperate) {
      autoTable(pdf, {
        startY: y,
        head: [["Compito", "Clausola giusta", "Clausola scelta", "Esito", "Aperte", "Tempo"]],
        body: session.tasks.map((t) => {
          const task = doc.tasks.find((x) => x.id === t.taskId);
          const idx = (id: string) => doc.clauses.find((c) => c.id === id)?.index ?? id;
          return [task?.prompt ?? t.taskId, idx(t.clauseId), idx(t.chosenClauseId), t.correct ? "riuscito" : "fallito", t.opened, seconds(t.ms)];
        }),
        margin: { left: margin, right: margin },
        styles: { font: "helvetica", fontSize: 7.5, cellPadding: 1.5, overflow: "linebreak" },
        headStyles: { fillColor: [47, 79, 111] },
        columnStyles: { 0: { cellWidth: 80 } },
      });
      y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
    }
  }

  heading("4. Metodo dichiarato");
  bullets(METHOD, 8.5);

  heading("5. La costituzione della misurazione, applicata");
  bullets(CONSTITUTION, 8.5);

  heading("6. Chi risponde di questo documento");
  paragraph(
    input.responsible?.trim()
      ? `Responsabile del documento: ${input.responsible.trim()}`
      : "Responsabile del documento: ______________________________  (il nome sul cartello del cantiere)",
    9.5,
    2,
  );
  paragraph("Data e firma: ______________________________", 9.5, 4);

  heading("7. Impronta dei dati", 11);
  const hash = await fingerprint(input.sessionJson);
  paragraph(
    hash
      ? `SHA-256 del JSON di sessione esportato: ${hash}. Chi possiede il JSON può ricalcolare ogni numero di questo fascicolo.`
      : "Impronta non disponibile in questo ambiente. Il JSON di sessione esportato permette comunque di ricalcolare ogni numero.",
    8,
    2,
  );
  paragraph(`Generato ${fmtDate(Date.now())} da Habeas Mentem Lab (prototipo interno, non commerciale). Si misurano i documenti, mai le persone.`, 8, 0);

  return pdf.output("blob");
}
