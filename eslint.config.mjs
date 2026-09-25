import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // brain è un progetto a sé: ha il suo eslint.config.mjs.
    "brain/**",
    // habeas-mentem-lab, idem.
    "habeas-mentem-lab/**",
    // Motore OCR di terze parti, già minificato: non è codice nostro.
    "public/onetap/ocr/**",
  ]),
]);

export default eslintConfig;
