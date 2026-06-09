export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export type Accent = "ember" | "cyan" | "gold" | "mint" | "rose";

// One restrained accent across the whole product (no per-tool rainbow).
const A = "#E0561F";

const ACCENT_ENTRY = {
  hex: A,
  text: "text-[#E0561F]",
  bg: "bg-[#E0561F]",
  ring: "ring-[#E0561F]/30",
  glow: "",
  grad: "",
};

export const ACCENT: Record<Accent, typeof ACCENT_ENTRY> = {
  ember: ACCENT_ENTRY,
  cyan: ACCENT_ENTRY,
  gold: ACCENT_ENTRY,
  mint: ACCENT_ENTRY,
  rose: ACCENT_ENTRY,
};

// Professional, restrained data palette for charts/series (not decorative).
export const ACCENT_HEX = A;
export const STEEL = "#7E8CA0";
export const PALETTE = [A, "#7E8CA0", "#B7B7BD", "#C9A14A", "#5FA97E"];

// Muted, semantic grade scale (conveys meaning, not vibrance).
export function gradeColor(score: number): string {
  if (score >= 75) return "#5FA97E"; // strong
  if (score >= 60) return "#9FB07A"; // good
  if (score >= 45) return "#C9A14A"; // average
  if (score >= 30) return "#C57A47"; // weak
  return "#BF5B4E"; // poor
}

export function letterGrade(score: number): string {
  if (score >= 93) return "A+";
  if (score >= 88) return "A";
  if (score >= 83) return "A-";
  if (score >= 78) return "B+";
  if (score >= 72) return "B";
  if (score >= 66) return "B-";
  if (score >= 60) return "C+";
  if (score >= 53) return "C";
  if (score >= 46) return "C-";
  if (score >= 40) return "D+";
  if (score >= 33) return "D";
  return "F";
}
