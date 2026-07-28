import { PlatformIcon } from "@/components/PlatformIcon";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn, initials } from "@/lib/utils";
import type { SocialAccount } from "@/types";

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
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {accounts.map((account) => {
        const selected = selectedIds.includes(account.id);
        return (
          <button
            type="button"
            key={account.id}
            onClick={() => onToggle(account.id)}
            className={cn(
              "flex items-center gap-3 rounded-lg border p-3 text-left transition-colors",
              selected ? "border-primary bg-primary/5" : "border-border hover:bg-accent"
            )}
          >
            <Avatar className="h-8 w-8">
              <AvatarImage src={account.avatar_url ?? undefined} alt={account.account_name} />
              <AvatarFallback>{initials(account.account_name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{account.account_name}</p>
            </div>
            <PlatformIcon platform={account.platform} />
            <div
              className={cn(
                "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                selected ? "border-primary bg-primary" : "border-input"
              )}
            >
              {selected && <div className="h-2 w-2 rounded-sm bg-primary-foreground" />}
            </div>
          </button>
        );
      })}
    </div>
  );
}
