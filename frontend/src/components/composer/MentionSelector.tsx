import { AtSign, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";

import { searchFacebookMentions } from "@/api/facebook";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { Mention } from "@/types";

export function MentionSelector({
  accountId,
  mentions,
  onSelect,
  onRemove,
  disabled,
}: {
  accountId: string;
  mentions: Mention[];
  onSelect: (mention: Mention) => void;
  onRemove: (id: string) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Mention[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setIsSearching(true);
      try {
        const data = await searchFacebookMentions(accountId, query);
        setResults(data);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [query, accountId]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <AtSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search Pages to mention (e.g. WHO, AHA)"
          className="pl-9"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 150)}
          disabled={disabled}
        />
        {isOpen && (query.trim() || isSearching) && (
          <div className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-card shadow-md">
            {isSearching ? (
              <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching...
              </div>
            ) : results.length ? (
              results.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onSelect(r);
                    setQuery("");
                    setResults([]);
                  }}
                  className="flex w-full items-center px-3 py-2 text-left text-sm hover:bg-accent"
                >
                  {r.name}
                </button>
              ))
            ) : (
              <div className="p-3 text-sm text-muted-foreground">No Pages found.</div>
            )}
          </div>
        )}
      </div>

      {mentions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {mentions.map((m) => (
            <Badge key={m.id} variant="secondary" className="gap-1">
              @{m.name}
              {!disabled && (
                <button type="button" onClick={() => onRemove(m.id)} aria-label={`Remove mention ${m.name}`}>
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
