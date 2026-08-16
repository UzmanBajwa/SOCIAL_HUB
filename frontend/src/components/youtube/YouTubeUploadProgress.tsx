import { cn } from "@/lib/utils";

interface YouTubeUploadProgressProps {
  percent: number;
  className?: string;
  label?: string;
}

export function YouTubeUploadProgress({ percent, className, label }: YouTubeUploadProgressProps) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-muted-foreground">{label}</span>
          <span className="tabular-nums font-semibold">{clamped}%</span>
        </div>
      )}
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-primary/10">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-red-500 to-red-400 transition-[width] duration-200 ease-out"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

export function YouTubeUploadPulse() {
  return (
    <div className="relative h-2 w-full overflow-hidden rounded-full bg-primary/10">
      <div className="absolute inset-y-0 left-0 w-1/3 animate-pulse rounded-full bg-gradient-to-r from-red-500 to-red-400" />
    </div>
  );
}
