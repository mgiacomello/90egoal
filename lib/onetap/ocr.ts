// ONE TAP — lettura del testo sul dispositivo.
//
// Rete di sicurezza per la pipeline immagini: se il modello remoto non è
// configurato o non risponde, l'immagine viene letta qui, nel browser, e
// l'app continua a funzionare.
//
// Effetto collaterale migliore del motivo per cui esiste: su questa strada
// la foto non lascia il dispositivo. Nessun upload, nessuna chiave, niente
// da configurare.
//
// Il costo è il primo utilizzo: il motore e i dati di lingua vengono
// scaricati una volta (qualche MB) e poi restano nella cache del browser.

type Worker = {
  recognize: (image: Blob) => Promise<{ data: { text: string } }>
  terminate: () => Promise<unknown>
}

let workerPromise: Promise<Worker> | null = null

async function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      // Import dinamico: il motore OCR non entra nel bundle iniziale e viene
      // scaricato solo da chi ne ha davvero bisogno.
      const { createWorker } = await import('tesseract.js')
      // Tutto servito da questo dominio: il motore non viene preso da un CDN,
      // altrimenti la promessa "non lascia il dispositivo" sarebbe falsa.
      return (await createWorker(['ita', 'eng'], 1, {
        workerPath: '/onetap/ocr/worker.min.js',
        corePath: '/onetap/ocr',
        langPath: '/onetap/ocr',
      })) as unknown as Worker
    })().catch((err) => {
      workerPromise = null
      throw err
    })
  }
  return workerPromise
}

export interface OcrResult {
  text: string
  /** Quanto è durata: serve a raccontare all'utente perché ha aspettato. */
  ms: number
}

/** Legge il testo di un'immagine senza mandarla da nessuna parte. */
export async function readOnDevice(image: Blob): Promise<OcrResult> {
  const started = Date.now()
  const worker = await getWorker()
  const { data } = await worker.recognize(image)
  return { text: (data?.text ?? '').trim(), ms: Date.now() - started }
}

/** Libera il motore quando non serve più (cambio pagina, pulizia). */
export async function releaseOcr(): Promise<void> {
  if (!workerPromise) return
  const pending = workerPromise
  workerPromise = null
  try {
    const worker = await pending
    await worker.terminate()
  } catch {
    // già andato: niente da liberare
  }
}
