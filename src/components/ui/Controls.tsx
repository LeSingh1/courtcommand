"use client";

import { useId } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

export function Badge({
  children,
  color = "#4D8DFF",
  soft = true,
  className,
}: {
  children: React.ReactNode;
  color?: string;
  soft?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-lg px-2.5 py-0.5 text-[11px] font-medium",
        className,
      )}
      style={
        soft
          ? { background: `${color}1f`, color, border: `1px solid ${color}33` }
          : { background: color, color: "#0a0c11" }
      }
    >
      {children}
    </span>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  accent = "#4D8DFF",
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
  accent?: string;
}) {
  const groupId = useId();
  return (
    <div className="inline-flex flex-wrap gap-1 border border-[var(--line)] bg-[var(--surface)] p-1">
      {options.map((o) => {
        const sel = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            aria-pressed={sel}
            className={cn(
              "relative cursor-pointer px-3 py-1.5 text-xs font-medium transition-colors",
              sel ? "text-[var(--accent-ink)]" : "text-[var(--text-muted)] hover:text-[var(--text)]",
            )}
          >
            {sel && (
              <motion.span
                layoutId={`seg-${groupId}`}
                className="absolute inset-0"
                style={{ background: accent }}
                transition={{ type: "spring", stiffness: 320, damping: 30 }}
              />
            )}
            <span className="relative z-10">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  onChange,
  accent = "#4D8DFF",
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
  accent?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs text-white/55">{label}</span>
        <span className="stat-num text-xs font-semibold text-white">
          {value}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-lg outline-none"
        style={{
          background: `linear-gradient(90deg, ${accent} ${pct}%, rgba(255,255,255,0.1) ${pct}%)`,
        }}
      />
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-medium text-white/60">{label}</span>
        {hint && <span className="text-[10px] text-white/35">{hint}</span>}
      </div>
      {children}
    </label>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string | number;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-white/25"
    />
  );
}
