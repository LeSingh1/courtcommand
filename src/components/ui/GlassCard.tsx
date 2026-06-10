import { cn } from "@/lib/cn";

export function GlassCard({
  children,
  className,
  strong,
  glow,
}: {
  children: React.ReactNode;
  className?: string;
  strong?: boolean;
  glow?: string;
}) {
  return (
    <div
      className={cn(
        strong ? "glass-strong" : "glass",
        "rounded-lg",
        glow,
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SectionLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("eyebrow text-white/45", className)}>{children}</div>
  );
}
