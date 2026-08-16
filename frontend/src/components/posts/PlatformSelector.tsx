import { Check } from "lucide-react";

import { PlatformIcon } from "@/components/PlatformIcon";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn, initials } from "@/lib/utils";
import type { Platform, SocialAccount } from "@/types";

const ACCOUNT_TYPE_LABEL: Record<Platform, string> = {
  facebook: "Facebook Page",
  instagram: "Instagram Business",
  linkedin: "LinkedIn Company Page",
  youtube: "YouTube Channel",
};

export function PlatformSelector({
  accounts,
  selectedIds,
  onToggle,
}: {
  accounts: SocialAccount[];
  selectedIds: string[];
  onToggle: (accountId: string) => void;
}) {
  if (!accounts.length) {
    return (
      <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
        No connected accounts yet. Connect one from the Accounts page first.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {accounts.map((account) => {
        const selected = selectedIds.includes(account.id);
        return (
          <button
            type="button"
            key={account.id}
            onClick={() => onToggle(account.id)}
            className={cn(
              "group relative flex items-center gap-3 rounded-xl border p-3 text-left transition-all",
              selected
                ? "border-primary/50 bg-primary/5 glow-brand-sm"
                : "border-border hover:border-primary/40 hover:bg-accent"
            )}
          >
            <Avatar className="h-10 w-10">
              <AvatarImage src={account.avatar_url ?? undefined} alt={account.account_name} />
              <AvatarFallback>{initials(account.account_name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium leading-tight">{account.account_name}</p>
              <p className="truncate text-xs text-muted-foreground">{ACCOUNT_TYPE_LABEL[account.platform]}</p>
            </div>
            <PlatformIcon platform={account.platform} />
            <div
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                selected ? "border-transparent bg-gradient-brand" : "border-input bg-background"
              )}
            >
              {selected && <Check className="h-3 w-3 text-primary-foreground" />}
            </div>
          </button>
        );
      })}
    </div>
  );
}
