"use client";

import { useEffect, useState } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";

interface TrustRingProps {
  score: number;
  size?: number;
  strokeWidth?: number;
}

function scoreColor(score: number): string {
  if (score >= 70) return "var(--color-trust)";
  if (score >= 40) return "var(--color-caution)";
  return "var(--color-alert)";
}

export function TrustRing({ score, size = 120, strokeWidth = 10 }: TrustRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const cx = size / 2;
  const cy = size / 2;
  const color = scoreColor(score);

  const progressMotion = useMotionValue(0);
  const dashoffset = useTransform(
    progressMotion,
    (v) => circumference * (1 - v / 100)
  );
  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    const controls = animate(progressMotion, score, {
      duration: 0.9,
      ease: "easeOut",
      onUpdate: (v) => setDisplayScore(Math.round(v)),
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [score]);

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          style={{ transform: "rotate(-90deg)" }}
          className="absolute inset-0"
        >
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke="var(--color-border)"
            strokeWidth={strokeWidth}
          />
          <motion.circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            style={{ strokeDashoffset: dashoffset }}
          />
        </svg>
        <div
          className="absolute inset-0 flex flex-col items-center justify-center"
        >
          <span
            className="font-mono text-2xl font-semibold tabular-nums leading-none"
            style={{ color }}
          >
            {displayScore}
          </span>
        </div>
      </div>
      <p className="text-xs text-text-muted mt-2">Trust Score</p>
    </div>
  );
}
