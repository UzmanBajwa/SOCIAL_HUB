import { Baby } from "lucide-react";

import { cn } from "@/lib/utils";
import { StudioSectionCard } from "./StudioSectionCard";

interface YouTubeAudienceSectionProps {
  madeForKids: boolean | null;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}

const OPTIONS: { value: boolean; title: string; description: string }[] = [
  { value: false, title: "No, it's not made for kids", description: "For content that doesn't target young children." },
  { value: true, title: "Yes, it's made for kids", description: "For content that's directed at children under 13." },
];

export function YouTubeAudienceSection({
  madeForKids,
  disabled,
  onChange,
}: YouTubeAudienceSectionProps) {
  return (
    <StudioSectionCard
      title="Audience"
      description="You'll need to select whether this video is made for kids."
      icon={<Baby className="h-4 w-4" />}
    >
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {OPTIONS.map((option) => (
          <button
            key={String(option.value)}
            type="button"
            onClick={() => onChange(option.value)}
            disabled={disabled}
            className={cn(
              "flex flex-col items-start gap-1 rounded-xl border px-4 py-3 text-left transition-colors",
              madeForKids === option.value
                ? "border-primary/60 bg-primary/10 ring-1 ring-primary/40"
                : "border-border hover:border-primary/30",
              disabled && "cursor-not-allowed opacity-50"
            )}
          >
            <span className="flex items-center gap-2.5 text-sm font-medium">
              <span
                className={cn(
                  "flex h-4 w-4 items-center justify-center rounded-full border transition-colors",
                  madeForKids === option.value ? "border-primary" : "border-muted-foreground/40"
                )}
              >
                {madeForKids === option.value && (
                  <span className="h-2 w-2 rounded-full bg-primary" />
                )}
              </span>
              {option.title}
            </span>
            <span className="pl-[26px] text-xs leading-snug text-muted-foreground">
              {option.description}
            </span>
          </button>
        ))}
      </div>
      {madeForKids === null && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Please choose an option before publishing. This is a YouTube COPPA requirement.
        </p>
      )}
    </StudioSectionCard>
  );
}
