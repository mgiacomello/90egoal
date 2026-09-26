// Primitive grafiche del fascicolo: la pagina come tavola del manoscritto.
//
// Carta, inchiostro, filetti sottili, cornice a doppio filetto, titoli in
// maiuscoletto spaziato, corpo in serif; grafici disegnati con rettangoli e
// linee, mai importati come immagini, così il PDF resta leggero, vettoriale
// e ricalcolabile. I caratteri standard di jsPDF coprono il Latin-1: i
// glifi fuori tabella (Δ, β, →, ≥) vengono trascritti.

import type { jsPDF } from "jspdf";

export const INK: [number, number, number] = [20, 19, 15];
export const INK_2: [number, number, number] = [58, 56, 51];
export const MUTED: [number, number, number] = [109, 106, 98];
export const HAIR: [number, number, number] = [150, 147, 140];
export const PAPER_2: [number, number, number] = [243, 241, 234];
export const OK: [number, number, number] = [12, 163, 12];
export const WARN: [number, number, number] = [250, 178, 25];
export const BAD: [number, number, number] = [208, 59, 59];
export const HEAT: [number, number, number][] = [[207, 224, 243], [236, 235, 231], [246, 196, 143], [229, 138, 74], [184, 67, 31]];

export const PAGE = { w: 210, h: 297, margin: 18, frame: 10 };

/** Trascrive i glifi che i caratteri standard del PDF non hanno. */
export function safe(text: string): string {
  return text
    .replace(/Δ/g, "d").replace(/β/g, "beta ").replace(/→/g, "->").replace(/≥/g, ">=").replace(/≤/g, "<=")
    .replace(/⊗/g, "x").replace(/♥/g, "HR").replace(/⚠/g, "!").replace(/×/g, "x").replace(/⁂/g, "*");
}

export function levelColor(level: string): [number, number, number] {
  return level === "rosso" ? BAD : level === "giallo" ? WARN : OK;
}

export class Page {
  y: number;
  readonly x0: number;
  readonly x1: number;
  readonly w: number;
  constructor(readonly pdf: jsPDF) {
    this.x0 = PAGE.margin;
    this.x1 = PAGE.w - PAGE.margin;
    this.w = this.x1 - this.x0;
    this.y = PAGE.margin + 6;
  }

  /** Va a pagina nuova se non c'è spazio per `need` mm. */
  ensure(need: number): void {
    if (this.y + need > PAGE.h - PAGE.margin - 6) this.newPage();
  }
  newPage(): void {
    this.pdf.addPage();
    this.y = PAGE.margin + 6;
  }
  gap(mm: number): void {
    this.y += mm;
  }

  /** Cornice a doppio filetto attorno alla pagina corrente. */
  frame(): void {
    const f = PAGE.frame;
    this.pdf.setDrawColor(...INK).setLineWidth(0.3);
    this.pdf.rect(f, f, PAGE.w - 2 * f, PAGE.h - 2 * f);
    this.pdf.setDrawColor(...HAIR).setLineWidth(0.15);
    this.pdf.rect(f + 1.6, f + 1.6, PAGE.w - 2 * f - 3.2, PAGE.h - 2 * f - 3.2);
  }

  /** Maiuscoletto spaziato, come i titoli delle tavole. */
  smallcaps(text: string, x = this.x0, y = this.y, size = 7.5, color: [number, number, number] = INK_2, align: "left" | "center" | "right" = "left"): void {
    this.pdf.setFont("helvetica", "normal").setFontSize(size).setTextColor(...color);
    this.pdf.text(safe(text).toUpperCase(), x, y, { charSpace: 0.9, align });
  }

  /** Titolo di sezione con il filetto corto centrato sotto, come nelle tavole. */
  section(text: string): void {
    this.ensure(18);
    this.smallcaps(text, this.x0, this.y, 8.5, INK);
    const tw = this.pdf.getTextWidth(safe(text).toUpperCase()) * 1.15;
    this.pdf.setDrawColor(...HAIR).setLineWidth(0.15);
    this.pdf.line(this.x0 + tw * 0.25, this.y + 2, this.x0 + tw * 0.75, this.y + 2);
    this.y += 9;
  }

  /** Titolo grande in serif. */
  title(text: string, size = 22): void {
    this.pdf.setFont("times", "normal").setFontSize(size).setTextColor(...INK);
    const lines = this.pdf.splitTextToSize(safe(text), this.w) as string[];
    for (const l of lines) {
      this.pdf.text(l, this.x0, this.y);
      this.y += size * 0.42;
    }
  }

  /** Paragrafo in serif. */
  p(text: string, size = 10, color: [number, number, number] = INK, gapAfter = 2.5, width = this.w, x = this.x0): void {
    this.pdf.setFont("times", "normal").setFontSize(size).setTextColor(...color);
    const lines = this.pdf.splitTextToSize(safe(text), width) as string[];
    for (const l of lines) {
      this.ensure(size * 0.5);
      this.pdf.text(l, x, this.y);
      this.y += size * 0.48;
    }
    this.y += gapAfter;
  }

  /** Didascalia in corsivo tra virgolette basse, centrata. */
  caption(text: string): void {
    this.pdf.setFont("times", "italic").setFontSize(9.5).setTextColor(...INK_2);
    const lines = this.pdf.splitTextToSize(`«${safe(text)}»`, this.w - 20) as string[];
    for (const l of lines) {
      this.ensure(5);
      this.pdf.text(l, PAGE.w / 2, this.y, { align: "center" });
      this.y += 4.6;
    }
    this.y += 2;
  }

  /** Riga «che cosa mostra, in parole semplici». */
  plain(text: string): void {
    this.ensure(14);
    this.pdf.setDrawColor(...HAIR).setLineWidth(0.15);
    this.pdf.line(this.x0, this.y, this.x1, this.y);
    this.y += 4.5;
    this.smallcaps("Che cosa mostra, in parole semplici", this.x0, this.y, 6.5, MUTED);
    this.y += 4.5;
    this.p(text, 9, INK_2, 4);
  }

  /** Elenco puntato in serif. */
  bullets(items: string[], size = 9.5): void {
    for (const it of items) {
      this.pdf.setFont("times", "normal").setFontSize(size).setTextColor(...INK);
      const lines = this.pdf.splitTextToSize(safe(it), this.w - 6) as string[];
      this.ensure(lines.length * size * 0.48 + 1);
      this.pdf.text("–", this.x0, this.y);
      for (const l of lines) {
        this.pdf.text(l, this.x0 + 5, this.y);
        this.y += size * 0.48;
      }
      this.y += 1.2;
    }
    this.y += 2;
  }

  /** Riga di tessere: etichetta in maiuscoletto, numero grande in serif, nota. */
  tiles(items: { label: string; value: string; note?: string }[]): void {
    const n = items.length;
    const tw = this.w / n;
    const h = 22;
    this.ensure(h + 4);
    this.pdf.setDrawColor(...INK).setLineWidth(0.25);
    this.pdf.line(this.x0, this.y, this.x1, this.y);
    this.pdf.line(this.x0, this.y + h, this.x1, this.y + h);
    items.forEach((it, i) => {
      const x = this.x0 + i * tw;
      if (i > 0) {
        this.pdf.setDrawColor(...HAIR).setLineWidth(0.15);
        this.pdf.line(x, this.y + 3, x, this.y + h - 3);
      }
      this.smallcaps(it.label, x + 3, this.y + 6, 6.5, MUTED);
      this.pdf.setFont("times", "normal").setFontSize(17).setTextColor(...INK);
      this.pdf.text(safe(it.value), x + 3, this.y + 14.5);
      if (it.note) {
        this.pdf.setFont("helvetica", "normal").setFontSize(6.5).setTextColor(...MUTED);
        this.pdf.text(safe(it.note), x + 3, this.y + 19.5);
      }
    });
    this.y += h + 6;
  }

  /** Riquadro «punto chiave» con bordo d'inchiostro. */
  keyBox(title: string, body: string, sub?: string): void {
    this.pdf.setFont("times", "normal").setFontSize(11.5);
    const lines = this.pdf.splitTextToSize(safe(body), this.w - 22) as string[];
    this.pdf.setFont("helvetica", "normal").setFontSize(8);
    const subLines = sub ? (this.pdf.splitTextToSize(safe(sub), this.w - 22) as string[]) : [];
    const h = 12 + lines.length * 5.5 + subLines.length * 4 + 4;
    this.ensure(h + 4);
    this.pdf.setDrawColor(...INK).setLineWidth(0.35);
    this.pdf.rect(this.x0, this.y, this.w, h);
    this.pdf.circle(this.x0 + 8, this.y + 8, 3.2);
    this.pdf.setFont("times", "normal").setFontSize(10).setTextColor(...INK);
    this.pdf.text("!", this.x0 + 8, this.y + 9.3, { align: "center" });
    this.smallcaps(title, this.x0 + 16, this.y + 6, 6.5, MUTED);
    let yy = this.y + 12;
    this.pdf.setFont("times", "normal").setFontSize(11.5).setTextColor(...INK);
    for (const l of lines) {
      this.pdf.text(l, this.x0 + 16, yy);
      yy += 5.5;
    }
    this.pdf.setFont("helvetica", "normal").setFontSize(8).setTextColor(...INK_2);
    for (const l of subLines) {
      this.pdf.text(l, this.x0 + 16, yy);
      yy += 4;
    }
    this.y += h + 6;
  }

  /** Tabella «meta»: coppie etichetta/valore su due colonne. */
  meta(rows: [string, string][]): void {
    const colW = this.w / 2;
    const rowH = 7;
    const n = Math.ceil(rows.length / 2);
    this.ensure(n * rowH + 4);
    rows.forEach(([k, v], i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = this.x0 + col * colW;
      const y = this.y + row * rowH;
      this.pdf.setDrawColor(...HAIR).setLineWidth(0.12);
      this.pdf.line(x, y + rowH - 1.5, x + colW - 6, y + rowH - 1.5);
      this.smallcaps(k, x, y + 3, 6, MUTED);
      this.pdf.setFont("times", "normal").setFontSize(9.5).setTextColor(...INK);
      const val = this.pdf.splitTextToSize(safe(v), colW - 6 - 30)[0] as string;
      this.pdf.text(val, x + 30, y + 3.4);
    });
    this.y += n * rowH + 4;
  }

  /**
   * La mappa di Snow: una riga per clausola, i trattini dove chi legge si
   * perde. `marks` = quanti trattini per clausola.
   */
  snowMap(rows: { index: number; heading: string | null; level: string; marks: number; label?: string }[]): void {
    const rowH = 9;
    const top = 6;
    const h = top * 2 + rows.length * rowH;
    this.ensure(h + 6);
    const x0 = this.x0 + 8, x1 = this.x1 - 2;
    this.pdf.setDrawColor(...INK).setLineWidth(0.3);
    this.pdf.rect(this.x0, this.y, this.w, h);
    let seed = 7;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    const g = () => (rnd() + rnd() + rnd() - 1.5) / 1.5;
    rows.forEach((r, i) => {
      const y = this.y + top + i * rowH + rowH / 2;
      const c = levelColor(r.level);
      this.pdf.setDrawColor(...c).setLineWidth(r.level === "rosso" ? 0.7 : r.level === "giallo" ? 0.5 : 0.3);
      this.pdf.line(x0 + 4, y, x1 - 26, y);
      this.pdf.setFont("helvetica", "normal").setFontSize(6.5).setTextColor(...MUTED);
      this.pdf.text(String(r.index), x0, y + 0.8, { align: "right" });
      const head = r.heading ? this.pdf.splitTextToSize(safe(r.heading), 70)[0] : "";
      this.pdf.setFont("times", "italic").setFontSize(7).setTextColor(...INK_2);
      this.pdf.text(head as string, x0 + 4, y - 1.6);
      this.pdf.setFont("helvetica", "normal").setFontSize(5.5).setTextColor(...c);
      this.pdf.text(safe(r.label ?? r.level).toUpperCase(), x1 - 24, y + 0.7, { charSpace: 0.5 });
      this.pdf.setDrawColor(...INK).setLineWidth(0.35);
      for (let k = 0; k < r.marks; k++) {
        const cx = x0 + 4 + (x1 - 26 - x0 - 4) * (0.45 + g() * (0.12 + 0.05 * Math.min(1, r.marks / 20)));
        const cy = y + g() * 2.4;
        const a = (rnd() - 0.5) * 1.2;
        this.pdf.line(cx - 1.1 * Math.cos(a), cy - 1.1 * Math.sin(a), cx + 1.1 * Math.cos(a), cy + 1.1 * Math.sin(a));
      }
    });
    this.y += h + 4;
  }

  /**
   * Cruscotto per clausola: per ogni riga, barre affiancate (tempo vs
   * plausibile, LX vs soglia, sforzo) e segni di verifica/prova.
   */
  clauseBoard(rows: {
    index: number; heading: string | null; dwellMs: number; plausibleMs: number; tooFast: boolean;
    lx: number; lxThreshold: number; verify: string; operate: string; effort: number | null; effortMax: number; level: string;
  }[]): void {
    const rowH = 7.5;
    const headH = 7;
    const colHead = this.x0, colTime = this.x0 + 52, colLx = this.x0 + 108, colVo = this.x0 + 146, colEff = this.x0 + 158;
    const wTime = 50, wLx = 34, wEff = this.x1 - colEff;
    this.ensure(headH + rows.length * rowH + 8);
    this.pdf.setDrawColor(...INK).setLineWidth(0.25);
    this.pdf.line(this.x0, this.y + headH - 2, this.x1, this.y + headH - 2);
    this.smallcaps("Clausola", colHead, this.y + 2.5, 6, MUTED);
    this.smallcaps("Tempo vs. plausibile", colTime, this.y + 2.5, 6, MUTED);
    this.smallcaps("LX e soglia", colLx, this.y + 2.5, 6, MUTED);
    this.smallcaps("V · P", colVo, this.y + 2.5, 6, MUTED);
    if (wEff > 10) this.smallcaps("Sforzo", colEff, this.y + 2.5, 6, MUTED);
    this.y += headH;
    const maxTime = Math.max(...rows.map((r) => Math.max(r.dwellMs, r.plausibleMs)), 1);
    rows.forEach((r) => {
      const yb = this.y + 1.2, bh = 3.4;
      const c = levelColor(r.level);
      this.pdf.setFillColor(...c);
      this.pdf.circle(colHead + 1.5, yb + bh / 2, 1.1, "F");
      this.pdf.setFont("times", "normal").setFontSize(8).setTextColor(...INK);
      const name = this.pdf.splitTextToSize(`${r.index}. ${safe(r.heading ?? "")}`, 46)[0] as string;
      this.pdf.text(name, colHead + 4, yb + 2.8);
      // tempo: barra piena = tempo reale; tacca = tempo plausibile a 250 wpm
      this.pdf.setFillColor(...PAPER_2);
      this.pdf.rect(colTime, yb, wTime, bh, "F");
      this.pdf.setFillColor(...(r.tooFast ? BAD : INK_2));
      this.pdf.rect(colTime, yb, (r.dwellMs / maxTime) * wTime, bh, "F");
      const px = colTime + (r.plausibleMs / maxTime) * wTime;
      this.pdf.setDrawColor(...INK).setLineWidth(0.4);
      this.pdf.line(px, yb - 0.8, px, yb + bh + 0.8);
      this.pdf.setFont("helvetica", "normal").setFontSize(5.5).setTextColor(...MUTED);
      this.pdf.text(`${(r.dwellMs / 1000).toFixed(0)} s`, colTime + wTime + 1.5, yb + 2.7);
      // LX: barra 0-100 con soglia
      this.pdf.setFillColor(...PAPER_2);
      this.pdf.rect(colLx, yb, wLx, bh, "F");
      this.pdf.setFillColor(...(r.lx > r.lxThreshold ? BAD : OK));
      this.pdf.rect(colLx, yb, (Math.min(100, r.lx) / 100) * wLx, bh, "F");
      const tx = colLx + (r.lxThreshold / 100) * wLx;
      this.pdf.setDrawColor(...INK).setLineWidth(0.4);
      this.pdf.line(tx, yb - 0.8, tx, yb + bh + 0.8);
      this.pdf.setFont("helvetica", "normal").setFontSize(5.5).setTextColor(...MUTED);
      this.pdf.text(String(r.lx), colLx + wLx + 1.5, yb + 2.7);
      // verifica / prova
      this.pdf.setFont("helvetica", "normal").setFontSize(6.5).setTextColor(...INK_2);
      this.pdf.text(`${r.verify} · ${r.operate}`, colVo, yb + 2.7);
      // sforzo: barra divergente attorno allo zero
      if (wEff > 10 && r.effort !== null && r.effortMax > 0) {
        const mid = colEff + wEff / 2;
        this.pdf.setDrawColor(...HAIR).setLineWidth(0.15);
        this.pdf.line(mid, yb - 0.5, mid, yb + bh + 0.5);
        const len = (Math.abs(r.effort) / r.effortMax) * (wEff / 2 - 1);
        this.pdf.setFillColor(...(r.effort >= 0 ? ([192, 101, 58] as [number, number, number]) : ([79, 127, 176] as [number, number, number])));
        this.pdf.rect(r.effort >= 0 ? mid : mid - len, yb, len, bh, "F");
      }
      this.pdf.setDrawColor(...HAIR).setLineWidth(0.1);
      this.pdf.line(this.x0, this.y + rowH - 0.6, this.x1, this.y + rowH - 0.6);
      this.y += rowH;
    });
    this.y += 4;
  }

  /** Grafico a punti con barre d'errore: β per clausola, ± errore standard. */
  errorBars(rows: { index: number; value: number; se: number; level: string }[], unit: string): void {
    const h = 40;
    this.ensure(h + 12);
    const x0 = this.x0 + 14, x1 = this.x1 - 4;
    const max = Math.max(...rows.map((r) => Math.abs(r.value) + r.se), 1e-6);
    const yMid = this.y + h / 2;
    const scale = (h / 2 - 4) / max;
    this.pdf.setDrawColor(...HAIR).setLineWidth(0.15);
    this.pdf.line(x0, yMid, x1, yMid);
    this.pdf.setFont("helvetica", "normal").setFontSize(5.5).setTextColor(...MUTED);
    this.pdf.text(`+${max.toFixed(3)} ${unit}`, x0 - 2, this.y + 4, { align: "right" });
    this.pdf.text(`-${max.toFixed(3)} ${unit}`, x0 - 2, this.y + h - 1, { align: "right" });
    this.pdf.text("0", x0 - 2, yMid + 1, { align: "right" });
    const step = (x1 - x0) / rows.length;
    rows.forEach((r, i) => {
      const x = x0 + step * (i + 0.5);
      const y = yMid - r.value * scale;
      this.pdf.setDrawColor(...INK).setLineWidth(0.3);
      this.pdf.line(x, y - r.se * scale, x, y + r.se * scale);
      this.pdf.line(x - 1, y - r.se * scale, x + 1, y - r.se * scale);
      this.pdf.line(x - 1, y + r.se * scale, x + 1, y + r.se * scale);
      this.pdf.setFillColor(...levelColor(r.level));
      this.pdf.circle(x, y, 1.2, "F");
      this.pdf.setFont("helvetica", "normal").setFontSize(6).setTextColor(...MUTED);
      this.pdf.text(String(r.index), x, this.y + h + 3.5, { align: "center" });
    });
    this.y += h + 8;
  }

  /** Testo con evidenziazione parola per parola: ogni porzione ha il suo livello di calore. */
  heatText(segments: { text: string; heat: number | null; msPerWord: number | null }[], size = 9.5): void {
    const lineH = size * 0.55;
    let x = this.x0;
    this.ensure(lineH * 2);
    this.pdf.setFont("times", "normal").setFontSize(size);
    const space = this.pdf.getTextWidth(" ");
    for (const seg of segments) {
      for (const word of safe(seg.text).split(/\s+/).filter(Boolean)) {
        const ww = this.pdf.getTextWidth(word);
        if (x + ww > this.x1) {
          x = this.x0;
          this.y += lineH;
          this.ensure(lineH);
        }
        if (seg.heat !== null && seg.heat > 0) {
          const c = HEAT[Math.min(4, seg.heat)];
          this.pdf.setFillColor(...c);
          this.pdf.rect(x - 0.3, this.y - size * 0.32, ww + 0.6, size * 0.44, "F");
        }
        this.pdf.setTextColor(...(seg.heat === 4 ? ([255, 255, 255] as [number, number, number]) : seg.heat === null ? MUTED : INK));
        this.pdf.text(word, x, this.y);
        x += ww + space;
      }
    }
    this.y += lineH + 2;
  }

  /** Piè di pagina su tutte le pagine: titolo corrente e numerazione. */
  footerAll(left: string): void {
    const n = this.pdf.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      this.pdf.setPage(i);
      this.pdf.setDrawColor(...HAIR).setLineWidth(0.15);
      this.pdf.line(this.x0, PAGE.h - PAGE.margin + 2, this.x1, PAGE.h - PAGE.margin + 2);
      this.pdf.setFont("helvetica", "normal").setFontSize(6.5).setTextColor(...MUTED);
      let label = safe(left).toUpperCase();
      while (label.length > 8 && this.pdf.getTextWidth(label) * 1.25 > this.w - 24) label = label.slice(0, -2).trimEnd() + "…";
      this.pdf.text(label, this.x0, PAGE.h - PAGE.margin + 6, { charSpace: 0.6 });
      this.pdf.text(`${i} / ${n}`, this.x1, PAGE.h - PAGE.margin + 6, { align: "right" });
    }
  }
}
