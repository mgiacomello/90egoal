// Stima euristica dell'LX Complexity Score per clausola.
//
// Il modello Neuro Legal Cortex / Glint scompone la frizione in quattro
// dimensioni: complessità linguistica, densità concettuale, struttura
// informativa, distanza semantica. Qui ne diamo una stima di superficie,
// calcolabile nel browser senza modelli, per affiancare al tempo e al corpo
// un terzo indizio: il testo stesso. Non è il punteggio calibrato del
// programma NLC (pesi e soglie validati su EEG/fNIRS): è una prima lettura.
//
// Scala 0-100 per dimensione e per il totale; sopra 45 la soglia
// sperimentale di accessibilità citata nel cap. 7.

export interface LxScore {
  /** Lunghezza dei periodi, subordinate, passivi. */
  linguistic: number;
  /** Termini tecnici e rinvii normativi per 100 parole. */
  conceptual: number;
  /** Elenchi annidati, incisi, parentesi, rinvii interni. */
  structural: number;
  /** Termini tecnici usati senza una definizione nel testo. */
  semantic: number;
  /** Media pesata delle quattro dimensioni. */
  total: number;
  details: {
    sentences: number;
    avgSentenceLength: number;
    subordinateMarkers: number;
    passives: number;
    technicalTerms: number;
    undefinedTerms: number;
    citations: number;
    parentheticals: number;
  };
}

export const LX_ACCESSIBILITY_THRESHOLD = 45;

const SUBORDINATE = /\b(che|qualora|ove|purché|salvo|fermo restando|nella misura in cui|a condizione che|previo|previa|ivi inclus[oaie]|nonché|ovvero|ancorché|sebbene|laddove|allorché)(?![a-zà-ù])/gi;
const PASSIVE = /\b(è|sono|viene|vengono|venga|vengano|sarà|saranno|essere|stato|stata|stati|state)\s+\w+(at[oaie]|ut[oaie]|it[oaie]|os[oaie]|ess[oaie])\b/gi;
const CITATION = /\b(art\.|artt\.|par\.|lett\.|comma|d\.lgs\.|reg\.\s?\(ue\)|regolamento\s?\(ue\)|gdpr|direttiva|decreto)\b/gi;
const PARENTHETICAL = /\([^)]*\)|\b\([ivx]+\)|\bsub\s\([ivx]+\)/gi;

/** Lessico giuridico-tecnico: un dizionario di superficie, estendibile. */
export const TECHNICAL_TERMS = [
  "titolare del trattamento", "responsabile del trattamento", "interessato", "base giuridica", "legittimo interesse",
  "pseudonimizzazione", "pseudonimizzat", "anonimizz", "profilazione", "processo decisionale automatizzato",
  "clausole contrattuali standard", "decisione di adeguatezza", "trasferimento", "paesi terzi", "portabilità",
  "limitazione del trattamento", "revoca", "reclamo", "autorità di controllo", "dati relativi alla salute",
  "dati biometrici", "categorie particolari", "licenza", "sublicenziabile", "opere derivate", "recesso", "disdetta",
  "rinnovo automatico", "foro competente", "legge applicabile", "consumatore", "dolo", "colpa grave",
  "responsabilità", "consequenzial", "inderogabil", "cookie", "profilazione", "local storage", "pixel", "identificativ",
  "fnirs", "eeg", "emodinamic", "vicino infrarosso", "inerziali", "algoritm", "apprendimento automatico",
  "modelli", "inferenz", "corteccia prefrontale", "stato attentivo", "attivazione",
];

function count(re: RegExp, text: string): number {
  return (text.match(re) ?? []).length;
}

function clamp(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\b(art|artt|par|lett|d|lgs|n|p|s|r|l|es|cfr)\./gi, (m) => m.replace(".", "§"))
    // Il periodo finisce al punto: gli elenchi con ";" restano un solo periodo, come li legge una persona.
    .split(/[.!?]+\s+|\n+/)
    .map((s) => s.replace(/§/g, ".").trim())
    .filter((s) => s.split(/\s+/).length >= 3);
}

/** Termini tecnici presenti e, tra questi, quelli mai definiti ("ossia", "cioè", virgolette, parentesi). */
function technicalTerms(text: string): { found: string[]; undefinedTerms: string[] } {
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
  const avgSentenceLength = sentences.length ? wordCount / sentences.length : wordCount;
  const subordinateMarkers = count(SUBORDINATE, text);
  const passives = count(PASSIVE, text);
  const citations = count(CITATION, text);
  const parentheticals = count(PARENTHETICAL, text);
  const { found, undefinedTerms } = technicalTerms(text);
  const per100 = (n: number) => (n / wordCount) * 100;

  // Linguistica: 15 parole/frase ≈ 0, 45 ≈ 100; subordinate e passivi aggiungono.
  const linguistic = clamp(((avgSentenceLength - 15) / 30) * 70 + per100(subordinateMarkers) * 6 + per100(passives) * 8);
  // Concettuale: densità di termini tecnici e rinvii normativi.
  const conceptual = clamp(per100(found.length) * 12 + per100(citations) * 10);
  // Strutturale: incisi, parentesi, elenchi lettera/numero, rinvii interni.
  const internalRefs = count(/\b(di cui al|di cui alla|ai sensi del|ai sensi dell|punto \d|lettera \(|sub \()/gi, text);
  const structural = clamp(per100(parentheticals) * 9 + per100(internalRefs) * 12 + (avgSentenceLength > 35 ? 15 : 0));
  // Semantica: quota di termini tecnici senza definizione operativa.
  const semantic = clamp(found.length ? (undefinedTerms.length / found.length) * 70 + per100(undefinedTerms.length) * 6 : 0);

  const total = clamp(linguistic * 0.3 + conceptual * 0.25 + structural * 0.2 + semantic * 0.25);
  return {
    linguistic, conceptual, structural, semantic, total,
    details: {
      sentences: sentences.length,
      avgSentenceLength: Math.round(avgSentenceLength * 10) / 10,
      subordinateMarkers, passives,
      technicalTerms: found.length,
      undefinedTerms: undefinedTerms.length,
      citations, parentheticals,
    },
  };
}
