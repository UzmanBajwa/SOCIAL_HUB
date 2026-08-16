import {
  BarChart3,
  CalendarDays,
  LayoutDashboard,
  Link2,
  PlusCircle,
  Send,
  Settings,
  Sparkles,
  X,
  Youtube,
} from "lucide-react";
import { NavLink } from "react-router-dom";

import { WorkspaceSwitcher } from "@/components/layout/WorkspaceSwitcher";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/posts/new", label: "Create", icon: PlusCircle },
  { to: "/youtube-studio", label: "YouTube Studio", icon: Youtube },
  { to: "/ai-studio", label: "AI Studio", icon: Sparkles, badge: "New" },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/posts", label: "Posts", icon: Send, end: true },
  { to: "/accounts", label: "Accounts", icon: Link2 },
];

export function MobileSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <div className="absolute inset-0 animate-in fade-in-0 bg-black/50" onClick={onClose} />
      <aside className="glass-panel-strong relative flex h-full w-72 animate-in slide-in-from-left duration-200 flex-col">
        <div className="flex items-center justify-between px-5 py-5">
          <div className="flex items-center gap-2.5">
            <div className="relative flex h-9 w-9 shrink-0 items-center justify-center">
              <span className="absolute inset-0 animate-glow-pulse rounded-xl bg-gradient-brand blur-md" />
              <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-brand text-sm font-bold text-white">
                S
              </div>
            </div>
            <div>
              <p className="text-base font-semibold leading-tight tracking-tight">SocialHub</p>
              <p className="text-[11px] font-medium leading-tight text-muted-foreground">Command Center</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close menu">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-3">
          <p className="px-3 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/60">
            Command Center
          </p>
          <div className="space-y-1">
            {NAV_ITEMS.map(({ to, label, icon: Icon, end, badge }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={onClose}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-accent"
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className={cn("h-4 w-4", isActive && "text-primary")} />
                    <span className="flex flex-1 items-center justify-between truncate">
                      {label}
                      {badge && (
                        <span className="ml-2 shrink-0 rounded-full bg-gradient-brand px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">
                          {badge}
                        </span>
                      )}
                    </span>
                  </>
                )}
              </NavLink>
            ))}
          </div>

          <div className="mt-1 flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground/60">
            <span className="flex items-center gap-3">
              <BarChart3 className="h-4 w-4" />
              Analytics
            </span>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Soon
            </span>
          </div>

          <div className="my-3 border-t border-border" />

          <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/60">
            Workspace
          </p>
          <WorkspaceSwitcher collapsed={false} />

          <div className="my-3 border-t border-border" />

          <NavLink
            to="/settings"
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-accent"
              )
            }
          >
            {({ isActive }) => (
              <>
                <Settings className={cn("h-4 w-4", isActive && "text-primary")} />
                Settings
              </>
            )}
          </NavLink>
        </nav>
      </aside>
    </div>
  );
}
