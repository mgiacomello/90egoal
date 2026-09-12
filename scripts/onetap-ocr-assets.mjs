// Copia in public/ il motore OCR che gira sul dispositivo.
//
// Perché non un CDN: la lettura locale esiste per non far uscire l'immagine
// dal telefono, e andare a prendere il motore da un terzo contraddirebbe
// proprio quella promessa (oltre a rompersi ovunque quel CDN sia bloccato).
//
// I file arrivano da node_modules, quindi non stanno in git: li rigenera ogni
// build (`prebuild`/`predev`). I dati di lingua invece sono versionati, perché
// non cambiano mai e il build non deve dipendere dalla rete.

import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'public/onetap/ocr')

/** Solo le varianti LSTM: quelle "legacy" pesano il doppio e non servono. */
const FILES = [
  ['tesseract.js/dist/worker.min.js', 'worker.min.js'],
  // Tre varianti perché il motore sceglie da solo in base a cosa supporta il
  // browser: relaxed SIMD dove c'è, SIMD altrove, e una senza per i più vecchi.
  ['tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js', 'tesseract-core-relaxedsimd-lstm.wasm.js'],
  ['tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js'],
  ['tesseract.js-core/tesseract-core-lstm.wasm.js', 'tesseract-core-lstm.wasm.js'],
]

mkdirSync(OUT, { recursive: true })

let copied = 0
for (const [from, to] of FILES) {
  const src = join(ROOT, 'node_modules', from)
  if (!existsSync(src)) {
    console.warn(`[onetap] manca ${from}: la lettura sul dispositivo resterà spenta`)
    continue
  }
  copyFileSync(src, join(OUT, to))
  copied++
}

for (const lang of ['eng', 'ita']) {
  if (!existsSync(join(OUT, `${lang}.traineddata.gz`))) {
    console.warn(`[onetap] manca ${lang}.traineddata.gz in public/onetap/ocr`)
  }
}

console.log(`[onetap] motore OCR pronto (${copied}/${FILES.length} file)`)
