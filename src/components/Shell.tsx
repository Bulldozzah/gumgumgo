import { ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { Sidebar, SidebarNavItem } from "./ui/modern-side-bar";

export type NavItem = SidebarNavItem;

const handleLogout = async () => {
  await supabase.auth.signOut();
  window.location.href = "/";
};

/**
 * App shell: collapsible white sidebar (nav + profile + sign out) on desktop,
 * hamburger drawer on mobile, light-gray canvas behind the content.
 */
const Shell = ({
  roleLabel,
  displayName,
  nav,
  active,
  onNavigate,
  onProfileClick,
  children,
}: {
  roleLabel: string;
  displayName?: string;
  nav: NavItem[];
  active: string;
  onNavigate: (key: string) => void;
  onProfileClick?: () => void;
  children: ReactNode;
}) => (
  <div className="min-h-screen bg-canvas md:flex">
    <Sidebar
      roleLabel={roleLabel}
      displayName={displayName}
      nav={nav}
      active={active}
      onNavigate={onNavigate}
      onProfileClick={onProfileClick}
      onSignOut={handleLogout}
    />
    <main className="mx-auto w-full min-w-0 max-w-7xl flex-1 px-4 py-6 md:px-8 md:py-8">
      {children}
    </main>
  </div>
);

export default Shell;
