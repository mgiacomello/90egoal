// Lettura dei risultati e proposte di riscrittura.
//
// Due cose che il fascicolo deve fare oltre a misurare: dire che cosa
// significa ogni risultato (e che cosa non significa), e indicare come
// migliorare il testo. Tutto è calcolato nel browser, con regole
// dichiarate: nessun modello remoto. Le proposte sono bozze da rivedere da
// un giurista, e ogni bozza automatica viene rimisurata con lo stesso LX,
// così il fascicolo dice quanto si guadagnerebbe, non quanto si spera.

import { lxScore, lxThreshold, LX_TARGET_SENTENCE_LENGTH, splitSentences, technicalTerms, type LxScore } from "./lx";
import type { Friction } from "./friction";
import type { ClauseMetrics } from "./metrics";
import type { Clause } from "./model";
import { roadOrder, type LabModel, type LearnedWord, type Road } from "./learning";

// Il modello appreso dall'archivio (learning.ts): parole che rallentano i
// lettori del team e ordine delle strade più predittive. Senza archivio le
// proposte restano quelle delle regole dichiarate.
let learned: LabModel | null = null;
export function setLearnedModel(model: LabModel | null): void {
  learned = model;
}
export function learnedModel(): LabModel | null {
  return learned;
}

const KIND_ROAD: Record<Proposal["kind"], Road> = {
  spezza: "syntactic", attivo: "syntactic", nominale: "syntactic",
  parola: "semantic", definisci: "semantic",
  elenco: "structural", ordine: "structural",
  rinvii: "conceptual",
};

/** Definizione per una singola parola: chiave uguale, o radice (chiave di una parola sola che la parola continua). */
export function definitionFor(word: string): string | undefined {
  const w = word.toLowerCase();
  const exact = DEFINITIONS[w];
  if (exact) return exact;
  const stem = Object.entries(DEFINITIONS).find(([k]) => !k.includes(" ") && w.startsWith(k) && k.length >= 5);
  return stem?.[1];
}

/** Le parole lente dell'archivio presenti in questo testo. */
export function learnedWordsIn(text: string, model: LabModel | null = learned): LearnedWord[] {
  if (!model) return [];
  const low = text.toLowerCase();
  return model.words.filter((w) => new RegExp(`(^|[^a-zà-ù])${w.word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-zà-ù]|$)`).test(low));
}

export interface Proposal {
  /** Tipo di intervento. */
  kind: "spezza" | "attivo" | "parola" | "definisci" | "rinvii" | "elenco" | "ordine" | "nominale";
  /** Titolo breve. */
  title: string;
  /** Il passaggio originale (o la parola). */
  before: string;
  /** La proposta. */
  after: string;
  /** Perché conviene, in una riga. */
  why: string;
}

export interface ClauseReading {
  clauseId: string;
  index: number;
  heading: string | null;
  level: Friction["level"];
  /** Che cosa dicono i dati, sensore per sensore, e che cosa non dicono. */
  interpretation: string[];
  /** La strada dell'LX da cui partire. */
  leadRoad: { road: "lingua" | "affollamento" | "ordine" | "distanza semantica"; score: number } | null;
  proposals: Proposal[];
  /** Bozza automatica (sostituzioni sicure + periodi spezzati) e LX rimisurato. */
  draft: { text: string; before: number; after: number } | null;
  /** Priorità 1 = intervenire per prima. */
  priority: number;
}

/** Glossario: locuzioni giuridiche frequenti e la resa piana. */
export const PLAIN_WORDS: [RegExp, string, string][] = [
  [/\bai sensi dell'/gi, "secondo l'", "«ai sensi di» è un rinvio: «secondo» dice la stessa cosa"],
  [/\bai sensi dello /gi, "secondo lo ", "«ai sensi di» è un rinvio: «secondo» dice la stessa cosa"],
  [/\bai sensi della /gi, "secondo la ", "«ai sensi di» è un rinvio: «secondo» dice la stessa cosa"],
  [/\bai sensi del /gi, "secondo il ", "«ai sensi di» è un rinvio: «secondo» dice la stessa cosa"],
  [/\bai sensi dei /gi, "secondo i ", "«ai sensi di» è un rinvio: «secondo» dice la stessa cosa"],
  [/\bai sensi degli /gi, "secondo gli ", "«ai sensi di» è un rinvio: «secondo» dice la stessa cosa"],
  [/\bai sensi delle /gi, "secondo le ", "«ai sensi di» è un rinvio: «secondo» dice la stessa cosa"],
  [/\bai sensi di /gi, "secondo ", "«ai sensi di» è un rinvio: «secondo» dice la stessa cosa"],
  [/\bnonché(?![a-zà-ù])/gi, "e", "«nonché» è una congiunzione rara: «e» basta"],
  [/\bovvero\b/gi, "oppure", "«ovvero» in italiano comune vuol dire «cioè»: qui significa «oppure», meglio dirlo"],
  [/\bqualora\b/gi, "se", "«qualora» è «se»"],
  [/\bove\b/gi, "se", "«ove» è «se» (o «dove»)"],
  [/\bladdove\b/gi, "dove", "«laddove» è «dove»"],
  [/\bpurché(?![a-zà-ù])/gi, "a patto che", "«purché» si legge meglio come «a patto che»"],
  [/\bprevio (il )?consenso\b/gi, "dopo il consenso", "«previo» è «dopo aver ottenuto»"],
  [/\bprevia\b/gi, "dopo", "«previa» è «dopo»"],
  [/\bprevio\b/gi, "dopo", "«previo» è «dopo»"],
  [/\bivi inclus[oaie]\b/gi, "compreso", "«ivi incluso» è «compreso»"],
  [/\bivi comprese?\b/gi, "comprese", "«ivi» è latino: si può togliere"],
  [/\bfermo restando (che )?/gi, "resta valido che ", "«fermo restando» è «resta valido»"],
  [/\bpertanto\b/gi, "quindi", "«pertanto» è «quindi»"],
  [/\bal fine di\b/gi, "per", "«al fine di» è «per»"],
  [/\bai fini (di|del|della|dell')\b/gi, "per $1", "«ai fini di» è «per»"],
  [/\bmediante\b/gi, "con", "«mediante» è «con»"],
  [/\bin mancanza\b/gi, "se manca", "«in mancanza» è «se manca»"],
  [/\bdecors[oaie] (tale|il|detto) termine\b/gi, "passato quel termine", "«decorso il termine» è «passato il termine»"],
  [/\bnella misura in cui\b/gi, "quanto", "«nella misura in cui» spesso è «quanto» o «se»"],
  [/\bsalvo (che )?/gi, "tranne ", "«salvo» è «tranne»"],
  [/\bin ogni caso\b/gi, "sempre", "«in ogni caso» è «sempre»"],
  [/\bin relazione a(l|lla|i|gli|lle)?\b/gi, "su$1", "«in relazione a» è «su»"],
  [/\bcongiuntamente\b/gi, "insieme", "«congiuntamente» è «insieme»"],
  [/\bsuccessivamente\b/gi, "dopo", "«successivamente» è «dopo»"],
  [/\bprecedentemente\b/gi, "prima", "«precedentemente» è «prima»"],
  [/\bin via esclusiva\b/gi, "soltanto", "«in via esclusiva» è «soltanto»"],
  [/\bsi riserva (di|il diritto di)\b/gi, "può", "«si riserva di» è «può»"],
  [/\bcostituisce presa d'atto\b/gi, "vale come presa d'atto", "meno formale, stesso significato"],
  [/\bl'interessato\b/gi, "la persona", "«interessato» nel GDPR è la persona a cui i dati si riferiscono: dirlo"],
  [/\bin caso di\b/gi, "se c'è", "«in caso di» spesso è «se»"],
  [/\beventual([ei])\b/gi, "possibil$1", "«eventuale» è «possibile»"],
  [/\bammontare\b/gi, "importo", "«ammontare» è «importo»"],
  [/\bcorrispettivo\b/gi, "prezzo", "«corrispettivo» è «prezzo»"],
  [/\bonere\b/gi, "costo", "«onere» è «costo» (o «obbligo»)"],
];

/** Sostantivi astratti in -zione/-mento e il verbo che li restituisce a chi agisce. */
const NOMINALS: [RegExp, string][] = [
  [/\bl'erogazione (dei|del|delle|della)\b/gi, "fornire $1"],
  [/\bla conservazione (dei|del|delle|della)\b/gi, "conservare $1"],
  [/\bla comunicazione (dei|del|delle|della)\b/gi, "comunicare $1"],
  [/\bla cancellazione (dei|del|delle|della)\b/gi, "cancellare $1"],
  [/\bla valutazione (dei|del|delle|della)\b/gi, "valutare $1"],
  [/\bl'esercizio (dei|del|delle|della)\b/gi, "esercitare $1"],
  [/\bl'adempimento (di|degli|dell')\b/gi, "adempiere $1"],
  [/\bl'installazione (dei|di)\b/gi, "installare $1"],
  [/\bla memorizzazione (dei|di)\b/gi, "memorizzare $1"],
  [/\bla sottoscrizione (di|del|della)\b/gi, "sottoscrivere $1"],
  [/\bla revoca (del|dei)\b/gi, "revocare $1"],
];

/** Definizioni pronte per i termini tecnici più frequenti. */
export const DEFINITIONS: Record<string, string> = {
  "titolare del trattamento": "chi decide perché e come usare i tuoi dati",
  "responsabile del trattamento": "un fornitore che tratta i dati per conto del titolare, con un contratto",
  interessato: "la persona a cui i dati si riferiscono: tu",
  "base giuridica": "la ragione ammessa dalla legge per usare i dati",
  "legittimo interesse": "un interesse dell'azienda che la legge ammette se non prevale sui tuoi diritti",
  pseudonimizzazione: "sostituire il nome con un codice, tenendo la chiave da un'altra parte",
  anonimizz: "rendere i dati non più riconducibili a nessuno, in modo irreversibile",
  profilazione: "usare i dati per prevedere o valutare aspetti di una persona",
  "processo decisionale automatizzato": "una decisione presa da un software senza intervento umano",
  "clausole contrattuali standard": "un contratto-tipo approvato dalla Commissione europea per mandare dati fuori dall'UE",
  "decisione di adeguatezza": "l'atto con cui la Commissione europea riconosce che un Paese protegge i dati quanto l'UE",
  portabilità: "il diritto di ricevere i tuoi dati in un formato riutilizzabile",
  "limitazione del trattamento": "congelare i dati: si conservano ma non si usano",
  "autorità di controllo": "in Italia, il Garante per la protezione dei dati personali",
  recesso: "sciogliere il contratto entro un termine, senza dare motivi",
  disdetta: "far cessare il rinnovo del contratto alla scadenza",
  "rinnovo automatico": "il contratto continua da solo alla scadenza, se non lo fermi",
  "foro competente": "il tribunale davanti al quale si fa causa",
  consumatore: "chi compra per sé, non per lavoro",
  dolo: "intenzione di fare il danno",
  "colpa grave": "negligenza molto seria",
  cookie: "un piccolo file che il sito salva nel tuo browser per riconoscerti",
  "local storage": "una memoria del browser dove un sito può salvare dati",
  pixel: "un'immagine invisibile che segnala a un terzo che hai aperto una pagina",
  fnirs: "una tecnica ottica che stima l'ossigenazione del sangue nel cervello dalla fronte",
  emodinamic: "relativo al flusso di sangue",
  "dati relativi alla salute": "dati che dicono qualcosa sul tuo stato fisico o mentale",
  algoritm: "una sequenza di istruzioni con cui il software calcola un risultato",
  modelli: "programmi addestrati su molti esempi, che producono stime",
  identificativ: "un codice che riconosce il tuo dispositivo o il tuo account",
  inferenz: "una stima ricavata dai dati, non un fatto osservato",
  trasferimento: "l'invio dei dati fuori dall'Unione europea",
  "paesi terzi": "Paesi fuori dall'Unione europea",
  reclamo: "una segnalazione formale all'autorità",
  revoca: "ritirare un consenso già dato",
  licenza: "il permesso di usare qualcosa che resta di proprietà di un altro",
  responsabilità: "chi risponde dei danni, e fino a che punto",
  attivazione: "aumento dell'attività in una zona del cervello",
  "corteccia prefrontale": "la parte anteriore del cervello, dietro la fronte",
  "vicino infrarosso": "luce invisibile, appena oltre il rosso, che attraversa pelle e osso",
  inerziali: "dati di movimento: accelerometro e giroscopio",
  "apprendimento automatico": "software che migliora imparando dagli esempi",
  classificazione: "assegnare un'etichetta a un dato",
  predittiv: "che stima ciò che accadrà",
  "categorie particolari": "i dati più delicati: salute, origine, opinioni, orientamento",
  "dati biometrici": "dati del corpo che identificano una persona, come l'impronta",
  "stato attentivo": "quanto una persona è concentrata in quel momento",
  "eeg": "la registrazione dell'attività elettrica del cervello dal cuoio capelluto",
  "legge applicabile": "la legge del Paese secondo cui si interpreta il contratto",
  "opere derivate": "nuove opere ricavate dalla tua",
  "sublicenziabile": "che può essere concessa a sua volta ad altri",
  "consequenzial": "danni indiretti, che derivano da altri danni",
  "inderogabil": "che la legge non permette di cambiare per contratto",
};

const ROADS: { key: keyof Pick<LxScore, "syntactic" | "conceptual" | "structural" | "semantic">; road: ClauseReading["leadRoad"] extends infer T ? (T extends { road: infer R } ? R : never) : never }[] = [
  { key: "syntactic", road: "lingua" },
  { key: "conceptual", road: "affollamento" },
  { key: "structural", road: "ordine" },
  { key: "semantic", road: "distanza semantica" },
];

function cap(s: string): string {
  if (/^(www\.|https?:|\d)/i.test(s)) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Dopo un punto la frase riparte con la maiuscola (ma non gli indirizzi web). */
function fixSentenceStarts(text: string): string {
  return text
    .replace(/(^|[^a-zà-ù])(art|artt|lett|par|n|cfr|d\.lgs|lgs|p|pp|es|comma)\.\s+([a-zà-ù])/gi, (m) => m.replace(/\.\s+/, ".\u0000"))
    .replace(/([.!?])\s+([a-zà-ù])(?![a-z]*\.[a-z])/g, (_, p, ch) => `${p} ${ch.toUpperCase()}`)
    .replace(/\u0000/g, " ")
    .replace(/^\s*([a-zà-ù])/, (m) => m.toUpperCase());
}

/** Punto migliore in cui spezzare un periodo lungo: «;», «:», oppure una giuntura di senso vicino alla metà. */
function splitLongSentence(sentence: string): [string, string] | null {
  const words = sentence.split(/\s+/);
  if (words.length <= LX_TARGET_SENTENCE_LENGTH + 6) return null;
  const candidates: { pos: number; score: number }[] = [];
  const re = /(;|:|\)\s*,|,\s+(e|nonché|ovvero|oppure|ma|mentre|salvo|fermo restando|ferma restando|in mancanza|se|quando|dopo)\s)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sentence))) {
    const pos = m.index + (m[0].startsWith(";") || m[0].startsWith(":") ? 1 : 1);
    const left = sentence.slice(0, pos).split(/\s+/).length;
    const right = words.length - left;
    if (left < 6 || right < 6) continue;
    const balance = Math.abs(left - right) / words.length;
    const bonus = m[0].startsWith(";") ? 0.5 : m[0].startsWith(":") ? 0.4 : 0;
    candidates.push({ pos, score: bonus - balance });
  }
  if (!candidates.length) return null;
  // Il pezzo di destra deve poter stare in piedi da solo: niente frammenti che iniziano con una preposizione.
  for (const best of candidates.sort((a, b) => b.score - a.score)) {
    const left = sentence.slice(0, best.pos).replace(/[;:,]\s*$/, "").trim();
    let right = sentence.slice(best.pos).replace(/^[;:,]?\s*/, "").trim();
    right = right.replace(/^(e|nonché|ovvero|oppure|ma)\s+/i, (w) => (/^ma$/i.test(w.trim()) ? "Ma " : ""));
    if (/^(di|a|da|in|con|su|per|tra|fra|del|dello|della|dei|degli|delle|al|allo|alla|ai|agli|alle|dal|dallo|dalla|dai|dagli|dalle|nel|nella|nei|nelle|sul|sulla|sui|sulle)\s/i.test(right)) continue;
    if (right.split(/\s+/).length < 5) continue;
    return [left.endsWith(".") ? left : left + ".", cap(right)];
  }
  return null;
}

/** Proposte per una clausola. */
export function proposalsFor(clause: Clause, lx: LxScore): Proposal[] {
  const out: Proposal[] = [];
  const text = clause.text;

  // 1. Periodi lunghi: spezzare.
  const sentences = splitSentences(text);
  const long = sentences.filter((s) => s.split(/\s+/).length > LX_TARGET_SENTENCE_LENGTH + 6).sort((a, b) => b.length - a.length).slice(0, 2);
  for (const s of long) {
    const sp = splitLongSentence(s);
    const n = s.split(/\s+/).length;
    if (sp) out.push({ kind: "spezza", title: `Periodo di ${n} parole: spezzarlo in due`, before: s, after: `${sp[0]} ${sp[1]}`, why: `Obiettivo ${LX_TARGET_SENTENCE_LENGTH} parole per periodo: ogni periodo un'idea.` });
    else out.push({ kind: "spezza", title: `Periodo di ${n} parole: spezzarlo`, before: s, after: "Un periodo per ogni idea: chi fa che cosa, poi le condizioni, poi le eccezioni.", why: `Obiettivo ${LX_TARGET_SENTENCE_LENGTH} parole per periodo.` });
  }

  // 2. Elenchi in prosa: (a) (b) (c) → elenco puntato.
  if (/\(a\)[\s\S]*\(b\)[\s\S]*\(c\)/i.test(text) || /\(i\)[\s\S]*\(ii\)[\s\S]*\(iii\)/i.test(text)) {
    out.push({ kind: "elenco", title: "Elenco nascosto nella prosa", before: "(a) … (b) … (c) … dentro un unico periodo", after: "Un elenco puntato, una voce per riga, con la frase introduttiva sopra.", why: "Le lettere in prosa costringono a tenere in mente tutto insieme: le righe separate no." });
  }

  // 3. Passivi: chi fa che cosa.
  const passives = text.match(/\b(è|sono|viene|vengono|venga|vengano|sarà|saranno|possono essere|può essere)\s+\w+(at[oaie]|ut[oaie]|it[oaie])\b/gi) ?? [];
  if (passives.length >= 2) {
    const sample = passives.slice(0, 3).join("», «");
    out.push({ kind: "attivo", title: `${passives.length} costruzioni passive`, before: `«${sample}»`, after: "Dire chi agisce: «noi conserviamo», «tu puoi revocare», «il fornitore riceve».", why: "Il passivo nasconde il soggetto: il lettore deve ricostruire chi fa che cosa." });
  }

  // 4. Nominalizzazioni.
  for (const [re, rep] of NOMINALS) {
    const m = text.match(re);
    if (m) {
      out.push({ kind: "nominale", title: "Sostantivo al posto del verbo", before: m[0], after: m[0].replace(re, rep), why: "Il verbo dice l'azione e chi la compie; il sostantivo astratto la nasconde." });
      if (out.filter((p) => p.kind === "nominale").length >= 2) break;
    }
  }

  // 5. Parole: glossario.
  let wordCount = 0;
  for (const [re, rep, why] of PLAIN_WORDS) {
    const m = text.match(re);
    if (m && wordCount < 6) {
      const before = m[0];
      const after = before.replace(new RegExp(re.source, re.flags.replace("g", "")), rep).trim();
      if (after.toLowerCase() !== before.toLowerCase()) {
        out.push({ kind: "parola", title: `«${before.trim()}» → «${after}»`, before: before.trim(), after, why });
        wordCount++;
      }
    }
  }

  // 6. Termini tecnici non definiti.
  const { undefinedTerms } = technicalTerms(text);
  for (const t of undefinedTerms.slice(0, 4)) {
    const def = DEFINITIONS[t] ?? Object.entries(DEFINITIONS).find(([k]) => t.startsWith(k) || k.startsWith(t))?.[1];
    out.push({ kind: "definisci", title: `Definire «${t}» alla prima occorrenza`, before: t, after: def ? `${t}, cioè ${def}` : `${t}, cioè … (definizione in una riga)`, why: "Un termine tecnico non definito è una porta chiusa: la distanza semantica sale." });
  }

  // 7. Rinvii normativi.
  if (lx.details.citations >= 3) {
    out.push({ kind: "rinvii", title: `${lx.details.citations} rinvii normativi nel corpo del testo`, before: "art. 6, par. 1, lett. b), GDPR … art. 9, par. 2, lett. a) …", after: "Nel corpo: «perché ce lo chiede il contratto» / «con il tuo consenso esplicito». I riferimenti in una nota a margine o tra parentesi a fine periodo.", why: "I rinvii sono per il giurista; la persona ha bisogno della ragione, non dell'articolo." });
  }

  // 8. Ordine: la conseguenza per il lettore arriva tardi.
  const firstNumberAt = text.search(/\b\d+\s*(mesi|anni|giorni|ore|s\b|%|euro)/i);
  if (firstNumberAt > text.length * 0.55) {
    out.push({ kind: "ordine", title: "La cifra che conta arriva tardi", before: `Il primo dato concreto (durata, importo) compare dopo il ${Math.round((firstNumberAt / text.length) * 100)}% del testo`, after: "Aprire con la conseguenza per chi legge: «Conserviamo i segnali per 24 mesi. Poi…», e mettere dopo le eccezioni.", why: "Chi legge cerca la risposta alla propria domanda: metterla prima riduce ritorni e tempo." });
  }

  // 9. Parole che l'archivio ha visto rallentare i lettori (modello appreso).
  const already = new Set(out.filter((p) => p.kind === "parola" || p.kind === "definisci").map((p) => p.before.toLowerCase()));
  for (const w of learnedWordsIn(text).filter((w) => ![...already].some((b) => b.includes(w.word))).slice(0, 3)) {
    const def = definitionFor(w.word);
    out.push({
      kind: "parola",
      title: `«${w.word}» rallenta i lettori (archivio)`,
      before: w.word,
      after: def ? `spiegarla alla prima occorrenza: «…, cioè ${def}»` : "sostituirla con una parola comune, o spiegarla alla prima occorrenza",
      why: `Nell'archivio del team le porzioni con «${w.word}» sono state lette più lentamente della media in ${w.sessions} sessioni (z tempo ${w.timeZ >= 0 ? "+" : ""}${w.timeZ.toFixed(1)}${w.bodyZ !== null ? `, z sforzo ${w.bodyZ >= 0 ? "+" : ""}${w.bodyZ.toFixed(1)}` : ""}).`,
    });
  }

  // Ordine: prima le strade che, nei dati del team, predicono di più la perdita del lettore.
  const order = roadOrder(learned);
  return out
    .map((p, i) => ({ p, i }))
    .sort((a, b) => order.indexOf(KIND_ROAD[a.p.kind]) - order.indexOf(KIND_ROAD[b.p.kind]) || a.i - b.i)
    .map(({ p }) => p);
}

/** Bozza automatica: solo le sostituzioni sicure e i periodi spezzati; rimisurata con lo stesso LX. */
export function autoDraft(clause: Clause): { text: string; before: number; after: number } | null {
  let text = clause.text;
  for (const [re, rep] of PLAIN_WORDS) text = text.replace(re, rep);
  for (const [re, rep] of NOMINALS) text = text.replace(re, rep);
  // Spezziamo i periodi lunghi, iterando finché conviene.
  const sentences = splitSentences(text);
  const rebuilt = sentences.map((s) => {
    let cur = s;
    const parts: string[] = [];
    for (let i = 0; i < 3; i++) {
      const sp = splitLongSentence(cur);
      if (!sp) break;
      parts.push(sp[0]);
      cur = sp[1];
    }
    parts.push(cur);
    return parts.join(" ");
  });
  const draft = fixSentenceStarts(rebuilt.map((s) => (/[.!?]$/.test(s) ? s : s + ".")).join(" "));
  const before = lxScore(clause.text).total;
  const after = lxScore(draft).total;
  if (draft === clause.text) return null;
  return { text: draft, before, after };
}

/** Interpretazione per clausola: ogni sensore letto insieme agli altri. */
export function interpret(m: ClauseMetrics, f: Friction): string[] {
  const out: string[] = [];
  const ind = f.indicators;
  const wpm = m.wordsPerMinute ? Math.round(m.wordsPerMinute) : null;
  if (ind.time && m.tooFastToRead) out.push(`Tempo: ${wpm} parole al minuto, oltre le 600 che permettono una lettura completa. La clausola è stata scorsa, non letta.`);
  else if (ind.time && m.returns >= 2) out.push(`Tempo: ${m.returns} ritorni sulla clausola. Chi legge è tornato a cercare qualcosa: un segnale di ordine o di chiarezza.`);
  else if (wpm) out.push(`Tempo: ${wpm} parole al minuto${wpm < 150 ? ", lettura lenta e attenta" : wpm < 300 ? ", ritmo di lettura normale" : ", lettura rapida"}${m.returns ? `, ${m.returns} ${m.returns === 1 ? "ritorno" : "ritorni"}` : ""}.`);
  if (m.effort.sampleCount > 0) {
    if (ind.body) out.push("Corpo: sforzo nel terzo più alto della sessione. Da solo non colora: dice che qui il carico è cresciuto, non che la clausola non è stata capita.");
    else out.push("Corpo: sforzo nella norma della sessione.");
    if (m.effort.motionArtifactRatio > 0.3) out.push(`Attenzione: ${Math.round(m.effort.motionArtifactRatio * 100)}% dei campioni con movimento della testa, esclusi; il dato corporeo qui è debole.`);
  }
  if (ind.text) out.push(`Testo: LX ${m.lx.total}, sopra la soglia ${lxThreshold()}. Nel corpus del libro, sopra questa soglia la comprensione non cala: crolla, per la maggioranza dei lettori.`);
  else out.push(`Testo: LX ${m.lx.total}, sotto la soglia ${lxThreshold()}: il testo, da solo, non spiega la frizione.`);
  if (m.verification.asked) out.push(ind.verify ? `Verifica: ${m.verification.correct}/${m.verification.asked} corrette. La comprensione dichiarata è mancata: è l'indizio che pesa di più.` : `Verifica: ${m.verification.correct}/${m.verification.asked} corrette.`);
  if (m.operational.asked) out.push(ind.operate ? `Prova operativa: ${m.operational.correct}/${m.operational.asked} riusciti. Chi doveva ritrovare questa clausola non l'ha trovata: un problema di ordine e di titoli.` : `Prova operativa: ${m.operational.correct}/${m.operational.asked} riusciti.`);
  if (m.operational.timesChosenWrongly) out.push(`Scelta per errore ${m.operational.timesChosenWrongly} ${m.operational.timesChosenWrongly === 1 ? "volta" : "volte"} al posto di un'altra: il titolo promette qualcosa che sta altrove.`);
  // Lettura d'insieme.
  if (f.level === "rosso") out.push("Insieme: gli indizi convergono, con almeno uno tra verifica e prova. Il difetto è del documento: intervenire qui per primo.");
  else if (f.level === "giallo") out.push(ind.verify || ind.operate ? "Insieme: un indizio forte da solo. Da verificare con altri lettori prima di riscrivere." : "Insieme: due indizi deboli convergono. Vale una revisione leggera.");
  else if (ind.time && m.tooFastToRead && m.verification.asked && !ind.verify) out.push("Insieme: letta in fretta ma capita: probabilmente una clausola nota o ripetitiva. Nessun intervento.");
  else out.push("Insieme: nessuna convergenza. La clausola scorre.");
  return out;
}

export function readClauses(clauses: Clause[], metrics: ClauseMetrics[], friction: Friction[]): ClauseReading[] {
  const rank = { rosso: 3, giallo: 2, verde: 1 } as const;
  const rows = metrics.map((m) => {
    const f = friction.find((x) => x.clauseId === m.clauseId)!;
    const c = clauses.find((x) => x.id === m.clauseId)!;
    const lead = ROADS.map((r) => ({ road: r.road, score: m.lx[r.key] })).sort((a, b) => b.score - a.score)[0];
    const light = f.level === "verde" && m.lx.total <= 35;
    return {
      clauseId: m.clauseId,
      index: m.index,
      heading: m.heading,
      level: f.level,
      interpretation: interpret(m, f),
      leadRoad: m.lx.total > 25 ? lead : null,
      proposals: light ? proposalsFor(c, m.lx).slice(0, 3) : proposalsFor(c, m.lx),
      draft: light ? null : autoDraft(c),
      priority: 0,
    };
  });
  const order = [...rows].sort((a, b) => {
    const fa = friction.find((x) => x.clauseId === a.clauseId)!, fb = friction.find((x) => x.clauseId === b.clauseId)!;
    return rank[fb.level] - rank[fa.level] || fb.count - fa.count || (metrics.find((m) => m.clauseId === b.clauseId)!.lx.total - metrics.find((m) => m.clauseId === a.clauseId)!.lx.total);
  });
  order.forEach((r, i) => (r.priority = i + 1));
  return rows;
}

/** Sintesi delle proposte a livello di documento: dove intervenire e quanto si guadagna. */
export function documentAdvice(readings: ClauseReading[]): string[] {
  const out: string[] = [];
  const first = [...readings].sort((a, b) => a.priority - b.priority).slice(0, 3);
  out.push(`Ordine di intervento: ${first.map((r) => `${r.index}${r.heading ? ` (${r.heading.replace(/^\d+[.)]\s*/, "")})` : ""}`).join(", poi ")}.`);
  const gains = readings.filter((r) => r.draft && r.draft.after < r.draft.before);
  if (gains.length) {
    const avg = Math.round(gains.reduce((s, r) => s + (r.draft!.before - r.draft!.after), 0) / gains.length);
    out.push(`Le sole sostituzioni automatiche (parole piane, periodi spezzati) abbassano l'LX in media di ${avg} punti su ${gains.length} clausole; ${readings.filter((r) => r.draft && r.draft.after <= lxThreshold() && r.draft.before > lxThreshold()).length} scenderebbero sotto la soglia.`);
  }
  const roads = readings.filter((r) => r.leadRoad).map((r) => r.leadRoad!.road);
  const top = ["lingua", "affollamento", "ordine", "distanza semantica"].map((road) => ({ road, n: roads.filter((x) => x === road).length })).sort((a, b) => b.n - a.n)[0];
  if (top && top.n) out.push(`La strada che pesa di più nel documento è ${top.road === "lingua" ? "la lingua: periodi lunghi e passivi" : top.road === "affollamento" ? "l'affollamento: troppi concetti giuridici nello stesso periodo" : top.road === "ordine" ? "l'ordine: incisi e rinvii interni" : "la distanza semantica: termini tecnici non definiti"} (${top.n} clausole su ${readings.length}).`);
  if (learned && learned.sessions > 0) {
    const roadName: Record<Road, string> = { syntactic: "la lingua", semantic: "la distanza semantica", structural: "l'ordine", conceptual: "l'affollamento" };
    const best = learned.roads.filter((r) => r.r !== null).sort((a, b) => (a.r as number) - (b.r as number))[0];
    const parts = [`Archivio del team: ${learned.sessions} ${learned.sessions === 1 ? "sessione" : "sessioni"} su ${learned.documents.length} ${learned.documents.length === 1 ? "documento" : "documenti"}`];
    if (learned.lx.source === "appreso") parts.push(`pesi LX ricalibrati (r ${learned.lx.r?.toFixed(2)} contro ${learned.lx.defaultR?.toFixed(2)} predefiniti), soglia ${learned.lx.threshold}`);
    else parts.push(`pesi LX predefiniti, ${(learned.lx.reason ?? "la ricalibrazione non migliora la correlazione").replace(/\.$/, "").replace(/^\w/, (c) => c.toLowerCase())}`);
    if (best && learned.sessions >= 5 && (best.r as number) < -0.2) parts.push(`la strada che più predice la perdita del lettore è ${roadName[best.road]} (r ${(best.r as number).toFixed(2)}): le proposte di quel tipo vengono prima`);
    if (learned.words.length) parts.push(`${learned.words.length} parole lente ricorrenti, segnalate dove compaiono`);
    out.push(parts.join("; ") + ".");
  }
  out.push("Le bozze automatiche sono un punto di partenza da rivedere da un giurista: misurano quanto si guadagna, non sostituiscono la riscrittura.");
  return out;
}
