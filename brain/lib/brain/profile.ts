import { documentByExternalId, rememberDocuments } from './memory'

/**
 * Il profilo del titolare: chi è, cosa fa, cosa conta quest'anno, come
 * scrive, cosa non vuole. Scritto da lui, in memoria come una nota con
 * un id fisso, e **letto da ogni dirigente prima di scrivere**.
 *
 * È la differenza fra agenti tarati sui tuoi dati e agenti tarati su
 * di te: i dati dicono cosa è successo, il profilo dice cosa conta. Il
 * verificatore non cambia — il profilo è contesto, non una fonte: una
 * riga che cita solo il profilo non passa, perché il profilo non è un
 * fatto accaduto. Serve a scegliere cosa dire, non a dirlo.
 */

export const PROFILE_EXTERNAL_ID = 'profile'

export const PROFILE_TEMPLATE = `Chi sono: avvocato d'impresa e imprenditore; studio …; clienti in Italia e in Europa.
Cosa faccio: contratti, privacy, proprietà intellettuale, startup, operazioni cross-border; legal tech e governance dell'IA (…).
I miei progetti: …
Cosa conta quest'anno: …
Come voglio che mi parlino: sintesi prima di tutto, pratico, niente teoria, rischi e controproposte sempre.
Cosa non voglio: …`

export async function readProfile(): Promise<string | null> {
  const doc = await documentByExternalId('manual', PROFILE_EXTERNAL_ID)
  return doc?.body.trim() || null
}

export async function saveProfile(text: string): Promise<void> {
  await rememberDocuments([
    {
      source: 'manual',
      kind: 'note',
      externalId: PROFILE_EXTERNAL_ID,
      title: 'Profilo del titolare',
      body: text.trim(),
      occurredAt: new Date().toISOString(),
      url: null,
      participants: [],
      metadata: { origin: 'profile' },
    },
  ])
}

/** Il blocco da appendere a un prompt di sistema. Vuoto se non c'è profilo. */
export function profileBlock(profile: string | null): string {
  if (!profile) return ''
  return `\n\nIL TITOLARE, SCRITTO DA LUI (contesto per scegliere cosa conta; non è una fonte da citare):\n${profile.slice(0, 4000)}`
}
