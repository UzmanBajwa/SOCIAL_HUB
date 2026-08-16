import { Loader2, MapPin, X } from "lucide-react";
import { useEffect, useState } from "react";

import { searchFacebookLocations } from "@/api/facebook";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { PostLocation } from "@/types";

export function LocationPicker({
  accountId,
  location,
  onSelect,
  onClear,
  disabled,
}: {
  accountId: string;
  location: PostLocation | null;
  onSelect: (location: PostLocation) => void;
  onClear: () => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PostLocation[]>([]);
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
        setResults(await searchFacebookLocations(accountId, query));
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [query, accountId]);

  if (location) {
    return (
      <Badge variant="secondary" className="gap-1.5 py-1.5">
        <MapPin className="h-3.5 w-3.5" />
        {location.name}
        {!disabled && (
          <button type="button" onClick={onClear} aria-label="Remove location">
            <X className="h-3 w-3" />
          </button>
        )}
      </Badge>
    );
  }

  return (
    <div className="relative">
      <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder="Search a location to attach"
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
            <div className="p-3 text-sm text-muted-foreground">No locations found.</div>
          )}
        </div>
      )}
    </div>
  );
}
