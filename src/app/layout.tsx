import type { Metadata } from "next";
import { Bricolage_Grotesque, Instrument_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/chrome/SiteHeader";
import { SiteFooter } from "@/components/chrome/SiteFooter";
import { CommandBarProvider } from "@/components/command/CommandBarProvider";

// Contemporary grotesque with real character — headlines + big numerals.
const display = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

// Clean, warm sans for UI and body copy.
const sans = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

// Tabular mono for data and labels.
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CourtCommand — Basketball Intelligence",
  description:
    "Thirty NBA analytics instruments in one terminal, powered by models trained on two decades of basketball: shot quality, player similarity, trade legality, clutch ratings, lineup optimization, and more.",
  keywords: [
    "NBA analytics",
    "basketball intelligence",
    "shot quality",
    "player similarity",
    "trade machine",
    "fantasy basketball",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body className="min-h-screen antialiased">
        <div className="scroll-progress" aria-hidden />
        <CommandBarProvider>
          <SiteHeader />
          <main className="relative">{children}</main>
          <SiteFooter />
        </CommandBarProvider>
      </body>
    </html>
  );
}
