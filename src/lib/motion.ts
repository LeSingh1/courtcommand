// Shared motion system — one rhythm across the whole app.
// Framer Motion tokens/springs/variants. Durations + easings follow the
// ui-ux-pro-max animation rules; springs follow motion-foundations.

import type { Variants, Transition } from "framer-motion";

export const ease = {
  out: [0.22, 1, 0.36, 1] as const,
  inOut: [0.4, 0, 0.2, 1] as const,
};

export const dur = { fast: 0.18, normal: 0.3, slow: 0.5 };

export const spring = {
  snappy: { type: "spring", stiffness: 320, damping: 30 } as Transition,
  gentle: { type: "spring", stiffness: 140, damping: 16 } as Transition,
  soft: { type: "spring", stiffness: 220, damping: 26 } as Transition,
  bouncy: { type: "spring", stiffness: 420, damping: 18 } as Transition,
};

// Entrance for content revealed by a user action (tool results, slips).
export const fadeUp: Variants = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { duration: dur.normal, ease: ease.out } },
  exit: { opacity: 0, y: -8, transition: { duration: dur.fast, ease: ease.inOut } },
};

export const scaleIn: Variants = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1, transition: spring.soft },
  exit: { opacity: 0, scale: 0.97, transition: { duration: dur.fast } },
};

// Stagger container + item for lists/leaderboards revealed on action.
export const staggerParent: Variants = {
  animate: { transition: { staggerChildren: 0.04, delayChildren: 0.02 } },
};
export const staggerItem: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.28, ease: ease.out } },
  exit: { opacity: 0, y: -6, transition: { duration: dur.fast } },
};

// Reusable interaction props (always reliable — event-driven).
export const hoverLift = {
  whileHover: { y: -4 },
  whileTap: { scale: 0.985 },
  transition: spring.snappy,
} as const;

export const pressable = {
  whileTap: { scale: 0.96 },
  transition: spring.snappy,
} as const;

export const tapScale = {
  whileHover: { scale: 1.04 },
  whileTap: { scale: 0.95 },
  transition: spring.snappy,
} as const;
