# App Android (Google Play)

L'app Android è il sito dentro un guscio (Trusted Web Activity): si aggiorna da sola a ogni
pubblicazione del sito. Il pacchetto si ricostruisce solo se cambiano nome, icona o colori.

- `twa-manifest.json`: la configurazione usata da Bubblewrap per generare il progetto.
- `public/.well-known/assetlinks.json`: collega il sito all'app. Senza, dentro l'app compare la barra dell'indirizzo.
  Contiene l'impronta della chiave di caricamento; va aggiunta quella della chiave di firma di Google
  (Play Console → Integrità dell'app → Firma dell'app → impronta SHA-256).
- Identificativo: `digital.giacomello.novantaegoal`. Android minimo: 7.0.

Fuori dal repository, in `~/Documents/Progetti/90egoal-android/`:
la chiave di caricamento (`upload-key.keystore`), la sua password (`password.txt`), il progetto
generato e i pacchetti firmati. La chiave e la password vanno conservate in un posto sicuro:
servono per ogni aggiornamento. Non vanno mai messe nel repository.

Per una nuova versione: aumentare `appVersionCode` e `appVersion`, rigenerare il progetto con
Bubblewrap, `./gradlew bundleRelease`, firmare con `jarsigner`.
