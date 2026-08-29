This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## 🎀 Salone di Bellezza (`/salone`)

Mini-gioco per bambini incluso nell'app, pensato per tablet e telefono.

- Si sceglie una modella già pronta (6 personaggi) oppure si carica una foto.
- Sui capelli si lavora **direttamente sul ritratto**, col dito o col mouse:
  - 🤲 **Mani** — si trascina una ciocca: verso l'alto esce la coda (fino in cima
    lo chignon), di lato le treccine, verso il basso tornano sciolti.
  - ✂️ **Forbici** — si tocca all'altezza voluta e lì i capelli si accorciano
    (con ciocche che cadono e schiocco delle lame); 🪄 li fa ricrescere.
  - 🧴 **Shampoo** — si strofina e arrivano le bolle di schiuma.
  - 🥥 **Balsamo** — si spalma sui capelli bagnati: dopo il phon restano lisci e
    lucidi invece che gonfi.
  - 🚿 **Doccia** — l'acqua scorre dove passi il dito, porta via la schiuma un po'
    alla volta e **sbiadisce le tinte fantasia** (rosa, azzurro, lilla, menta)
    fino a riportare il colore naturale.
  - 🌬️ **Phon** — asciuga i capelli bagnati e mentre si asciugano si gonfiano
    (col balsamo restano morbidi). Acqua e phon hanno anche il loro rumore.
- Si trucca **col dito** disegnando sul viso (rossetto, ombretto, fard sfumato,
  glitter, gomma per correggere) oltre al trucco veloce a pastiglie; più ciglia,
  lentiggini e glitter.
- Si veste: 6 capi, 12 colori, 5 fantasie, occhiali, corona/cerchietto/cappello, gioielli.
- Il look si salva nel "book" (fino a 12, nel browser) e si scarica come PNG.

Note tecniche: è tutto client-side, il disegno è un SVG (`components/salone/Avatar.tsx`)
esportato in PNG via canvas. **Le foto caricate non lasciano mai il dispositivo**: vengono
ridimensionate nel browser e tenute in memoria, nessun upload verso il server o Supabase.
La pagina è pubblica (non richiede login).
