// Official ESPN headshots + team logos. Headshots use the player's ESPN id, so
// every rostered player is covered (not just stars).

export function headshotUrl(espnId?: number): string | null {
  return espnId ? `https://a.espncdn.com/i/headshots/nba/players/full/${espnId}.png` : null;
}

// canonical abbr -> ESPN team-logo slug
const LOGO_SLUG: Record<string, string> = {
  GSW: "gs",
  NOP: "no",
  NYK: "ny",
  SAS: "sa",
  UTA: "utah",
  WAS: "wsh",
};

export function teamLogoUrl(abbr: string): string {
  const slug = (LOGO_SLUG[abbr] || abbr).toLowerCase();
  return `https://a.espncdn.com/i/teamlogos/nba/500/${slug}.png`;
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("");
}
