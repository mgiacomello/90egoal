#!/usr/bin/env node
/**
 * BRAIN — metterlo online con un comando.
 *
 *   node scripts/go-live.mjs
 *
 * Legge `.env.deploy` (o l'ambiente) e fa, nell'ordine:
 *
 *   1. Le migration su Supabase, se c'è SUPABASE_ACCESS_TOKEN
 *      (Management API: https://supabase.com/dashboard/account/tokens).
 *   2. Il progetto Vercel "brain" con Root Directory `brain`, collegato
 *      al repository GitHub, con le variabili d'ambiente caricate.
 *   3. Un deploy di produzione, e aspetta che sia Ready.
 *   4. BRAIN_APP_URL impostata sul dominio ottenuto, e un secondo deploy
 *      se prima mancava — serve a Google e al link nella mail del brief.
 *
 * Idempotente: un progetto che c'è già viene riusato, le variabili
 * vengono aggiornate, le migration sono `create … if not exists`.
 * Nessuna dipendenza: solo Node 18+ e `fetch`.
 *
 * Serve: VERCEL_TOKEN (https://vercel.com/account/tokens). Il resto
 * delle variabili è quello del README, sezione "Configurazione".
 */

import { readFileSync, existsSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/* ------------------------------------------------------------------ *
 * Configurazione
 * ------------------------------------------------------------------ */

function loadEnvFile(path) {
  if (!existsSync(path)) return {}
  const out = {}
  for (const raw of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq < 0) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    out[key] = value
  }
  return out
}

const env = { ...loadEnvFile(join(ROOT, '.env.deploy')), ...process.env }

const CONFIG = {
  vercelToken: env.VERCEL_TOKEN,
  teamId: env.VERCEL_TEAM_ID || null,
  projectName: env.VERCEL_PROJECT_NAME || 'brain',
  repo: env.GITHUB_REPO || 'mgiacomello/90egoal',
  branch: env.GITHUB_BRANCH || 'main',
  supabaseAccessToken: env.SUPABASE_ACCESS_TOKEN || null,
}

/** Le variabili che finiscono su Vercel, con il loro carattere. */
const REQUIRED = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'BRAIN_OWNER_EMAIL', 'ANTHROPIC_API_KEY']
const OPTIONAL = [
  'CRON_SECRET',
  'RESEND_API_KEY', 'BRAIN_MAIL_FROM', 'BRAIN_MAIL_TO', 'BRAIN_WEBHOOK_URL',
  'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'BRAIN_APP_URL', 'BRAIN_GMAIL_QUERY',
  'QONTO_LOGIN', 'QONTO_SECRET_KEY', 'OURA_TOKEN',
]
const PUBLIC = new Set(['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'BRAIN_APP_URL', 'BRAIN_OWNER_EMAIL', 'BRAIN_MAIL_FROM', 'BRAIN_MAIL_TO', 'BRAIN_GMAIL_QUERY'])

function fail(message) {
  console.error(`\n✗ ${message}\n`)
  process.exit(1)
}

function log(message) {
  console.log(`· ${message}`)
}

/* ------------------------------------------------------------------ *
 * HTTP
 * ------------------------------------------------------------------ */

async function call(url, { method = 'GET', token, body } = {}) {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { raw: text }
  }
  return { ok: res.ok, status: res.status, data }
}

/* ------------------------------------------------------------------ *
 * 1. Supabase
 * ------------------------------------------------------------------ */

async function migrate() {
  if (!CONFIG.supabaseAccessToken) {
    log('SUPABASE_ACCESS_TOKEN assente: salto le migration (falle a mano nell\'SQL Editor).')
    return
  }
  const url = env.NEXT_PUBLIC_SUPABASE_URL || ''
  const ref = url.match(/^https:\/\/([a-z0-9-]+)\.supabase\.co/i)?.[1]
  if (!ref) fail('NEXT_PUBLIC_SUPABASE_URL non ha la forma https://<ref>.supabase.co')

  for (const file of ['migration_brain.sql', 'migration_brain_brief.sql']) {
    const sql = readFileSync(join(ROOT, 'supabase', file), 'utf8')
    const res = await call(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
      method: 'POST',
      token: CONFIG.supabaseAccessToken,
      body: { query: sql },
    })
    if (!res.ok) fail(`Migration ${file} fallita (${res.status}): ${JSON.stringify(res.data)}`)
    log(`Supabase: ${file} eseguita.`)
  }
}

/* ------------------------------------------------------------------ *
 * 2–4. Vercel
 * ------------------------------------------------------------------ */

const V = 'https://api.vercel.com'
const team = () => (CONFIG.teamId ? `teamId=${encodeURIComponent(CONFIG.teamId)}` : '')
const q = (extra = '') => {
  const parts = [team(), extra].filter(Boolean)
  return parts.length ? `?${parts.join('&')}` : ''
}

async function vercel(path, options = {}) {
  return call(`${V}${path}`, { ...options, token: CONFIG.vercelToken })
}

async function pickTeam() {
  if (CONFIG.teamId) return
  const res = await vercel('/v2/teams')
  if (!res.ok) fail(`Vercel: token non valido o senza accesso ai team (${res.status}).`)
  const teams = res.data?.teams ?? []
  if (teams.length === 1) {
    CONFIG.teamId = teams[0].id
    log(`Vercel: team "${teams[0].slug}".`)
  } else if (teams.length > 1) {
    fail(`Più di un team: imposta VERCEL_TEAM_ID a uno di ${teams.map((t) => `${t.slug} (${t.id})`).join(', ')}.`)
  } else {
    log('Vercel: account personale, nessun team.')
  }
}

function envPayload() {
  const vars = []
  for (const key of REQUIRED) {
    if (!env[key]) fail(`Manca ${key}. Mettila in .env.deploy o nell'ambiente.`)
    vars.push(key)
  }
  if (!env.CRON_SECRET) {
    env.CRON_SECRET = randomBytes(32).toString('hex')
    log('CRON_SECRET generato: la sincronizzazione notturna è armata.')
  }
  for (const key of OPTIONAL) if (env[key]) vars.push(key)
  return vars.map((key) => ({
    key,
    value: env[key],
    type: PUBLIC.has(key) ? 'plain' : 'encrypted',
    target: ['production', 'preview'],
  }))
}

async function ensureProject() {
  const existing = await vercel(`/v9/projects/${encodeURIComponent(CONFIG.projectName)}${q()}`)
  if (existing.ok) {
    log(`Vercel: progetto "${CONFIG.projectName}" già esistente, lo riuso.`)
    const upsert = await vercel(`/v10/projects/${existing.data.id}/env${q('upsert=true')}`, {
      method: 'POST',
      body: envPayload(),
    })
    if (!upsert.ok) fail(`Variabili non aggiornate (${upsert.status}): ${JSON.stringify(upsert.data)}`)
    log('Vercel: variabili aggiornate.')
    return existing.data
  }

  const created = await vercel(`/v11/projects${q()}`, {
    method: 'POST',
    body: {
      name: CONFIG.projectName,
      framework: 'nextjs',
      rootDirectory: 'brain',
      gitRepository: { type: 'github', repo: CONFIG.repo },
      environmentVariables: envPayload(),
    },
  })
  if (!created.ok) {
    fail(
      `Progetto non creato (${created.status}): ${JSON.stringify(created.data)}\n` +
        `Se dice che il repository non è raggiungibile, installa l'app GitHub di Vercel sul repo: https://vercel.com/account/login-connections`
    )
  }
  log(`Vercel: progetto "${CONFIG.projectName}" creato con Root Directory brain.`)
  return created.data
}

async function deploy(project) {
  const repoId = project.link?.repoId
  if (!repoId) fail('Il progetto non risulta collegato a GitHub: collegalo dal pannello (Settings → Git) e rilancia.')
  const res = await vercel(`/v13/deployments${q()}`, {
    method: 'POST',
    body: {
      name: CONFIG.projectName,
      project: project.id,
      target: 'production',
      gitSource: { type: 'github', repoId, ref: CONFIG.branch },
    },
  })
  if (!res.ok) fail(`Deploy non partito (${res.status}): ${JSON.stringify(res.data)}`)
  const id = res.data.id
  log(`Vercel: deploy ${id} in corso da ${CONFIG.branch}…`)

  const started = Date.now()
  for (;;) {
    await new Promise((r) => setTimeout(r, 8000))
    const d = await vercel(`/v13/deployments/${id}${q()}`)
    const state = d.data?.readyState ?? d.data?.state
    if (state === 'READY') {
      log(`Vercel: deploy pronto (${Math.round((Date.now() - started) / 1000)}s).`)
      return d.data
    }
    if (state === 'ERROR' || state === 'CANCELED') {
      fail(`Deploy finito in ${state}: https://vercel.com/${d.data?.creator?.username ?? ''}/${CONFIG.projectName}/${id}`)
    }
    if (Date.now() - started > 15 * 60_000) fail('Deploy ancora in corso dopo 15 minuti: guarda il pannello.')
  }
}

async function productionUrl(project) {
  const res = await vercel(`/v9/projects/${project.id}/domains${q()}`)
  const domains = res.data?.domains ?? []
  const vercelApp = domains.find((d) => d.name.endsWith('.vercel.app') && !d.name.includes('-git-'))
  const custom = domains.find((d) => !d.name.endsWith('.vercel.app') && d.verified)
  return `https://${(custom ?? vercelApp ?? domains[0])?.name ?? `${CONFIG.projectName}.vercel.app`}`
}

async function main() {
  if (!CONFIG.vercelToken) fail('Manca VERCEL_TOKEN: https://vercel.com/account/tokens')

  await migrate()
  await pickTeam()
  const project = await ensureProject()
  await deploy(project)

  const url = await productionUrl(project)
  if (!env.BRAIN_APP_URL) {
    env.BRAIN_APP_URL = url
    const upsert = await vercel(`/v10/projects/${project.id}/env${q('upsert=true')}`, {
      method: 'POST',
      body: [{ key: 'BRAIN_APP_URL', value: url, type: 'plain', target: ['production', 'preview'] }],
    })
    if (!upsert.ok) fail(`BRAIN_APP_URL non impostata (${upsert.status}).`)
    log(`BRAIN_APP_URL = ${url}; secondo deploy per farla leggere…`)
    await deploy(project)
  }

  console.log(`
✓ BRAIN è online: ${url}
  Entra da ${url}/login con l'account Supabase di ${env.BRAIN_OWNER_EMAIL}.
  Per Google: redirect URI ${url}/api/brain/connect/google/callback
`)
}

main().catch((err) => fail(err?.stack ?? String(err)))
