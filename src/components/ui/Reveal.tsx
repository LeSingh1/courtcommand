import { cn } from "@/lib/cn";

// Scroll-driven reveal via CSS (animation-timeline: view()). Reliable, no JS,
// degrades to fully-visible where unsupported or when reduced-motion is set.

export function Reveal({
  children,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  return <div className={cn("reveal", className)}>{children}</div>;
}

export function Stagger({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
  gap?: number;
}) {
  return <div className={className}>{children}</div>;
}

export function StaggerItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("reveal", className)}>{children}</div>;
}

// On-load entrance with optional stagger index (use for above-the-fold content).
export function Enter({
  children,
  className,
  delay = 0,
  fade = false,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  fade?: boolean;
}) {
  return (
    <div className={cn(fade ? "enter-fade" : "enter", className)} style={{ animationDelay: `${delay}s` }}>
      {children}
    </div>
  );
}
