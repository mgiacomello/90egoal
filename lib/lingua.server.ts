import { cookies } from 'next/headers'
import { COOKIE_LINGUA, linguaDa, txDi, type Lingua, type Tx } from './lingua'

// La lingua scelta, letta dal cookie: per le pagine e i componenti che girano sul server.
export async function linguaServer(): Promise<Lingua> {
  return linguaDa((await cookies()).get(COOKIE_LINGUA)?.value)
}

export async function txServer(): Promise<{ lingua: Lingua; tx: Tx }> {
  const lingua = await linguaServer()
  return { lingua, tx: txDi(lingua) }
}
