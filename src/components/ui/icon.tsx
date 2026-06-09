import * as LucideIcons from "lucide-react";
import type { LucideIcon } from "lucide-react";

const ICONS = LucideIcons as unknown as Record<string, LucideIcon>;

export function getIcon(name: string): LucideIcon {
  return ICONS[name] ?? LucideIcons.Activity;
}
