import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  BookOpen,
  Image,
  Megaphone,
  Flame,
  ShieldCheck,
  LogOut,
  Trophy,
  Settings,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useIsAdmin } from "@/hooks/use-auth";

const items = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Leaderboard", url: "/leaderboard", icon: Trophy },
  { title: "Belt Curriculum", url: "/curriculum", icon: BookOpen },
  { title: "Media Gallery", url: "/gallery", icon: Image },
  { title: "Announcements", url: "/announcements", icon: Megaphone },
  { title: "Account Settings", url: "/settings", icon: Settings },
];


export function AppSidebar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useSession();
  const { data: isAdmin } = useIsAdmin(user?.id);

  const handleSignOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-gradient-red shadow-red-glow">
            <Flame className="h-5 w-5 text-white" strokeWidth={2.5} />
          </div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <div className="font-display text-lg font-bold uppercase leading-none tracking-wider text-sidebar-foreground">
              Tiger's Den
            </div>
            <div className="mt-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Martial Arts &amp; Fitness
            </div>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = pathname === item.url;
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={active} className="relative data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground">
                      <Link to={item.url} className="flex items-center gap-3">
                        {active && <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-primary" />}
                        <item.icon className={`h-4 w-4 shrink-0 ${active ? "text-primary" : ""}`} />
                        <span className="font-medium">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs uppercase tracking-[0.2em] text-primary">Staff</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname === "/admin"} className="relative data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground">
                    <Link to="/admin" className="flex items-center gap-3">
                      <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
                      <span className="font-medium">Admin Console</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4 group-data-[collapsible=icon]:hidden">
        <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/50 p-3">
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Signed in as</div>
          <div className="mt-1 truncate text-sm font-semibold text-sidebar-foreground">
            {user?.email ?? "—"}
          </div>
          {isAdmin && (
            <div className="mt-1 flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-primary">
              <ShieldCheck className="h-3 w-3" /> Admin
            </div>
          )}
        </div>
        {user && (
          <button onClick={handleSignOut} className="mt-3 flex w-full items-center justify-center gap-2 rounded-md border border-sidebar-border px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground">
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
