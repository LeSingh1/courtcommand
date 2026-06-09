"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { useCommandBar } from "@/components/command/CommandBarProvider";
import { cn } from "@/lib/cn";

export function SiteHeader() {
  const { open } = useCommandBar();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 transition-colors duration-300",
        scrolled ? "border-b border-[var(--line)] bg-[var(--bg)]/90 backdrop-blur" : "border-b border-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link href="/" className="group flex items-center gap-3">
          <Mark />
          <div className="leading-none">
            <div className="text-[15px] font-bold tracking-tight text-[var(--text)]">
              COURT<span className="text-[var(--accent)]">COMMAND</span>
            </div>
            <div className="stat-num mt-0.5 text-[9px] uppercase tracking-[0.2em] text-[var(--text-faint)]">
              NBA Intelligence
            </div>
          </div>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {[
            { href: "/tools", label: "Tools" },
            { href: "/tools?cat=Prediction", label: "Prediction" },
            { href: "/tools?cat=Team & Strategy", label: "Strategy" },
          ].map((l) => (
            <Link
              key={l.label}
              href={l.href}
              className="link-underline text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
            >
              {l.label}
            </Link>
          ))}
          <Link
            href="/betting"
            className="link-underline flex items-center gap-1.5 text-sm font-medium text-[var(--text)] transition-colors"
          >
            <span className="inline-block h-1.5 w-1.5" style={{ background: "#2FA96B" }} />
            Betting
          </Link>
        </nav>

        <button
          onClick={open}
          className="group flex items-center gap-2.5 border border-[var(--line-strong)] px-3 py-2 text-sm text-[var(--text-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--text)]"
        >
          <Search size={15} strokeWidth={1.75} />
          <span className="hidden sm:inline">Search</span>
          <kbd className="ml-1 hidden border border-[var(--line)] px-1.5 py-0.5 text-[10px] text-[var(--text-faint)] sm:inline">
            ⌘K
          </kbd>
        </button>
      </div>
    </header>
  );
}

function Mark() {
  return (
    <span className="flex h-8 w-8 items-center justify-center border border-[var(--line-strong)]">
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="var(--accent)" strokeWidth="1.5">
        <circle cx="12" cy="12" r="9.5" />
        <path d="M12 2.5 V21.5 M2.5 12 H21.5" />
        <path d="M5 5 Q12 12 5 19 M19 5 Q12 12 19 19" />
      </svg>
    </span>
  );
}
