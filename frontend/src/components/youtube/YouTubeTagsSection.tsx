import { useRef, useState } from "react";
import { Tags, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { StudioSectionCard } from "./StudioSectionCard";

interface YouTubeTagsSectionProps {
  tags: string[];
  disabled?: boolean;
  onChange: (tags: string[]) => void;
}

const MAX_TAGS = 20;
const MAX_TAG_CHARS = 500;

export function YouTubeTagsSection({ tags, disabled, onChange }: YouTubeTagsSectionProps) {
  const [tagInput, setTagInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const usedChars = tags.reduce((sum, tag) => sum + tag.length, 0);

  const addTags = (raw: string) => {
    const candidates = raw
      .split(/[,\n]/)
      .map((t) => t.trim())
      .filter(Boolean);
    if (!candidates.length) return;
    const next = [...tags];
    for (const candidate of candidates) {
      if (next.length >= MAX_TAGS) break;
      if (next.some((t) => t.toLowerCase() === candidate.toLowerCase())) continue;
      const projected = next.reduce((sum, t) => sum + t.length, 0) + candidate.length;
      if (projected > MAX_TAG_CHARS) break;
      next.push(candidate);
    }
    onChange(next);
  };

  return (
    <StudioSectionCard
      title="Tags"
      description="Tags can be useful if your video content is commonly misspelled."
      icon={<Tags className="h-4 w-4" />}
      badge={
        <span className="text-xs tabular-nums text-muted-foreground">
          {usedChars}/{MAX_TAG_CHARS}
        </span>
      }
    >
      <div
        className={cn(
          "flex min-h-11 w-full flex-wrap items-center gap-1.5 rounded-xl border border-input bg-background/60 px-3 py-2 text-sm shadow-sm transition-colors focus-within:ring-2 focus-within:ring-ring/40",
          disabled && "cursor-not-allowed opacity-50"
        )}
        onClick={() => !disabled && inputRef.current?.focus()}
      >
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
          >
            {tag}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange(tags.filter((t) => t !== tag));
              }}
              disabled={disabled}
              className="text-primary/60 transition-colors hover:text-primary"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={tagInput}
          disabled={disabled}
          placeholder={
            tags.length ? "" : `Add up to ${MAX_TAGS} tags (Enter or comma to add)`
          }
          className="min-w-28 flex-1 border-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              addTags(tagInput);
              setTagInput("");
            } else if (e.key === "Backspace" && !tagInput && tags.length) {
              onChange(tags.slice(0, -1));
            }
          }}
          onBlur={() => {
            addTags(tagInput);
            setTagInput("");
          }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {tags.length}/{MAX_TAGS} tags · comma-separated or press Enter ·{" "}
        {MAX_TAG_CHARS - usedChars} characters remaining
      </p>
    </StudioSectionCard>
  );
}
