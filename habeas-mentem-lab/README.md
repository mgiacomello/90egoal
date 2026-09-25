# Habeas Mentem Lab

Prototipo interno, non commerciale, del programma di misurazione descritto in
*Habeas Mentem* (M. Giacomello, 2026) e in *Progettare la comprensione del
diritto* (cap. 7). Primo strumento: **LX Reader**, la lettura di un documento
giuridico una clausola alla volta con la fascia **Mendi** (fNIRS) collegata.

> La comprensione si misura, la mente non si legge.
> Nessun sensore dimostra da solo la comprensione: la conoscenza nasce dalla
> convergenza delle evidenze.

## Che cosa fa oggi (tool 1)

| Occhio del diritto | Stato | Che cosa registra |
|---|---|---|
| **Tempo** | ✅ | ms su ogni clausola, visite, ritorni indietro, parole/minuto, flag "troppo veloce per averla letta" (> 600 wpm) |
| **Corpo** | ✅ | frame Mendi a ~25 Hz (IR, rosso, ambiente per canale sinistro/destro/polso, IMU, temperatura), annotati con la clausola visibile; indice di sforzo relativo alla baseline; quota di artefatti da movimento |
| Sguardo | — | eye-tracking: non in questo tool |
| Verifica | ⏭ tool 2 | domande di comprensione |
| Prova operativa | ⏭ tool 2 | compiti pratici sul documento |

Uscita: CSV per clausola, CSV dei campioni grezzi, JSON della sessione.
Tutto resta nel browser finché non viene scaricato. Nessun server.

## Avvio

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # decoder protobuf, indice di sforzo, metriche
npm run build
```

Requisiti per la fascia reale: **Chrome o Edge** su desktop o Android
(Web Bluetooth), pagina servita da `localhost` o `https`. Safari e Firefox
non supportano Web Bluetooth. Senza fascia si può usare la **fascia
simulata** (flusso realistico, ma non simula il carico cognitivo) oppure
**leggere senza fascia** (resta attivo il solo sensore del tempo).

Flusso: consenso → collega la fascia → scegli il documento (tre modelli
inclusi, oppure **incolla un tuo testo**) → 30 s di baseline a riposo →
lettura clausola per clausola → tabella dei risultati ed esportazione.

## Come parla con Mendi

Mendi non pubblica un'API. Il protocollo BLE è ricostruito dalla libreria
open source [`mendi`](https://crates.io/crates/mendi) (Rust, MIT):

- servizio GATT `fc3eabb0-c6c4-49e6-922a-6e551c455af5`, nome `Mendi…`;
- caratteristica Frame `…abb1` (notifiche protobuf a ~25 Hz), ADC `…abb4`
  (batteria), Calibration `…abb6` (autocalibrazione LED), Diagnostics `…abb5`;
- schema `proto3` in `src/mendi/protobuf.ts`, decoder scritto a mano
  (solo varint, fixed32, float), coperto dai test.

Un aggiornamento del firmware Mendi può cambiare il protocollo senza
preavviso. È il rischio accettato per un prototipo interno.

## L'indice di sforzo, e i suoi limiti

`src/mendi/signal.ts`, dichiarato per intero:

1. sottrazione della luce ambiente per canale;
2. densità ottica relativa alla baseline, `od = −ln(I / I₀)`;
3. proxy HbO = `od(rosso) − od(IR)` (coefficienti di estinzione e DPF non
   applicati: è un'approssimazione di primo ordine, non una concentrazione);
4. media dei canali frontali sinistro e destro, media mobile di 1 s.

Unità arbitrarie, confrontabili solo tra clausole della **stessa sessione**.
Il modulo non produce un giudizio di comprensione, non inferisce emozioni,
non classifica il partecipante. Segnala dove il segnale si sposta rispetto
al riposo: un indizio da leggere in convergenza con gli altri sensori.

## Privacy by design nel prototipo

- Nessun dato identificativo: la sessione ha uno pseudonimo casuale.
- Nessuna rete: i dati vivono nella pagina finché non vengono scaricati.
- Diritto di non essere misurati: si legge anche senza fascia.
- Consenso esplicito prima di iniziare, con l'elenco di ciò che si registra.

Con partecipanti esterni i segnali ottici sono con ogni probabilità dati
relativi alla salute (art. 9 GDPR): servono informativa, consenso esplicito
e, verosimilmente, una DPIA. Per una pubblicazione, parere del comitato etico.

## Struttura

```
src/mendi/       protocollo, decoder protobuf, client Web Bluetooth, simulatore, indice di sforzo
src/session/     modello della sessione, metriche per clausola, esportazione
src/documents/   tre documenti modello + import di testo incollato
src/ui/          registratore (hook), schermate, tracciato dal vivo
tests/           vitest
```

## Roadmap (dal libro)

2. **Test e prova operativa** — domande di comprensione e compiti pratici dopo la lettura.
3. **Mappa della frizione** — verde/giallo/rosso per clausola, solo dove più sensori convergono.
4. **LX Score Analyzer** — le quattro dimensioni (complessità linguistica, densità
   concettuale, struttura informativa, distanza semantica) e la ricalibrazione dei pesi sui dati raccolti.
5. **Fascicolo di comprensione** — il PDF che sostituisce il click come prova.

I documenti modello in `src/documents/` sono scritti per il laboratorio sul
calco delle informative reali; non appartengono ad aziende esistenti.
