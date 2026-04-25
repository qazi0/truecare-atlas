// Shared Framer Motion variants for consistent animations across the app

export const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
};

export const slideInLeft = {
  hidden: { opacity: 0, x: -12 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.25 } },
};

export const slideInRight = {
  hidden: { opacity: 0, x: 12 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.25 } },
};

export const slideInUp = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2 } },
};

export const staggerContainer = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

export const staggerItem = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2 } },
};

// For evidence quotes — 100ms between items
export const evidenceStagger = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

export const evidenceItem = {
  hidden: { opacity: 0, y: 4 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.18 } },
};

// Spring for trust ring and number counts
export const springConfig = {
  type: "spring" as const,
  stiffness: 120,
  damping: 18,
};

// Pulse animation keyframes (used inline in components)
export const pulseGreen = {
  scale: [1, 1.15, 1],
  opacity: [1, 0.7, 1],
  transition: { duration: 1.2, repeat: Infinity, ease: "easeInOut" },
};

export const pulseRed = {
  scale: [1, 1.15, 1],
  opacity: [1, 0.6, 1],
  transition: { duration: 1.0, repeat: Infinity, ease: "easeInOut" },
};
