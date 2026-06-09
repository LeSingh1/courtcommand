"use client";

import { useState } from "react";
import { TEAM_MAP, headshotUrl, initials } from "@/lib/data";
import type { Player } from "@/lib/types";
import { cn } from "@/lib/cn";

/**
 * Official NBA headshot composited over the player's team color, with a clean
 * monogram fallback if the image is blocked or fails to load.
 */
export function PlayerAvatar({
  player,
  size = 40,
  rounded = false,
  className,
}: {
  player: Player;
  size?: number;
  rounded?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const team = TEAM_MAP[player.team];
  const url = headshotUrl(player.espnId);
  const color = team?.color ?? "#26262a";

  if (!url || failed) {
    return (
      <div
        className={cn("flex shrink-0 items-center justify-center font-semibold text-white", rounded && "rounded-full", className)}
        style={{ width: size, height: size, background: color, fontSize: size * 0.34 }}
        aria-label={player.name}
      >
        {initials(player.name)}
      </div>
    );
  }

  return (
    <div
      className={cn("relative shrink-0 overflow-hidden", rounded && "rounded-full", className)}
      style={{ width: size, height: size, background: color }}
      aria-label={player.name}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={player.name}
        loading="lazy"
        onError={() => setFailed(true)}
        className="absolute inset-0 h-full w-full object-cover"
        style={{ objectPosition: "50% 8%" }}
        width={size}
        height={size}
      />
    </div>
  );
}
