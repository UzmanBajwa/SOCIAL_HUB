import { ChevronsUpDown, Plus } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

// UI scaffold for multi-workspace switching. There is only ever one workspace
// today (the signed-in user's account) -- this exists so a future backend
// workspace concept can be dropped in without a nav restructure.
export function WorkspaceSwitcher({ collapsed }: { collapsed: boolean }) {
  const { user } = useAuth();
  const firstName = user?.name?.split(" ")[0] ?? "My";
  const workspaceName = `${firstName}'s Workspace`;
  const initial = (user?.name?.[0] ?? "W").toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title={collapsed ? workspaceName : undefined}
          className={cn(
            "flex w-full items-center gap-2 rounded-lg border border-border bg-secondary/50 px-2.5 py-2 text-sm transition-colors hover:bg-accent",
            collapsed && "justify-center px-0"
          )}
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gradient-brand text-[11px] font-bold text-white">
            {initial}
          </span>
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1 truncate text-left font-medium">{workspaceName}</span>
              <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Workspaces</DropdownMenuLabel>
        <DropdownMenuItem className="gap-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-gradient-brand text-[10px] font-bold text-white">
            {initial}
          </span>
          {workspaceName}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled className="gap-2 text-muted-foreground">
          <Plus className="h-3.5 w-3.5" />
          Add workspace
          <span className="ml-auto rounded-full bg-secondary px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide">
            Soon
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
