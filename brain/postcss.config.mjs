// BRAIN non usa Tailwind: questo file evita che Turbopack erediti
// il postcss.config.mjs della root del repo (che richiede @tailwindcss/postcss).
const config = { plugins: {} };

export default config;
