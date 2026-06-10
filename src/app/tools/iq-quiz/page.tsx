"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Check, X, RotateCcw, ArrowRight } from "lucide-react";
import { spring } from "@/lib/motion";
import { ToolShell, Panel, Insight } from "@/components/tool/ToolShell";
import { Gauge } from "@/components/ui/Gauge";
import { getTool } from "@/lib/tools";
import { QUIZ } from "@/lib/engine/content";
import { gradeColor } from "@/lib/cn";

const ACCENT = "#B0688E"; // category color for "Player Tools"
const GREEN = "#5FA97E"; // correct answer
const WRONG = "#C57A47"; // muted negative tint for incorrect reads

export default function IqQuizPage() {
  const tool = getTool("iq-quiz")!;
  const [step, setStep] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const total = QUIZ.length;
  const question = QUIZ[step];
  const answered = chosen !== null;
  const isLast = step === total - 1;

  const pick = (i: number) => {
    if (answered) return;
    setChosen(i);
    if (i === question.correct) setScore((s) => s + 1);
  };

  const next = () => {
    if (isLast) {
      setFinished(true);
      return;
    }
    setStep((s) => s + 1);
    setChosen(null);
  };

  const reset = () => {
    setStep(0);
    setChosen(null);
    setScore(0);
    setFinished(false);
  };

  const pct = Math.round((score / total) * 100);
  const verdict = pct >= 80 ? "Court General" : pct >= 60 ? "Solid IQ" : "Keep studying";
  const verdictColor = gradeColor(pct);

  return (
    <ToolShell tool={tool}>
      <div className="mx-auto max-w-2xl">
        {/* progress dots */}
        {!finished && (
          <div className="mb-6 flex items-center justify-center gap-2">
            {QUIZ.map((_, i) => (
              <div
                key={i}
                className="h-2 w-7 rounded-lg transition-colors duration-300"
                style={{
                  backgroundColor:
                    i === step ? ACCENT : i < step ? `${ACCENT}66` : "rgba(255,255,255,0.12)",
                }}
              />
            ))}
            <span className="ml-3 stat-num text-xs text-white/60">
              {step + 1} / {total}
            </span>
          </div>
        )}

        <AnimatePresence mode="wait">
          {finished ? (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={spring.soft}
            >
              <Panel className="flex flex-col items-center py-10 text-center">
                <Gauge value={pct} color={verdictColor} label="IQ Score" />
                <div className="mt-5 display text-3xl text-white">{verdict}</div>
                <p className="mt-2 stat-num text-sm text-white/55">
                  You scored <b style={{ color: verdictColor }}>{score}</b> of {total} reads correct.
                </p>
                <p className="mt-4 max-w-sm text-sm text-white/50">
                  {pct >= 80
                    ? "Elite feel for spacing, rotations, and late-clock decisions. You see the floor like a coach."
                    : pct >= 60
                      ? "Strong fundamentals with a few reads to sharpen. Review the scenarios you missed."
                      : "The reps will pay off — re-run the scenarios and lock in the help and coverage rules."}
                </p>
                <motion.button
                  onClick={reset}
                  whileTap={{ scale: 0.96 }}
                  transition={spring.snappy}
                  className="mt-7 flex items-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold transition"
                  style={{ background: ACCENT, color: "var(--accent-ink)" }}
                >
                  <RotateCcw size={16} /> Retake quiz
                </motion.button>
              </Panel>
            </motion.div>
          ) : (
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={spring.soft}
            >
              <Panel>
                <div className="eyebrow mb-2" style={{ color: ACCENT }}>
                  Scenario {step + 1}
                </div>
                <h2 className="display text-2xl text-white">{question.q}</h2>
                <p className="mt-3 text-sm leading-relaxed text-white/65">{question.scenario}</p>

                <div className="mt-6 grid gap-3">
                  {question.options.map((opt, i) => {
                    const isCorrect = i === question.correct;
                    const isChosen = i === chosen;
                    let border = "border-white/10";
                    let bg = "bg-white/[0.03]";
                    let markColor: string | undefined;
                    if (answered) {
                      if (isCorrect) {
                        border = "border-transparent";
                        bg = "";
                        markColor = GREEN;
                      } else if (isChosen) {
                        border = "border-transparent";
                        bg = "";
                        markColor = WRONG;
                      }
                    }
                    return (
                      <motion.button
                        key={opt}
                        onClick={() => pick(i)}
                        disabled={answered}
                        whileTap={answered ? undefined : { scale: 0.98 }}
                        transition={spring.snappy}
                        className={`flex items-center justify-between rounded-lg border ${border} ${bg} px-4 py-3.5 text-left text-sm text-white/85 transition ${
                          !answered ? "hover:border-white/25 hover:bg-white/[0.05]" : ""
                        }`}
                        style={
                          markColor
                            ? { background: `${markColor}1a`, borderColor: `${markColor}66`, color: "#fff" }
                            : undefined
                        }
                      >
                        <span className="flex items-center gap-3">
                          <span
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold"
                            style={{
                              background: markColor ? markColor : "rgba(255,255,255,0.07)",
                              color: markColor ? "#0a0c11" : "rgba(255,255,255,0.6)",
                            }}
                          >
                            {markColor === GREEN ? <Check size={14} /> : markColor === WRONG ? <X size={14} /> : String.fromCharCode(65 + i)}
                          </span>
                          {opt}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>

                <AnimatePresence>
                {answered && (
                  <motion.div
                    className="mt-5"
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={spring.soft}
                  >
                    <Insight accent={chosen === question.correct ? GREEN : WRONG}>
                        <span className="font-semibold" style={{ color: chosen === question.correct ? GREEN : WRONG }}>
                          {chosen === question.correct ? "Correct read. " : "Not quite. "}
                        </span>
                        {question.explain}
                      </Insight>
                      <motion.button
                        onClick={next}
                        whileTap={{ scale: 0.96 }}
                        transition={spring.snappy}
                        className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold transition"
                        style={{ background: ACCENT, color: "var(--accent-ink)" }}
                      >
                      {isLast ? "See results" : "Next scenario"}
                      <ArrowRight size={16} />
                    </motion.button>
                  </motion.div>
                )}
                </AnimatePresence>
              </Panel>

              <div className="mt-4 flex items-center justify-center gap-2 text-xs text-white/60">
                <Brain size={14} style={{ color: ACCENT }} />
                Running score: <b className="stat-num text-white/70">{score}</b> / {step + (answered ? 1 : 0)}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-8 space-y-3">
        <div>
          <div className="kicker" style={{ color: "#B0688E" }}>Data &amp; method</div>
          <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
            These scenarios are hand-authored basketball decisions — spacing, help rotations,
            pick-and-roll coverages, and late-clock reads — each graded against a single coaching-standard
            answer with a written rationale. It is a knowledge check built from real on-court principles,
            not a trained model, so there is no learned prediction or validation metric behind it.
          </p>
        </div>
      </div>
    </ToolShell>
  );
}
