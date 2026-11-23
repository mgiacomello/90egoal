import type { Metadata, Viewport } from "next";
import { Inter, Sora, Fraunces, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import SiteChrome from "@/components/SiteChrome";
import { LinguaProvider } from "@/components/Lingua";
import { linguaServer } from "@/lib/lingua.server";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-num",
  weight: ["500", "600", "700"],
  display: "swap",
});

// Inter e Sora servono ancora a ONE TAP (onetap.css); il gioco usa Fraunces, Plex Sans e Plex Mono.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  weight: ["400", "600", "700", "800"],
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  weight: "variable",
  axes: ["opsz"],
  display: "swap",
});

// Titolo e descrizione seguono la lingua scelta (cookie): italiano se non c'è.
export async function generateMetadata(): Promise<Metadata> {
  const en = (await linguaServer()) === "en";
  return {
    title: en ? "90 & Goal — Guess the minute of the goal" : "90 & Goal — Indovina il minuto del gol",
    description: en
      ? "Ten matches, thirteen minutes to pick, live standings. The prediction game about the minutes goals are scored."
      : "Dieci partite, tredici minuti da scegliere, la classifica in diretta. Il gioco di pronostici sui minuti dei gol.",
    applicationName: "90 & Goal",
    metadataBase: new URL("https://90egoal.vercel.app"),
    openGraph: {
      title: en ? "90 & Goal — Guess the minute of the goal" : "90 & Goal — Indovina il minuto del gol",
      description: en
        ? "Ten matches from Italy's Serie A, B and C. You pick 13 minutes. Every goal in one of yours is a point."
        : "Dieci partite di Serie A, B e C. Tu scegli 13 minuti. Ogni gol in uno dei tuoi è un punto.",
      locale: en ? "en_GB" : "it_IT",
      type: "website",
    },
    appleWebApp: { capable: true, title: "90 & Goal", statusBarStyle: "default" },
    icons: {
      icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
    },
    // Test chiuso: il link gira solo nella community, i motori di ricerca restano fuori.
    // ONE TAP dichiara nel suo layout la propria indicizzazione.
    robots: { index: false, follow: false },
  };
}

export const viewport: Viewport = {
  themeColor: "#f3efe4",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const lingua = await linguaServer();
  return (
    <html lang={lingua} className={`${plexSans.variable} ${plexMono.variable} ${inter.variable} ${sora.variable} ${fraunces.variable} h-full`}>
      <body className="min-h-full flex flex-col">
        <LinguaProvider lingua={lingua}><SiteChrome>{children}</SiteChrome></LinguaProvider>
      </body>
    </html>
  );
}
