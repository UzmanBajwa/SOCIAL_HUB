import { useQuery } from "@tanstack/react-query";
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { motion } from "framer-motion";
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { fetchPosts } from "@/api/posts";
import { CalendarPostChip } from "@/components/calendar/CalendarPostChip";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Post } from "@/types";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function Calendar() {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const { data: posts, isLoading } = useQuery({ queryKey: ["posts"], queryFn: fetchPosts });

  const postsByDay = useMemo(() => {
    const map = new Map<string, Post[]>();
    for (const post of posts ?? []) {
      const dateStr = post.publish_date ?? post.created_at;
      const key = format(new Date(dateStr), "yyyy-MM-dd");
      map.set(key, [...(map.get(key) ?? []), post]);
    }
    return map;
  }, [posts]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month));
    const end = endOfWeek(endOfMonth(month));
    const result: Date[] = [];
    let cursor = start;
    while (cursor <= end) {
      result.push(cursor);
      cursor = addDays(cursor, 1);
    }
    return result;
  }, [month]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <CalendarDays className="h-6 w-6 text-primary" />
            Calendar
          </h1>
          <p className="text-sm text-muted-foreground">A month-at-a-glance view of your drafts and posts.</p>
        </div>
        <Button asChild className="gap-1.5">
          <Link to="/posts/new">
            <Plus className="h-4 w-4" />
            Create post
          </Link>
        </Button>
      </div>

      <Card className="shadow-soft">
        <CardContent className="p-4">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-lg font-semibold">{format(month, "MMMM yyyy")}</p>
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="sm" onClick={() => setMonth((m) => subMonths(m, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setMonth(startOfMonth(new Date()))}>
                Today
              </Button>
              <Button variant="outline" size="sm" onClick={() => setMonth((m) => addMonths(m, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {isLoading ? (
            <Skeleton className="h-[560px]" />
          ) : (
            <div className="overflow-x-auto">
            <div className="grid min-w-[640px] grid-cols-7 gap-px overflow-hidden rounded-lg border border-border bg-border">
              {WEEKDAYS.map((day) => (
                <div key={day} className="bg-card px-2 py-1.5 text-center text-xs font-medium text-muted-foreground">
                  {day}
                </div>
              ))}
              {days.map((day) => {
                const key = format(day, "yyyy-MM-dd");
                const dayPosts = postsByDay.get(key) ?? [];
                const inMonth = isSameMonth(day, month);
                return (
                  <motion.div
                    key={key}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.15 }}
                    className={cn(
                      "min-h-[104px] space-y-1 bg-card p-1.5",
                      !inMonth && "bg-secondary/40 text-muted-foreground/50"
                    )}
                  >
                    <span
                      className={cn(
                        "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                        isToday(day) && "bg-primary text-primary-foreground"
                      )}
                    >
                      {format(day, "d")}
                    </span>
                    <div className="space-y-1">
                      {dayPosts.slice(0, 3).map((post) => (
                        <CalendarPostChip key={post.id} post={post} />
                      ))}
                      {dayPosts.length > 3 && (
                        <p className="px-1 text-[10px] text-muted-foreground">+{dayPosts.length - 3} more</p>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
            </div>
          )}

          {!isLoading && !postsByDay.size && (
            <p className="mt-3 text-center text-sm text-muted-foreground">
              No posts yet.{" "}
              <Link to="/posts/new" className="font-medium text-primary hover:underline">
                Create your first one
              </Link>
              .
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        {(
          [
            ["bg-muted-foreground", "Draft"],
            ["bg-primary", "Scheduled"],
            ["bg-success", "Published"],
            ["bg-destructive", "Failed"],
          ] as const
        ).map(([color, label]) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className={cn("h-2 w-2 rounded-full", color)} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
