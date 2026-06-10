export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export type Accent = "ember" | "cyan" | "gold" | "mint" | "rose";

// One restrained accent across the whole product (no per-tool rainbow).
const A = "#E9A23B";

const ACCENT_ENTRY = {
  hex: A,
  text: "text-[#E9A23B]",
  bg: "bg-[#E9A23B]",
  ring: "ring-[#E9A23B]/30",
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
export const STEEL = "#8A8273";
export const PALETTE = [A, "#8A8273", "#B7B7BD", "#CBB280", "#A3B79A"];

// Muted, semantic grade scale (conveys meaning, not vibrance).
export function gradeColor(score: number): string {
  if (score >= 75) return "#A3B79A"; // strong
  if (score >= 60) return "#9FB07A"; // good
  if (score >= 45) return "#CBB280"; // average
  if (score >= 30) return "#C57A47"; // weak
  return "#C98A78"; // poor
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
