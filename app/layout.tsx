import type { Metadata, Viewport } from "next";
import { Inter, Sora, Poppins } from "next/font/google";
import "./globals.css";
import SiteChrome from "@/components/SiteChrome";

// Inter è il testo del gioco (e di ONE TAP); Sora serve solo a ONE TAP.
const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  weight: ["400", "600", "700", "800"],
  display: "swap",
});

// Titoli e numeri: geometrico e pieno, come le app del cartellone.
const poppins = Poppins({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "90 & Goal — Indovina il minuto del gol",
  description: "Dieci partite, tredici minuti da scegliere, la classifica in diretta. Il gioco di pronostici sui minuti dei gol.",
  applicationName: "90 & Goal",
  metadataBase: new URL("https://90egoal.vercel.app"),
  openGraph: {
    title: "90 & Goal — Indovina il minuto del gol",
    description: "Dieci partite di Serie A, B e C. Tu scegli 13 minuti. Ogni gol in uno dei tuoi è un punto.",
    locale: "it_IT",
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

export const viewport: Viewport = {
  themeColor: "#eef3fb",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it" className={`${inter.variable} ${sora.variable} ${poppins.variable} h-full`}>
      <body className="min-h-full flex flex-col">
        <SiteChrome>{children}</SiteChrome>
      </body>
    </html>
  );
}
