#!/usr/bin/env node
/**
 * Costruisce Habeas Mentem Lab e lo copia in public/lab, così il sito
 * principale (90egoal.vercel.app) lo serve su /lab come pagina https di
 * primo livello: lì il Web Bluetooth funziona, dentro un'anteprima no.
 *
 * Gira come `prebuild` della root: Vercel lo esegue prima di `next build`.
 * Non ha dipendenze: solo Node e npm.
 */

import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LAB = join(ROOT, "habeas-mentem-lab");
const OUT = join(ROOT, "public", "lab");

const run = (cmd, cwd) => execSync(cmd, { cwd, stdio: "inherit", env: { ...process.env, LAB_BASE: "/lab/" } });

if (!existsSync(join(LAB, "package.json"))) {
  console.log("build-lab: cartella habeas-mentem-lab assente, salto.");
  process.exit(0);
}

console.log("build-lab: installo le dipendenze del laboratorio…");
run(existsSync(join(LAB, "package-lock.json")) ? "npm ci --no-audit --no-fund" : "npm install --no-audit --no-fund", LAB);
console.log("build-lab: costruisco…");
run("npm run build", LAB);

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
cpSync(join(LAB, "dist"), OUT, { recursive: true });
console.log(`build-lab: pronto in ${OUT}`);
