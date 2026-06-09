"use client";

import { useState } from "react";
import { TEAM_MAP, teamLogoUrl } from "@/lib/data";
import { cn } from "@/lib/cn";

/**
 * Official team logo with a colored-abbreviation chip fallback.
 */
export function TeamLogo({
  abbr,
  size = 22,
  className,
}: {
  abbr: string;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const team = TEAM_MAP[abbr];

  if (failed || !team) {
    return (
      <span
        className={cn("inline-flex shrink-0 items-center justify-center font-bold text-white", className)}
        style={{ width: size, height: size, background: team?.color ?? "#26262a", fontSize: size * 0.32 }}
      >
        {abbr}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={teamLogoUrl(abbr)}
      alt={abbr}
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn("shrink-0 object-contain", className)}
      style={{ width: size, height: size }}
    />
  );
}
