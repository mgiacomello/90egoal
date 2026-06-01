import type { Metadata } from "next";
import { Inter, Sora } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  weight: ["400", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "90 & Goal — Pronostici Mondiali FIFA 2026",
  description: "Indovina i minuti dei gol e scala la classifica. Il gioco di pronostici ufficiale per i Mondiali FIFA 2026.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it" className={`${inter.variable} ${sora.variable} h-full`}>
      <body className="min-h-full flex flex-col">
        <Navbar />
        <main className="max-w-5xl mx-auto w-full px-4 sm:px-6 py-8 flex-1">
          {children}
        </main>
        <footer className="border-t border-white/5 mt-12">
          <div className="max-w-5xl mx-auto px-6 py-6 flex items-center justify-between text-sm text-[var(--muted)]">
            <span className="font-display font-semibold">
              <span className="text-gradient">90</span>
              <span className="text-white/40"> &amp; </span>
              <span>Goal</span>
            </span>
            <span>Mondiali FIFA 2026 · Gioco di pronostici</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
