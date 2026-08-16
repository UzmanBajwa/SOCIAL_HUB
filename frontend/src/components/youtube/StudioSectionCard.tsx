import type { ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StudioSectionCardProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  badge?: ReactNode;
  className?: string;
  contentClassName?: string;
  children: ReactNode;
}

export function StudioSectionCard({
  title,
  description,
  icon,
  badge,
  className,
  contentClassName,
  children,
}: StudioSectionCardProps) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 border-b border-border/60 bg-card/40 px-5 py-4">
        <div className="flex items-center gap-3">
          {icon && (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {icon}
            </span>
          )}
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            {description && (
              <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
            )}
          </div>
        </div>
        {badge}
      </CardHeader>
      <CardContent className={cn("space-y-4 p-5", contentClassName)}>{children}</CardContent>
    </Card>
  );
}
