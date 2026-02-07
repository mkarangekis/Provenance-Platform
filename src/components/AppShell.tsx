'use client';

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Layers,
  Search,
  FileText,
  DollarSign,
  Shield,
  Users,
  Radar,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Sparkles,
} from "lucide-react";
import type { AppShellProps } from "@/types";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Toaster } from "@/components/ui-ext";
import { cn } from "@/lib/utils";
import { featureFlags, type PageContext } from "@/lib/featureFlags";
import { AIInsightsTopPanel } from "@/components/ai/AIInsightsTopPanel";
import { SubscriptionGuard } from "@/components/billing/SubscriptionGuard";

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { id: "intake", label: "Intake", href: "/intake", icon: Layers },
  { id: "research", label: "Research", href: "/research", icon: Search },
  { id: "catalog", label: "Catalog", href: "/catalog", icon: FileText },
  { id: "valuation", label: "Valuation", href: "/valuation", icon: DollarSign },
  { id: "risk", label: "Risk", href: "/risk", icon: Shield },
  { id: "buyers", label: "Buyers", href: "/buyers", icon: Users },
  { id: "monitoring", label: "Monitoring", href: "/monitoring", icon: Radar },
  { id: "settings", label: "Settings", href: "/settings", icon: Settings },
];

const ROUTE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  intake: "Intake",
  research: "Research",
  catalog: "Catalog",
  valuation: "Valuation",
  risk: "Risk",
  buyers: "Buyers",
  monitoring: "Monitoring",
  settings: "Settings",
  auth: "Auth",
  setup: "Setup",
};

export function AppShell({
  children,
  navItems,
  user,
  org,
  primaryAction,
}: AppShellProps & { primaryAction?: { label: string; href?: string; onClick?: () => void } }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [currentUser, setCurrentUser] = useState<typeof user>(user ?? null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem("registrata:shell-collapsed");
    if (stored) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSidebarOpen(stored !== "true");
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("registrata:shell-collapsed", sidebarOpen ? "false" : "true");
  }, [sidebarOpen]);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (!data.session?.user) {
        router.push("/auth");
        return;
      }
      setCurrentUser(data.session.user);
      setAccessToken(data.session.access_token ?? null);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setSessionExpired(true);
        setAccessToken(null);
        return;
      }
      setAccessToken(session.access_token ?? null);
    });

    return () => {
      mounted = false;
      authListener?.subscription.unsubscribe();
    };
  }, [router]);

  const activeItems = navItems?.length ? navItems : NAV_ITEMS;
  const isActive = (href: string) => (href === "/dashboard" ? pathname === href : pathname.startsWith(href));

  const breadcrumbs = useMemo(() => {
    const segments = pathname.split("/").filter(Boolean);
    return segments.map((segment, index) => {
      const label = ROUTE_LABELS[segment] || "Detail";
      const href = "/" + segments.slice(0, index + 1).join("/");
      return { label, href };
    });
  }, [pathname]);

  const aiPanelContext: PageContext = useMemo(() => {
    const seg = pathname.split("/").filter(Boolean)[0] || "dashboard";
    if (seg === "dashboard") return "overview";
    if (seg === "objects" || seg === "intake") return "inventory";
    if (seg === "catalog" || seg === "valuation") return "ordering";
    if (seg === "risk" || seg === "review" || seg === "monitoring") return "variance";
    if (seg === "settings") return "settings";
    return "overview";
  }, [pathname]);

  const aiTopPanelEnabled = featureFlags.aiTopPanel;
  const isTopPanelAllowlisted = useMemo(() => {
    const first = pathname.split("/").filter(Boolean)[0] || "";
    return ["auth", "setup", "onboarding", "subscribe"].includes(first) === false;
  }, [pathname]);

  const handleSearch = () => {
    if (!searchValue.trim()) return;
    router.push(`/intake?query=${encodeURIComponent(searchValue.trim())}`);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/auth");
  };

  return (
    <div className="min-h-screen text-white">
      <Toaster />
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-border-muted bg-ink-900/70 backdrop-blur-2xl transition-transform duration-200",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center justify-between px-6 border-b border-border-muted">
          <Link href="/dashboard" className="flex items-center gap-3 font-semibold">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-primary text-ink-950 font-semibold shadow-glow">
              R
            </div>
            <span className="text-sm uppercase tracking-[0.2em] text-text-secondary">Registrata</span>
          </Link>
          <button
            className="hidden rounded-lg border border-border-muted p-2 text-text-muted hover:text-white md:flex"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle sidebar"
          >
            {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </div>

        {org && (
          <div className="mx-6 mt-4 rounded-2xl border border-border-muted bg-surface px-4 py-3 text-sm shadow-card">
            <div className="text-[11px] uppercase tracking-[0.2em] text-text-muted">Organization</div>
            <div className="mt-1 font-semibold text-text-primary">{org.name}</div>
          </div>
        )}

        <nav className="mt-6 flex-1 space-y-1 px-4">
          {activeItems.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon as React.ElementType;
            return (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary-500/10 text-primary-300 border border-primary-500/20"
                    : "text-text-secondary hover:text-text-primary border border-transparent hover:border-border-muted"
                )}
              >
                <Icon className={cn("h-4 w-4", active ? "text-primary-300" : "text-text-muted")} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="px-6 pb-6 space-y-3">
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-2xl border border-primary-500/30 bg-primary-500/10 px-4 py-3 text-xs font-semibold text-primary-200 shadow-glow"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-500/20">
              <Sparkles className="h-4 w-4" />
            </span>
            AI Command Center
          </button>
          <div className="rounded-2xl border border-border-muted bg-surface px-4 py-3 text-xs text-text-muted">
            AI-amplified provenance workflows for enterprise teams.
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-ink-950/70 backdrop-blur-sm md:hidden"
          aria-label="Close navigation"
        />
      )}

      <div className={cn("transition-all duration-200", sidebarOpen ? "md:ml-72" : "md:ml-0")}>
        <header className="sticky top-0 z-40 border-b border-border-muted bg-ink-950/80 backdrop-blur-2xl">
          <div className="flex h-16 items-center gap-4 px-6">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="rounded-lg border border-border-muted p-2 text-text-muted hover:text-white md:hidden"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            <div className="hidden lg:flex items-center gap-2 text-xs text-text-muted">
              {breadcrumbs.map((crumb, index) => (
                <span key={`${crumb.label}-${index}`} className="flex items-center gap-2">
                  <span className={index === breadcrumbs.length - 1 ? "text-text-primary font-medium" : ""}>
                    {crumb.label}
                  </span>
                  {index < breadcrumbs.length - 1 && <span>/</span>}
                </span>
              ))}
            </div>

            <div className="flex-1">
              <div className="relative max-w-xl">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                <Input
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      handleSearch();
                    }
                  }}
                  placeholder="Search artworks, research, and contacts..."
                  className="pl-10 bg-surface border-border-muted text-text-primary placeholder:text-text-muted"
                  aria-label="Global search"
                />
              </div>
            </div>

            {primaryAction && (
              <Button
                className="hidden md:inline-flex"
                onClick={primaryAction.onClick}
                asChild={Boolean(primaryAction.href)}
              >
                {primaryAction.href ? <Link href={primaryAction.href}>{primaryAction.label}</Link> : primaryAction.label}
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full border border-border-muted bg-surface px-2 py-1">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback>{(currentUser?.email || "U")[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="hidden text-xs font-medium text-text-secondary md:inline">
                    {currentUser?.email || "Account"}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <div className="px-3 py-2 text-xs text-muted-foreground">{currentUser?.email}</div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {sessionExpired && (
            <div className="border-t border-border-muted bg-amber-500/10 px-6 py-2 text-sm text-amber-200">
              Session expired.{" "}
              <button className="font-semibold underline" onClick={() => router.push("/auth")}>
                Sign in again
              </button>
            </div>
          )}
        </header>

        <main className="px-6 py-8 space-y-6">
          {/*
            org can be partially populated in some flows; only pass through a stable id when present.
          */}
          {aiTopPanelEnabled && isTopPanelAllowlisted ? (
            <AIInsightsTopPanel
              pageContext={aiPanelContext}
              orgId={typeof (org as any)?.id === "string" ? ((org as any).id as string) : null}
              locationId={null}
            />
          ) : null}
          <SubscriptionGuard
            enabled={featureFlags.subscriptionGating}
            accessToken={accessToken}
            pathname={pathname}
          >
            {children}
          </SubscriptionGuard>
        </main>
      </div>
    </div>
  );
}
