/**
 * Una mail in formato RFC 5322, a mano. Funzione pura: niente rete,
 * nessun import di valori. Serve a Gmail (`messages.send` vuole il
 * messaggio grezzo in base64url) e si testa riga per riga, perché un
 * oggetto con gli accenti codificato male è una mail che arriva rotta.
 */

export type MimeAttachment = { filename: string; mimeType: string; data: Uint8Array }

export type MimeInput = {
  from?: string
  to: string[]
  cc?: string[]
  subject: string
  text: string
  inReplyTo?: string | null
  references?: string | null
  attachments?: MimeAttachment[]
  /** Iniettabile nei test. */
  boundary?: string
}

function b64(data: Uint8Array | string): string {
  return Buffer.from(typeof data === 'string' ? Buffer.from(data, 'utf8') : data).toString('base64')
}

/** Righe da 76 caratteri, come vuole la RFC. */
function wrap(base64: string): string {
  return base64.replace(/(.{76})/g, '$1\r\n')
}

/** Un'intestazione con caratteri non ASCII: =?UTF-8?B?…?=. */
export function encodeHeader(value: string): string {
  return /^[\x20-\x7e]*$/.test(value) ? value : `=?UTF-8?B?${b64(value)}?=`
}

export function buildMime(input: MimeInput): string {
  const headers: string[] = []
  if (input.from) headers.push(`From: ${input.from}`)
  headers.push(`To: ${input.to.join(', ')}`)
  if (input.cc?.length) headers.push(`Cc: ${input.cc.join(', ')}`)
  headers.push(`Subject: ${encodeHeader(input.subject)}`)
  if (input.inReplyTo) headers.push(`In-Reply-To: ${input.inReplyTo}`)
  if (input.references || input.inReplyTo) headers.push(`References: ${[input.references, input.inReplyTo].filter(Boolean).join(' ')}`)
  headers.push('MIME-Version: 1.0')

  const textPart = ['Content-Type: text/plain; charset="UTF-8"', 'Content-Transfer-Encoding: base64', '', wrap(b64(input.text))].join('\r\n')

  if (!input.attachments?.length) {
    return [...headers, textPart].join('\r\n')
  }

  const boundary = input.boundary ?? `brain-${Math.random().toString(36).slice(2)}`
  const parts = [
    textPart,
    ...input.attachments.map((a) =>
      [
        `Content-Type: ${a.mimeType}; name="${encodeHeader(a.filename)}"`,
        `Content-Disposition: attachment; filename="${encodeHeader(a.filename)}"`,
        'Content-Transfer-Encoding: base64',
        '',
        wrap(b64(a.data)),
      ].join('\r\n')
    ),
  ]
  return [
    ...headers,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    ...parts.map((p) => `--${boundary}\r\n${p}`),
    `--${boundary}--`,
  ].join('\r\n')
}

export function toBase64Url(raw: string): string {
  return Buffer.from(raw, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
