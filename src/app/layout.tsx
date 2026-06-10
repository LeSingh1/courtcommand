import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { SiteHeader } from "@/components/chrome/SiteHeader";
import { SiteFooter } from "@/components/chrome/SiteFooter";
import { CommandBarProvider } from "@/components/command/CommandBarProvider";

// One family everywhere — Geist for display, UI, and body (weight carries the
// hierarchy), Geist Mono for data. Single-family type is what makes the whole
// app read as one voice.

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
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      {/* suppressHydrationWarning: browser extensions (Grammarly etc.) inject
          attributes into <body> before React hydrates — harmless, but they trip
          the dev overlay. Applies to this element only, not children. */}
      <body className="min-h-screen antialiased" suppressHydrationWarning>
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
