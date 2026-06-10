"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { useCommandBar } from "@/components/command/CommandBarProvider";
import { cn } from "@/lib/cn";

const NAV = [
  { href: "/tools", label: "Tools" },
  { href: "/tools?cat=Prediction", label: "Prediction" },
  { href: "/tools?cat=Team & Strategy", label: "Strategy" },
];

export function SiteHeader() {
  const { open } = useCommandBar();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-40 px-3 pt-3 sm:px-5">
      <div
        className={cn(
          "mx-auto flex h-[58px] max-w-6xl items-center justify-between gap-3 rounded-full border px-3 pl-4 transition-all duration-300 sm:px-4 sm:pl-5",
          scrolled
            ? "border-[var(--line-strong)] bg-[rgba(13,17,24,0.78)] shadow-[0_18px_50px_-20px_rgba(0,0,0,0.65)] backdrop-blur-xl"
            : "border-[var(--line)] bg-[rgba(13,17,24,0.45)] backdrop-blur-md",
        )}
      >
        <Link href="/" className="group flex items-center gap-2.5">
          <Mark />
          <span className="display text-[17px] tracking-tight text-[var(--text)]">
            Court<span className="text-[var(--accent)]">Command</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              className="rounded-full px-3.5 py-1.5 text-sm text-[var(--text-muted)] transition-colors hover:bg-[rgba(148,170,200,0.1)] hover:text-[var(--text)]"
            >
              {l.label}
            </Link>
          ))}
          <Link
            href="/betting"
            className="flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium text-[var(--text)] transition-colors hover:bg-[rgba(95,212,154,0.12)]"
          >
            <span className="blink inline-block h-1.5 w-1.5 rounded-full bg-mint" />
            Betting
          </Link>
        </nav>

        <button
          onClick={open}
          className="group flex items-center gap-2.5 rounded-full border border-[var(--line-strong)] bg-[rgba(148,170,200,0.05)] px-3.5 py-2 text-sm text-[var(--text-muted)] transition-all hover:border-[var(--accent)] hover:text-[var(--text)]"
        >
          <Search size={14} strokeWidth={2} className="transition-colors group-hover:text-[var(--accent)]" />
          <span className="hidden sm:inline">Search</span>
          <kbd className="ml-0.5 hidden rounded-md border border-[var(--line)] px-1.5 py-0.5 text-[10px] text-[var(--text-faint)] sm:inline">
            ⌘K
          </kbd>
        </button>
      </div>
    </header>
  );
}

function Mark() {
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent)] transition-transform duration-300 group-hover:rotate-[24deg]">
      <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" width="18" height="18" fill="none" stroke="#0e1402" strokeWidth="1.7">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 3 V21 M3 12 H21" />
        <path d="M5.5 5.5 Q12 12 5.5 18.5 M18.5 5.5 Q12 12 18.5 18.5" />
      </svg>
    </span>
  );
}
