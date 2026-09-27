// Stima euristica dell'LX Complexity Score per clausola.
//
// Fonti: M. Giacomello, "Progettare la comprensione del diritto", in
// Mente e Tecnologia – BCI (Springer, 2026), pp. 145-147, e Habeas Mentem
// (master v37), capitolo "La cartografia della comprensione". Il punteggio
// opera su scala 0/100 (valori crescenti = più frizione) e scompone la
// frizione in quattro strade: la lingua (densità sintattica), l'affollamento
// (quanti concetti giuridici il testo pretende di tenere in mente insieme),
// l'ordine (dove stanno le cose e quando arrivano) e la distanza semantica
// (termini tecnici travestiti da italiano di tutti i giorni). La soglia
// sperimentale di accessibilità è 45/100.
//
// Le formule sono calibrate sui valori del corpus BCI riportati nel libro:
// 41 parole per frase (obiettivo 22), 3,8 subordinate per periodo, 68% di
// passive → densità sintattica 72; 34 termini tecnici nelle prime 600
// parole, 56% senza definizione → distanza semantica 68. Un testo con quei
// valori ottiene qui gli stessi punteggi. Resta una stima di superficie,
// calcolata nel browser: non è il modello NLC calibrato su EEG/fNIRS.

export interface LxScore {
  /** Lunghezza dei periodi, subordinate per periodo, costruzioni passive. */
  syntactic: number;
  /** Lessico tecnico non glossato rispetto al vocabolario dell'adulto non specialista. */
  semantic: number;
  /** L'ordine: incisi, parentesi, rinvii interni che spostano le cose altrove. */
  structural: number;
  /** L'affollamento: quanti concetti giuridici distinti (termini tecnici, rinvii normativi, voci di elenco) lo stesso periodo pretende di tenere in mente insieme. */
  conceptual: number;
  /** Media pesata: le due componenti principali del libro pesano di più. */
  total: number;
  details: {
    sentences: number;
    avgSentenceLength: number;
    subordinatesPerSentence: number;
    passiveRatio: number;
    technicalTermsPer600: number;
    undefinedShare: number;
    technicalTerms: number;
    undefinedTerms: number;
    citations: number;
    parentheticals: number;
    /** Concetti distinti per periodo, in media e nel periodo più affollato. */
    conceptsPerSentence: number;
    maxConceptsInSentence: number;
  };
}

export const LX_ACCESSIBILITY_THRESHOLD = 45;

/** Pesi delle quattro strade nel totale LX, come nel libro. */
export interface LxWeightSet { syntactic: number; semantic: number; structural: number; conceptual: number }
export const LX_DEFAULT_WEIGHTS: LxWeightSet = { syntactic: 0.35, semantic: 0.35, structural: 0.15, conceptual: 0.15 };

// Il modello appreso dall'archivio (learning.ts) può sostituire pesi e soglia:
// il laboratorio lo carica all'avvio e da quel momento ogni punteggio e ogni
// indizio "testo" lo usano. Senza archivio restano i valori del libro.
let activeWeights: LxWeightSet = LX_DEFAULT_WEIGHTS;
let activeThreshold = LX_ACCESSIBILITY_THRESHOLD;
let activeSource: "predefinito" | "appreso" = "predefinito";

export function setLxModel(model: { weights: LxWeightSet; threshold: number; source?: "predefinito" | "appreso" } | null): void {
  activeWeights = model?.weights ?? LX_DEFAULT_WEIGHTS;
  activeThreshold = model?.threshold ?? LX_ACCESSIBILITY_THRESHOLD;
  activeSource = model ? (model.source ?? "appreso") : "predefinito";
}
/** Soglia di accessibilità in vigore (predefinita 45, o appresa dall'archivio). */
export function lxThreshold(): number { return activeThreshold; }
export function lxWeights(): LxWeightSet { return activeWeights; }
export function lxSource(): "predefinito" | "appreso" { return activeSource; }
/** Valore-obiettivo di accessibilità: parole per frase (libro, p. 146). */
export const LX_TARGET_SENTENCE_LENGTH = 22;

// Valori medi del corpus BCI (libro, pp. 146-147), usati come punti di calibrazione.
const CORPUS = { sentenceLength: 41, subordinates: 3.8, passiveRatio: 0.68, termsPer600: 34, undefinedShare: 0.56 };

const SUBORDINATE = /\b(che|qualora|ove|purché|salvo|fermo restando|nella misura in cui|a condizione che|previo|previa|ivi inclus[oaie]|nonché|ovvero|ancorché|sebbene|laddove|allorché|qualsiasi|qualunque)(?![a-zà-ù])/gi;
const PASSIVE = /\b(è|sono|viene|vengono|venga|vengano|sarà|saranno|essere|stato|stata|stati|state|potrà essere|possono essere)\s+\w+(at[oaie]|ut[oaie]|it[oaie]|os[oaie]|ess[oaie])\b/gi;
const CITATION = /\b(art\.|artt\.|par\.|lett\.|comma|d\.lgs\.|reg\.\s?\(ue\)|regolamento\s?\(ue\)|gdpr|direttiva|decreto|linee guida)\b/gi;
const PARENTHETICAL = /\([^)]*\)/g;
const INTERNAL_REF = /\b(di cui al|di cui alla|di cui all|ai sensi del|ai sensi dell|punto \d|lettera \(|sub \(|successiv[oaie]|precedent[ei])\b/gi;

/** Lessico giuridico-tecnico: dizionario di superficie, estendibile. */
export const TECHNICAL_TERMS = [
  "titolare del trattamento", "responsabile del trattamento", "interessato", "base giuridica", "legittimo interesse",
  "pseudonimizzazione", "pseudonimizzat", "anonimizz", "profilazione", "processo decisionale automatizzato",
  "clausole contrattuali standard", "decisione di adeguatezza", "trasferimento", "paesi terzi", "portabilità",
  "limitazione del trattamento", "revoca", "reclamo", "autorità di controllo", "dati relativi alla salute",
  "dati biometrici", "categorie particolari", "licenza", "sublicenziabile", "opere derivate", "recesso", "disdetta",
  "rinnovo automatico", "foro competente", "legge applicabile", "consumatore", "dolo", "colpa grave",
  "responsabilità", "consequenzial", "inderogabil", "cookie", "local storage", "pixel", "identificativ",
  "fnirs", "eeg", "emodinamic", "vicino infrarosso", "inerziali", "algoritm", "apprendimento automatico",
  "modelli", "inferenz", "corteccia prefrontale", "stato attentivo", "attivazione", "classificazione", "predittiv",
];

function count(re: RegExp, text: string): number {
  return (text.match(re) ?? []).length;
}

function clamp(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}

export function splitSentences(text: string): string[] {
  return text
    .replace(/\b(art|artt|par|lett|d|lgs|n|p|s|r|l|es|cfr)\./gi, (m) => m.replace(".", "§"))
    // Il periodo finisce al punto: gli elenchi con ";" restano un solo periodo, come li legge una persona.
    .split(/[.!?]+\s+|\n+/)
    .map((s) => s.replace(/§/g, ".").trim())
    .filter((s) => s.split(/\s+/).length >= 3);
}

/** Termini tecnici presenti e, tra questi, quelli mai definiti ("ossia", "cioè", virgolette, parentesi). */
export function technicalTerms(text: string): { found: string[]; undefinedTerms: string[] } {
  const lower = text.toLowerCase();
  const present = TECHNICAL_TERMS.filter((t) => lower.includes(t));
  // "pseudonimizzat" e "pseudonimizzazione" sono lo stesso termine: teniamo il più lungo.
  const found = present.filter((t) => !present.some((o) => o !== t && o.includes(t)));
  const definedNear = (t: string) => {
    const i = lower.indexOf(t);
    const window = lower.slice(Math.max(0, i - 40), i + t.length + 120);
    // \b non funziona dopo le accentate ("cioè"): usiamo un lookahead esplicito.
    return /\b(ossia|cioè|vale a dire|intes[oaie] come|si intende|definit[oaie])(?![a-zà-ù])|[("«]/.test(window);
  };
  return { found, undefinedTerms: found.filter((t) => !definedNear(t)) };
}

export function lxScore(text: string): LxScore {
  const words = text.split(/\s+/).filter(Boolean);
  const wordCount = Math.max(words.length, 1);
  const sentences = splitSentences(text);
  const sentenceCount = Math.max(sentences.length, 1);
  const avgSentenceLength = wordCount / sentenceCount;
  const subordinatesPerSentence = count(SUBORDINATE, text) / sentenceCount;
  const passiveRatio = Math.min(1, count(PASSIVE, text) / sentenceCount);
  const citations = count(CITATION, text);
  const parentheticals = count(PARENTHETICAL, text);
  const internalRefs = count(INTERNAL_REF, text);
  const { found, undefinedTerms } = technicalTerms(text);
  const technicalTermsPer600 = (found.length / wordCount) * 600;
  const undefinedShare = found.length ? undefinedTerms.length / found.length : 0;

  // Densità sintattica: 60 punti dalla lunghezza dei periodi (0 a 10 parole,
  // 60 a 41), 8 dalle subordinate, 4 dalle passive → 72 sui valori del corpus.
  const syntactic = clamp(
    ((avgSentenceLength - 10) / (CORPUS.sentenceLength - 10)) * 60 +
      (subordinatesPerSentence / CORPUS.subordinates) * 8 +
      (passiveRatio / CORPUS.passiveRatio) * 4,
  );
  // Distanza semantica: 40 punti dalla densità di termini tecnici, 28 dalla
  // quota non definita → 68 sui valori del corpus.
  const semantic = clamp((technicalTermsPer600 / CORPUS.termsPer600) * 40 + (undefinedShare / CORPUS.undefinedShare) * 28);
  // L'ordine: incisi e rinvii interni per 100 parole.
  const structural = clamp(((parentheticals + internalRefs) / wordCount) * 100 * 14 + (avgSentenceLength > 35 ? 15 : 0));
  // L'affollamento (Habeas Mentem, «le quattro dimensioni»): «quanti concetti
  // giuridici diversi il testo pretende che teniate in mente nello stesso
  // momento»; «un periodo può essere grammaticalmente limpido e pretendere
  // cinque istituti in tre righe». Per ogni periodo si contano i concetti
  // distinti: termini tecnici, rinvii normativi, voci di elenco. Cinque per
  // periodo in media valgono 70 punti; il periodo più affollato aggiunge fino
  // a 30 (otto concetti).
  const ENUM_ITEM = /\(([a-z]|[ivx]+)\)/gi;
  const perSentence = (sentences.length ? sentences : [text]).map((st) => {
    const terms = new Set(technicalTerms(st).found.map((t) => t.toLowerCase()));
    return terms.size + count(CITATION, st) + count(ENUM_ITEM, st);
  });
  const conceptsPerSentence = perSentence.reduce((a, b) => a + b, 0) / Math.max(1, perSentence.length);
  const maxConceptsInSentence = Math.max(0, ...perSentence);
  const conceptual = clamp((conceptsPerSentence / 5) * 70 + (maxConceptsInSentence / 8) * 30);

  const w = activeWeights;
  const total = clamp(syntactic * w.syntactic + semantic * w.semantic + structural * w.structural + conceptual * w.conceptual);
  return {
    syntactic, semantic, structural, conceptual, total,
    details: {
      sentences: sentences.length,
      avgSentenceLength: Math.round(avgSentenceLength * 10) / 10,
      subordinatesPerSentence: Math.round(subordinatesPerSentence * 10) / 10,
      passiveRatio: Math.round(passiveRatio * 100) / 100,
      technicalTermsPer600: Math.round(technicalTermsPer600),
      undefinedShare: Math.round(undefinedShare * 100) / 100,
      technicalTerms: found.length,
      undefinedTerms: undefinedTerms.length,
      citations, parentheticals,
      conceptsPerSentence: Math.round(conceptsPerSentence * 10) / 10,
      maxConceptsInSentence,
    },
  };
}
