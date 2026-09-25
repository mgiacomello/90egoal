#!/usr/bin/env node
/**
 * Habeas Mentem Lab — metterlo online su Vercel con un comando.
 *
 *   VERCEL_TOKEN=... node scripts/go-live.mjs
 *
 * Crea (o riusa) il progetto Vercel "habeas-mentem-lab" con Root Directory
 * `habeas-mentem-lab`, collegato al repository GitHub, e lancia un deploy
 * di produzione aspettando che sia Ready. Nessuna variabile d'ambiente:
 * l'app è solo client, nulla lascia il browser.
 *
 * Serve: VERCEL_TOKEN (https://vercel.com/account/tokens). Facoltativi:
 * VERCEL_TEAM_ID, VERCEL_PROJECT_NAME, GITHUB_REPO, GITHUB_BRANCH.
 * Nessuna dipendenza: solo Node 18+ e `fetch`.
 */

const CONFIG = {
  token: process.env.VERCEL_TOKEN,
  teamId: process.env.VERCEL_TEAM_ID || null,
  projectName: process.env.VERCEL_PROJECT_NAME || "habeas-mentem-lab",
  repo: process.env.GITHUB_REPO || "mgiacomello/90egoal",
  branch: process.env.GITHUB_BRANCH || "main",
  rootDirectory: "habeas-mentem-lab",
};

const V = "https://api.vercel.com";

function fail(message) {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

function log(message) {
  console.log(`• ${message}`);
}

const q = () => (CONFIG.teamId ? `?teamId=${CONFIG.teamId}` : "");

async function vercel(path, { method = "GET", body } = {}) {
  const res = await fetch(`${V}${path}`, {
    method,
    headers: { Authorization: `Bearer ${CONFIG.token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${json.error?.message ?? JSON.stringify(json)}`);
  return json;
}

async function pickTeam() {
  if (CONFIG.teamId) return;
  const { teams } = await vercel("/v2/teams");
  if (teams?.length === 1) {
    CONFIG.teamId = teams[0].id;
    log(`Team: ${teams[0].name}`);
  }
}

async function ensureProject() {
  try {
    const p = await vercel(`/v9/projects/${CONFIG.projectName}${q()}`);
    log(`Progetto esistente: ${p.name}`);
    return p;
  } catch {
    log(`Creo il progetto ${CONFIG.projectName} (root: ${CONFIG.rootDirectory})`);
    return vercel(`/v10/projects${q()}`, {
      method: "POST",
      body: {
        name: CONFIG.projectName,
        framework: "vite",
        rootDirectory: CONFIG.rootDirectory,
        gitRepository: { type: "github", repo: CONFIG.repo },
      },
    });
  }
}

async function deploy(project) {
  const repoId = project.link?.repoId;
  if (!repoId) fail("Il progetto non è collegato a GitHub: collega il repository dalla dashboard e rilancia.");
  const res = await vercel(`/v13/deployments${q()}`, {
    method: "POST",
    body: {
      name: CONFIG.projectName,
      project: project.id,
      target: "production",
      gitSource: { type: "github", repoId, ref: CONFIG.branch },
    },
  });
  log(`Deploy avviato: https://${res.url}`);
  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const d = await vercel(`/v13/deployments/${res.id}${q()}`);
    if (d.readyState === "READY") return d;
    if (d.readyState === "ERROR" || d.readyState === "CANCELED") fail(`Deploy ${d.readyState}: https://${d.url}`);
    process.stdout.write(".");
  }
  fail("Il deploy non è diventato Ready in tempo.");
}

async function main() {
  if (!CONFIG.token) fail("Manca VERCEL_TOKEN: https://vercel.com/account/tokens");
  await pickTeam();
  const project = await ensureProject();
  await deploy(project);
  const domains = await vercel(`/v9/projects/${project.id}/domains${q()}`);
  const main = domains.domains?.find((d) => d.verified)?.name ?? `${CONFIG.projectName}.vercel.app`;
  console.log(`\n✓ Online: https://${main}\n`);
}

main().catch((e) => fail(e.message));
