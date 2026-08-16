import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: number | string;
  accentClassName?: string;
  trend?: {
    value: number;
    label?: string;
  };
  index?: number;
}

export function StatCard({ icon: Icon, label, value, accentClassName, trend, index = 0 }: StatCardProps) {
  const isPositive = trend ? trend.value >= 0 : true;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05, ease: "easeOut" }}
      whileHover={{ y: -3 }}
    >
      <Card className="group overflow-hidden shadow-soft transition-all hover:shadow-soft-lg hover:border-primary/30">
        <CardContent className="flex items-center gap-4 p-5">
          <div
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15 transition-transform group-hover:scale-105",
              accentClassName
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-semibold leading-none tracking-tight">{value}</p>
              {trend && (
                <span
                  className={cn(
                    "flex items-center gap-0.5 text-xs font-medium",
                    isPositive ? "text-success" : "text-destructive"
                  )}
                >
                  {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {Math.abs(trend.value)}%
                </span>
              )}
            </div>
            <p className="mt-1 truncate text-sm text-muted-foreground">{label}</p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
