import { formatEuro } from './reconcile.ts'
import { CHANNEL_LABEL, type SourceKey } from './types.ts'

/**
 * Il brief come arriva nella posta. Funzione pura: niente rete.
 *
 * Una cosa che vale la pena dire forte, perché è facile fare il
 * contrario senza accorgersene: **questa mail non viene generata.**
 * Il modello ha già scritto il brief, e ogni riga è già passata dal
 * verificatore delle citazioni. Qui si formatta e basta.
 *
 * Se la mail passasse da un secondo giro di modello — "riscrivimelo
 * in forma di email" — potrebbe dire cose che il brief verificato non
 * dice, e la garanzia costruita a monte varrebbe zero proprio nel
 * punto in cui esce di casa. Le fonti restano attaccate a ogni riga
 * per lo stesso motivo: la mail non deve essere un artefatto meno
 * affidabile della console.
 *
 * Nota sull'import con estensione: `./reconcile.ts` non è un refuso.
 * Il runner dei test gira su Node con ESM nativo, che vuole
 * l'estensione esplicita; `allowImportingTsExtensions` in tsconfig la
 * rende legale e il bundler la risolve. Senza, questo file avrebbe
 * dovuto riscriversi in casa la formattazione degli importi — per la
 * terza volta.
 */

export type MailSource = {
  source: SourceKey
  title: string
  occurredAt: string
  url: string | null
}

export type MailClaim = {
  text: string
  unverified?: string[]
  sources: MailSource[]
}

export type MailPoint = {
  text: string
  openedAt: string
  age: 'nuovo' | 'in attesa' | 'fermo'
}

export type MailBrief = {
  generatedAt: string
  oggi: MailClaim[]
  novita: MailClaim[]
  puntiAperti: MailPoint[]
  conto: { missing: number; missingCents: number; resolvable: number } | null
}

function day(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

function ageDays(iso: string): number {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return 0
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000))
}

/**
 * Vale la pena svegliare qualcuno per questo?
 *
 * Una mail che arriva ogni mattina per dire "niente di nuovo" viene
 * archiviata senza leggerla entro una settimana, e da lì in poi non
 * verrà letta nemmeno quella che conta. Quindi si tace, e il silenzio
 * diventa a sua volta un'informazione.
 *
 * I punti aperti da soli non bastano a giustificarla: quelli sono
 * sempre lì per definizione. Ci vuole almeno un punto **fermo**, cioè
 * qualcosa che stai rimandando da più di due settimane.
 */
export function isWorthSending(brief: MailBrief): boolean {
  if (brief.oggi.length || brief.novita.length) return true
  if (brief.conto && brief.conto.missing > 0) return true
  return brief.puntiAperti.some((p) => p.age === 'fermo')
}

function subjectOf(brief: MailBrief): string {
  const parts: string[] = []
  if (brief.oggi.length) parts.push(`${brief.oggi.length} in agenda`)
  if (brief.novita.length) parts.push(`${brief.novita.length} da guardare`)

  const fermi = brief.puntiAperti.filter((p) => p.age === 'fermo').length
  if (fermi) parts.push(`${fermi} fermo${fermi === 1 ? '' : 'i'} da tempo`)
  if (brief.conto?.missing) parts.push(`${brief.conto.missing} senza fattura`)

  return parts.length ? `Brief · ${parts.join(', ')}` : 'Brief'
}

/* --- testo semplice --- */

function claimText(claim: MailClaim): string {
  const refs = claim.sources
    .map((s) => `${CHANNEL_LABEL[s.source]} ${day(s.occurredAt)}${s.title ? ` · ${s.title}` : ''}`)
    .join(' | ')
  const warn = claim.unverified?.length ? `\n   ⚠ ${claim.unverified.join(', ')}: non nelle fonti citate` : ''
  return `- ${claim.text}\n   [${refs}]${warn}`
}

function renderText(brief: MailBrief, consoleUrl: string): string {
  const out: string[] = []

  if (brief.oggi.length) {
    out.push('OGGI E DOMANI', ...brief.oggi.map(claimText), '')
  }
  if (brief.novita.length) {
    out.push('COSA È ARRIVATO', ...brief.novita.map(claimText), '')
  }
  if (brief.conto?.missing) {
    out.push(
      'CONTO',
      `- ${brief.conto.missing} pagamenti senza giustificativo, per € ${formatEuro(brief.conto.missingCents)}.` +
        (brief.conto.resolvable ? ` ${brief.conto.resolvable} hanno già la fattura in memoria.` : ''),
      ''
    )
  }
  if (brief.puntiAperti.length) {
    out.push(
      'PUNTI APERTI',
      ...brief.puntiAperti.map((p) => `- [${p.age}, ${ageDays(p.openedAt)}gg] ${p.text}`),
      ''
    )
  }

  out.push('—', 'Ogni riga viene da un documento in memoria: le righe senza fonte non sono state scritte.')
  if (consoleUrl) out.push(consoleUrl)

  return out.join('\n')
}

/* --- HTML --- */

function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const AGE_COLOR: Record<MailPoint['age'], string> = {
  nuovo: '#16a34a',
  'in attesa': '#ca8a04',
  fermo: '#dc2626',
}

function claimHtml(claim: MailClaim): string {
  const refs = claim.sources
    .map((s) => {
      const label = esc(`${CHANNEL_LABEL[s.source]} ${day(s.occurredAt)}${s.title ? ` · ${s.title}` : ''}`)
      return s.url
        ? `<a href="${esc(s.url)}" style="color:#9a6b1f;text-decoration:none">${label}</a>`
        : label
    })
    .join(' &nbsp;·&nbsp; ')

  const warn = claim.unverified?.length
    ? `<div style="color:#b45309;font-size:13px;margin-top:6px">⚠ ${esc(claim.unverified.join(', '))}: non compare nelle fonti citate</div>`
    : ''

  return `<div style="border-left:3px solid #e0a63f;padding:2px 0 2px 12px;margin:0 0 14px">
  <div style="font-size:15px;line-height:1.5;color:#111827">${esc(claim.text)}</div>
  <div style="font-size:12px;color:#6b7280;margin-top:6px">${refs}</div>${warn}
</div>`
}

function section(title: string, body: string): string {
  if (!body) return ''
  return `<h2 style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#6b7280;margin:26px 0 12px;font-weight:600">${title}</h2>${body}`
}

function renderHtml(brief: MailBrief, consoleUrl: string): string {
  const points = brief.puntiAperti
    .map(
      (p) =>
        `<div style="margin:0 0 10px;font-size:15px;line-height:1.5;color:#111827">
  <span style="display:inline-block;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:${AGE_COLOR[p.age]};border:1px solid ${AGE_COLOR[p.age]};border-radius:999px;padding:1px 7px;margin-right:8px">${esc(p.age)}</span>${esc(p.text)}
  <span style="color:#9ca3af;font-size:12px"> · ${ageDays(p.openedAt)} giorni</span>
</div>`
    )
    .join('')

  const conto = brief.conto?.missing
    ? `<div style="font-size:15px;line-height:1.5;color:#111827">${brief.conto.missing} pagament${brief.conto.missing === 1 ? 'o' : 'i'} senza giustificativo, per <b>€ ${formatEuro(brief.conto.missingCents)}</b>.${
        brief.conto.resolvable
          ? ` ${brief.conto.resolvable} hanno già in memoria la fattura che corrisponde.`
          : ''
      }<div style="font-size:12px;color:#6b7280;margin-top:6px">calcolato senza modello</div></div>`
    : ''

  return `<!doctype html><html lang="it"><body style="margin:0;padding:24px 16px;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px 24px">
  <div style="font-size:18px;font-weight:800;letter-spacing:.08em;color:#111827">BRAIN<span style="color:#e0a63f">.</span></div>
  <div style="font-size:13px;color:#6b7280;margin-top:2px">brief del ${esc(day(brief.generatedAt))}</div>

  ${section('Oggi e domani', brief.oggi.map(claimHtml).join(''))}
  ${section('Cosa è arrivato', brief.novita.map(claimHtml).join(''))}
  ${section('Conto', conto)}
  ${section('Punti aperti', points)}

  <div style="margin-top:28px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;line-height:1.5">
    Ogni riga viene da un documento in memoria: quelle senza fonte non sono state scritte.
    I punti aperti si chiudono solo a mano.
    ${consoleUrl ? `<br><a href="${esc(consoleUrl)}" style="color:#9a6b1f">Apri la console</a>` : ''}
  </div>
</div>
</body></html>`
}

export type RenderedMail = { subject: string; text: string; html: string }

export function renderBriefEmail(brief: MailBrief, consoleUrl = ''): RenderedMail {
  return {
    subject: subjectOf(brief),
    text: renderText(brief, consoleUrl),
    html: renderHtml(brief, consoleUrl),
  }
}
