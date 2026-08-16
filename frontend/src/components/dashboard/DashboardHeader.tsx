import { Plus } from "lucide-react";
import { Link } from "react-router-dom";

import { PlatformIcon } from "@/components/PlatformIcon";
import { Button } from "@/components/ui/button";
import type { SocialAccount } from "@/types";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function DashboardHeader({ name, accounts }: { name?: string; accounts: SocialAccount[] }) {
  const firstName = name?.split(" ")[0];

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Command Center</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
          <span className="text-gradient-brand">
            {getGreeting()}
            {firstName ? `, ${firstName}` : ""}
          </span>
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">Here&apos;s what&apos;s happening across your accounts.</p>
      </div>

      <div className="flex items-center gap-4">
        {accounts.length > 0 && (
          <Link
            to="/accounts"
            className="glass-panel flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:bg-accent"
          >
            <div className="flex -space-x-2">
              {accounts.slice(0, 4).map((account) => (
                <div key={account.id} className="rounded-full ring-2 ring-card">
                  <PlatformIcon platform={account.platform} className="h-7 w-7" />
                </div>
              ))}
            </div>
            <span className="font-medium text-foreground">
              {accounts.length} account{accounts.length === 1 ? "" : "s"} connected
            </span>
          </Link>
        )}

        <Button asChild className="gap-1.5">
          <Link to="/posts/new">
            <Plus className="h-4 w-4" />
            Quick create post
          </Link>
        </Button>
      </div>
    </div>
  );
}
