import { ReactNode, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, LogOut, Menu, X } from "lucide-react";
import { Logo } from "../ui";

export interface SidebarNavItem {
  key: string;
  label: string;
  icon: ReactNode;
  badge?: string;
}

interface SidebarProps {
  roleLabel: string;
  displayName?: string;
  nav: SidebarNavItem[];
  active: string;
  onNavigate: (key: string) => void;
  onProfileClick?: () => void;
  onSignOut: () => void;
  className?: string;
}

/**
 * App sidebar (adapted from the "modern-side-bar" template): drawer + hamburger
 * top bar on mobile, static collapsible rail on desktop. Navigation, profile
 * and sign-out all live here so the content area stays uncluttered.
 */
export function Sidebar({
  roleLabel,
  displayName,
  nav,
  active,
  onNavigate,
  onProfileClick,
  onSignOut,
  className = "",
}: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Auto-open sidebar on desktop, keep it a closed drawer on mobile.
  useEffect(() => {
    const handleResize = () => setIsOpen(window.innerWidth >= 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const closeOnMobile = () => {
    if (window.innerWidth < 768) setIsOpen(false);
  };

  const handleItemClick = (key: string) => {
    onNavigate(key);
    closeOnMobile();
  };

  const initials =
    (displayName || roleLabel)
      .split(/\s+/)
      .map((word) => word[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";

  return (
    <>
      {/* Mobile top bar with hamburger */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-white px-4 md:hidden">
        <div className="flex items-center gap-2.5">
          <Logo className="text-xl" />
          <span className="chip bg-brand-tint text-brand-darker">{roleLabel}</span>
        </div>
        <button
          onClick={() => setIsOpen(true)}
          className="rounded-md p-2 text-ink-muted transition-colors hover:bg-canvas"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-line bg-white
          transition-all duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          ${isCollapsed ? "md:w-20" : "md:w-72"}
          md:sticky md:top-0 md:h-screen md:translate-x-0
          ${className}
        `}
      >
        {/* Header: logo + role, collapse (desktop) / close (mobile) */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-line px-4">
          {isCollapsed ? (
            <span className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-base font-bold text-white">
              g
            </span>
          ) : (
            <div className="flex min-w-0 items-center gap-2.5">
              <Logo className="text-xl" />
              <span className="chip bg-brand-tint text-brand-darker">{roleLabel}</span>
            </div>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden shrink-0 rounded-md p-1.5 text-ink-faint transition-colors hover:bg-canvas hover:text-ink-muted md:flex"
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="shrink-0 rounded-md p-1.5 text-ink-muted transition-colors hover:bg-canvas md:hidden"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-3">
          <ul className="space-y-0.5">
            {nav.map((item) => {
              const isActive = active === item.key;
              return (
                <li key={item.key}>
                  <button
                    onClick={() => handleItemClick(item.key)}
                    title={isCollapsed ? item.label : undefined}
                    className={`
                      group relative flex w-full items-center rounded-md text-left text-sm font-semibold transition-colors
                      ${isActive ? "bg-brand-tint text-brand-darker" : "text-ink-muted hover:bg-canvas hover:text-ink-heading"}
                      ${isCollapsed ? "justify-center px-2 py-2.5" : "gap-2.5 px-3 py-2.5"}
                    `}
                  >
                    <span className="flex min-w-[24px] items-center justify-center">{item.icon}</span>

                    {!isCollapsed && (
                      <span className="flex w-full min-w-0 items-center justify-between">
                        <span className="truncate">{item.label}</span>
                        {item.badge && (
                          <span
                            className={`ml-2 rounded-full px-1.5 py-0.5 text-xs font-medium ${
                              isActive ? "bg-white text-brand-darker" : "bg-canvas text-ink-muted"
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </span>
                    )}

                    {/* Tooltip for collapsed state */}
                    {isCollapsed && (
                      <span className="invisible absolute left-full z-50 ml-2 whitespace-nowrap rounded bg-ink-heading px-2 py-1 text-xs text-white opacity-0 transition-all duration-200 group-hover:visible group-hover:opacity-100">
                        {item.label}
                        {item.badge && (
                          <span className="ml-1.5 rounded-full bg-ink px-1 py-0.5 text-[10px]">{item.badge}</span>
                        )}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Bottom section: profile + sign out */}
        <div className="mt-auto shrink-0 border-t border-line">
          {onProfileClick && (
            <div className="border-b border-line p-3">
              <button
                onClick={() => {
                  onProfileClick();
                  closeOnMobile();
                }}
                title={isCollapsed ? displayName || "Profile" : undefined}
                className={`group relative flex w-full items-center rounded-md transition-colors hover:bg-canvas ${
                  isCollapsed ? "justify-center p-2" : "px-3 py-2"
                }`}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-tint text-sm font-semibold text-brand-darker">
                  {initials}
                </span>
                {!isCollapsed && (
                  <span className="ml-2.5 min-w-0 flex-1 text-left">
                    <span className="block truncate text-sm font-semibold text-ink-heading">
                      {displayName || "Profile"}
                    </span>
                    <span className="block truncate text-xs text-ink-faint">{roleLabel}</span>
                  </span>
                )}
                {isCollapsed && (
                  <span className="invisible absolute left-full z-50 ml-2 whitespace-nowrap rounded bg-ink-heading px-2 py-1 text-xs text-white opacity-0 transition-all duration-200 group-hover:visible group-hover:opacity-100">
                    {displayName || "Profile"}
                  </span>
                )}
              </button>
            </div>
          )}

          <div className="p-3">
            <button
              onClick={onSignOut}
              title={isCollapsed ? "Sign out" : undefined}
              className={`
                group relative flex w-full items-center rounded-md text-left text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 hover:text-red-700
                ${isCollapsed ? "justify-center p-2.5" : "gap-2.5 px-3 py-2.5"}
              `}
            >
              <span className="flex min-w-[24px] items-center justify-center">
                <LogOut className="h-4 w-4" />
              </span>
              {!isCollapsed && <span>Sign out</span>}
              {isCollapsed && (
                <span className="invisible absolute left-full z-50 ml-2 whitespace-nowrap rounded bg-ink-heading px-2 py-1 text-xs text-white opacity-0 transition-all duration-200 group-hover:visible group-hover:opacity-100">
                  Sign out
                </span>
              )}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
