"use client";

import { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function useAnalyze(steps: string[], duration = 1100) {
  const [phase, setPhase] = useState<"idle" | "running" | "done">("idle");
  const [stepIdx, setStepIdx] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const run = useCallback(
    (onDone?: () => void) => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
      setPhase("running");
      setStepIdx(0);
      const per = duration / steps.length;
      steps.forEach((_, i) => {
        timers.current.push(setTimeout(() => setStepIdx(i), per * i));
      });
      timers.current.push(
        setTimeout(() => {
          setPhase("done");
          onDone?.();
        }, duration),
      );
    },
    [steps, duration],
  );

  const reset = useCallback(() => {
    timers.current.forEach(clearTimeout);
    setPhase("idle");
    setStepIdx(0);
  }, []);

  return { phase, stepIdx, run, reset, steps };
}

export function AnalyzeOverlay({
  steps,
  stepIdx,
  accent = "#C8F23F",
}: {
  steps: string[];
  stepIdx: number;
  accent?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 border border-[var(--line)] bg-[var(--surface)] px-6 py-16">
      <div className="relative h-10 w-10">
        <motion.div
          className="h-10 w-10 rounded-full border border-[var(--line)]"
          style={{ borderTopColor: accent }}
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }}
        />
      </div>
      <div className="h-6 overflow-hidden text-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={stepIdx}
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -12, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="stat-num text-sm text-[var(--text-muted)]"
          >
            {steps[stepIdx]}
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="flex gap-1.5">
        {steps.map((_, i) => (
          <div
            key={i}
            className="h-px w-8 transition-colors"
            style={{ background: i <= stepIdx ? accent : "var(--line)" }}
          />
        ))}
      </div>
    </div>
  );
}
