import type { Metadata, Viewport } from "next";
import { Inter, Sora, Barlow_Condensed } from "next/font/google";
import "./globals.css";
import SiteChrome from "@/components/SiteChrome";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

// Sora serve ancora a ONE TAP (onetap.css); il gioco usa Barlow Condensed.
const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  weight: ["400", "600", "700", "800"],
  display: "swap",
});

const barlow = Barlow_Condensed({
  subsets: ["latin"],
  variable: "--font-barlow",
  weight: ["500", "600", "700", "800"],
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
  appleWebApp: { capable: true, title: "90 & Goal", statusBarStyle: "black-translucent" },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  // Test chiuso: il link gira solo nella community, i motori di ricerca restano fuori.
  // ONE TAP dichiara nel suo layout la propria indicizzazione.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0b2219",
  colorScheme: "dark",
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
    <html lang="it" className={`${inter.variable} ${sora.variable} ${barlow.variable} h-full`}>
      <body className="min-h-full flex flex-col">
        <SiteChrome>{children}</SiteChrome>
      </body>
    </html>
  );
}
