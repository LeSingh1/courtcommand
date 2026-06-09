import type { Metadata } from "next";
import { Fraunces, Saira_Condensed, Archivo, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/chrome/SiteHeader";
import { SiteFooter } from "@/components/chrome/SiteFooter";
import { CommandBarProvider } from "@/components/command/CommandBarProvider";

// Editorial serif with real character — headlines + italic accents.
const display = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

// Condensed, sporty figures — scoreboard numbers + section indices.
const condensed = Saira_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-condensed",
  display: "swap",
});

// Clean grotesque for UI and body.
const sans = Archivo({
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
    <html
      lang="en"
      className={`${display.variable} ${condensed.variable} ${sans.variable} ${mono.variable}`}
    >
      <body className="min-h-screen antialiased">
        <CommandBarProvider>
          <SiteHeader />
          <main className="relative">{children}</main>
          <SiteFooter />
        </CommandBarProvider>
      </body>
    </html>
  );
}
