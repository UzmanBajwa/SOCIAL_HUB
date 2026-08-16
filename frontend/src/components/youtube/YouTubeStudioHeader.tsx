import { Check, ChevronDown, Youtube } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { SocialAccount } from "@/types";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

interface YouTubeStudioHeaderProps {
  accounts: SocialAccount[];
  account: SocialAccount | undefined;
  disabled?: boolean;
  onAccountChange: (id: string) => void;
}

export function YouTubeStudioHeader({
  accounts,
  account,
  disabled,
  onAccountChange,
}: YouTubeStudioHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-500/10 text-red-500">
          <Youtube className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">YouTube Studio</h1>
          <p className="text-sm text-muted-foreground">
            Upload and publish videos to your YouTube channel.
          </p>
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className={cn(
              "flex items-center gap-2.5 rounded-xl border border-border bg-card/60 px-3 py-2 shadow-sm transition-colors hover:border-primary/40 hover:bg-card",
              disabled && "cursor-not-allowed opacity-50"
            )}
          >
            <Avatar className="h-8 w-8">
              <AvatarImage src={account?.avatar_url ?? undefined} alt={account?.account_name} />
              <AvatarFallback>{initials(account?.account_name ?? "YT")}</AvatarFallback>
            </Avatar>
            <span className="text-left">
              <span className="block max-w-44 truncate text-sm font-medium leading-tight">
                {account?.account_name ?? "Select a channel"}
              </span>
              <span className="block text-xs leading-tight text-muted-foreground">
                {account ? "Switch channel" : "Choose a channel"}
              </span>
            </span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel>Channels</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {accounts.map((a) => (
            <DropdownMenuItem
              key={a.id}
              onClick={() => onAccountChange(a.id)}
              disabled={disabled}
              className="flex items-center gap-2.5 py-2"
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src={a.avatar_url ?? undefined} alt={a.account_name} />
                <AvatarFallback>{initials(a.account_name)}</AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{a.account_name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {a.account_username ?? "YouTube channel"}
                </span>
              </span>
              {a.id === account?.id && <Check className="h-4 w-4 shrink-0 text-primary" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
