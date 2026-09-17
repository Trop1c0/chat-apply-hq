import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LayoutDashboard, LogOut, Settings, Radio } from "lucide-react";
import type { ReactNode } from "react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Link to="/dashboard" className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-md bg-primary/15 text-primary">
              <Radio className="size-4" />
            </span>
            <span className="font-display text-sm font-semibold tracking-tight sm:text-base">
              Recruit<span className="text-primary">Ops</span>
            </span>
          </Link>

          <nav className="ml-4 flex items-center gap-1">
            <Link to="/dashboard">
              {({ isActive }) => (
                <Button variant={isActive ? "secondary" : "ghost"} size="sm" className="gap-2">
                  <LayoutDashboard className="size-4" />
                  <span className="hidden sm:inline">Заявки</span>
                </Button>
              )}
            </Link>
            <Link to="/settings">
              {({ isActive }) => (
                <Button variant={isActive ? "secondary" : "ghost"} size="sm" className="gap-2">
                  <Settings className="size-4" />
                  <span className="hidden sm:inline">Настройки</span>
                </Button>
              )}
            </Link>
          </nav>

          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <Button variant="ghost" size="icon" aria-label="Выйти" onClick={signOut}>
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
