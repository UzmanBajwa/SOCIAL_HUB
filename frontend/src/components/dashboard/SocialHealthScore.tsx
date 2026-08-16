import { motion } from "framer-motion";
import { useEffect, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const DEMO_SCORE = 86;
const METRICS = [
  { label: "Consistency", value: 92 },
  { label: "Activity", value: 80 },
  { label: "Growth", value: 85 },
];

const RADIUS = 52;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function ScoreRing({ score }: { score: number }) {
  const [animated, setAnimated] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(score), 150);
    return () => clearTimeout(t);
  }, [score]);

  const offset = CIRCUMFERENCE - (animated / 100) * CIRCUMFERENCE;

  return (
    <div className="relative flex h-[132px] w-[132px] shrink-0 items-center justify-center">
      <svg width="132" height="132" viewBox="0 0 132 132" className="-rotate-90">
        <circle cx="66" cy="66" r={RADIUS} strokeWidth="10" className="stroke-secondary" fill="none" />
        <motion.circle
          cx="66"
          cy="66"
          r={RADIUS}
          strokeWidth="10"
          strokeLinecap="round"
          fill="none"
          stroke="url(#health-score-gradient)"
          strokeDasharray={CIRCUMFERENCE}
          initial={{ strokeDashoffset: CIRCUMFERENCE }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.1, ease: "easeOut" }}
        />
        <defs>
          <linearGradient id="health-score-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#a78bfa" />
            <stop offset="100%" stopColor="#22d3ee" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-3xl font-semibold tracking-tight">{score}</span>
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">/ 100</span>
      </div>
    </div>
  );
}

export function SocialHealthScore() {
  return (
    <Card className="shadow-soft">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Social Health Score</CardTitle>
        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[10px] font-medium text-amber-600 dark:text-amber-400">
          Demo Score
        </span>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
        <ScoreRing score={DEMO_SCORE} />
        <div className="w-full space-y-3">
          {METRICS.map((metric, i) => (
            <div key={metric.label}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-medium text-muted-foreground">{metric.label}</span>
                <span className="font-semibold">{metric.value}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                <motion.div
                  className="h-full rounded-full bg-gradient-brand"
                  initial={{ width: 0 }}
                  animate={{ width: `${metric.value}%` }}
                  transition={{ duration: 0.8, delay: 0.2 + i * 0.1, ease: "easeOut" }}
                />
              </div>
            </div>
          ))}
          <p className="pt-1 text-[11px] text-muted-foreground">
            Sample data &mdash; real metrics will appear here once Analytics is connected.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
