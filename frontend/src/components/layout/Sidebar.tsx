import {
  BarChart3,
  CalendarDays,
  ChevronLeft,
  LayoutDashboard,
  Link2,
  PlusCircle,
  Send,
  Settings,
  Sparkles,
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

function NavSectionLabel({ children, collapsed }: { children: string; collapsed: boolean }) {
  if (collapsed) return null;
  return (
    <p className="px-3 pb-1.5 pt-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/60">
      {children}
    </p>
  );
}

export function Sidebar({
  collapsed,
  onToggleCollapsed,
}: {
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  return (
    <aside
      className={cn(
        "glass-panel-strong relative z-10 hidden shrink-0 flex-col border-r border-border transition-[width] duration-200 ease-in-out md:flex",
        collapsed ? "w-[72px]" : "w-64"
      )}
    >
      <div className={cn("flex items-center gap-2.5 px-5 py-5", collapsed && "justify-center px-0")}>
        <div className="relative flex h-9 w-9 shrink-0 items-center justify-center">
          <span className="absolute inset-0 animate-glow-pulse rounded-xl bg-gradient-brand blur-md" />
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-brand text-sm font-bold text-white">
            S
          </div>
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-base font-semibold leading-tight tracking-tight">SocialHub</p>
            <p className="truncate text-[11px] font-medium leading-tight text-muted-foreground">Command Center</p>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-3">
        <NavSectionLabel collapsed={collapsed}>Command Center</NavSectionLabel>
        <div className="space-y-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end, badge }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                cn(
                  "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  collapsed && "justify-center px-0",
                  isActive
                    ? "bg-primary/10 text-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-gradient-brand shadow-[0_0_10px_2px_rgba(124,58,237,0.6)]" />
                  )}
                  <Icon className={cn("h-4 w-4 shrink-0", isActive && "text-primary")} />
                  {!collapsed && (
                    <span className="flex flex-1 items-center justify-between truncate">
                      {label}
                      {badge && (
                        <span className="ml-2 shrink-0 rounded-full bg-gradient-brand px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">
                          {badge}
                        </span>
                      )}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </div>

        <div
          className={cn(
            "mt-1 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground/60",
            collapsed && "justify-center px-0"
          )}
          title={collapsed ? "Analytics (coming soon)" : undefined}
        >
          <BarChart3 className="h-4 w-4 shrink-0" />
          {!collapsed && (
            <span className="flex flex-1 items-center justify-between truncate">
              Analytics
              <span className="ml-2 shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Soon
              </span>
            </span>
          )}
        </div>

        <div className={cn("my-3 border-t border-border", collapsed && "mx-1")} />

        <NavSectionLabel collapsed={collapsed}>Workspace</NavSectionLabel>
        <WorkspaceSwitcher collapsed={collapsed} />

        <div className={cn("my-3 border-t border-border", collapsed && "mx-1")} />

        <NavLink
          to="/settings"
          title={collapsed ? "Settings" : undefined}
          className={({ isActive }) =>
            cn(
              "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              collapsed && "justify-center px-0",
              isActive ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )
          }
        >
          {({ isActive }) => (
            <>
              <Settings className={cn("h-4 w-4 shrink-0", isActive && "text-primary")} />
              {!collapsed && <span className="truncate">Settings</span>}
            </>
          )}
        </NavLink>
      </nav>

      <div className="border-t border-border p-3">
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="flex w-full items-center justify-center gap-2 rounded-lg py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <ChevronLeft className={cn("h-4 w-4 transition-transform duration-200", collapsed && "rotate-180")} />
          {!collapsed && "Collapse"}
        </button>
      </div>
    </aside>
  );
}
