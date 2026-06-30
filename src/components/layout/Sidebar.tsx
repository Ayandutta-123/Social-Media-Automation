"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  CalendarDays,
  Users,
  Factory,
  Clock,
  Wifi,
  ChevronLeft,
  ChevronRight,
  LogOut,
  ImageUp,
  Sun,
  Moon,
} from "lucide-react";
import { useSidebar } from "./SidebarContext";
import { useTheme } from "@/components/theme/ThemeProvider";
import { logout } from "@/app/actions/auth";

const primaryNavItems = [
  { label: "Content calendar", href: "/dashboard", icon: CalendarDays },
  { label: "Competitors", href: "/dashboard/competitors", icon: Users },
  { label: "Industries", href: "/dashboard/industries", icon: Factory },
  { label: "Upload image", href: "/dashboard/upload-image", icon: ImageUp },
];

const secondaryNavItems = [
  { label: "Schedule", href: "/dashboard/settings", icon: Clock },
];

/** Read the 'username' cookie set at login */
function getUsername(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/(?:^|;\s*)username=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : "";
}

export default function Sidebar() {
  const pathname = usePathname();
  const { collapsed, toggle, mobileOpen, closeMobile, isMobile } = useSidebar();
  const { theme, toggleTheme } = useTheme();
  const [username, setUsername] = useState("");

  useEffect(() => {
    setUsername(getUsername());
  }, []);

  const renderNavItem = (item: { label: string; href: string; icon: React.ComponentType<{ className?: string }> }) => {
    const Icon = item.icon;
    const isActive =
      pathname === item.href ||
      (item.href !== "/dashboard" && pathname.startsWith(item.href));

    return (
      <Link
        key={item.href}
        href={item.href}
        title={collapsed && !isMobile ? item.label : undefined}
        onClick={() => {
          if (isMobile) closeMobile();
        }}
        className={`
          group relative flex items-center rounded-xl text-[14px] font-medium transition-all duration-200
          ${collapsed && !isMobile ? "justify-center px-0 py-3 mx-1" : "gap-3 px-4 py-3"}
          ${isActive
            ? "bg-[var(--color-sidebar-active-bg)] text-[var(--color-sidebar-active-text)]"
            : "text-[var(--color-sidebar-text)] hover:bg-[var(--color-sidebar-hover)] hover:text-[var(--color-sidebar-text-active)]"
          }
        `}
      >
        <Icon
          className={`flex-shrink-0 h-5 w-5 transition-colors duration-200 ${isActive
            ? "text-[var(--color-sidebar-active-icon)]"
            : "text-[var(--color-sidebar-text)] group-hover:text-[var(--color-sidebar-active-icon)]"
            }`}
        />
        {!collapsed || isMobile ? (
          <span className="flex-1 truncate">{item.label}</span>
        ) : null}
      </Link>
    );
  };

  return (
    <aside
      className={`fixed left-0 top-0 bottom-0 z-50 flex flex-col bg-[var(--color-sidebar-bg)] border-r border-[var(--color-sidebar-border)] transition-all duration-300 ease-in-out w-[250px]
        ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
        md:translate-x-0
        ${collapsed ? "md:w-[68px]" : "md:w-[250px]"}
      `}
    >
      {/* Brand — logo sized to match the nav items */}
      <div
        className={`flex items-center transition-all duration-300 ${collapsed && !isMobile ? "px-3 py-4 justify-center" : "px-4 py-4"
          }`}
      >
        {collapsed && !isMobile ? (
          <div className="relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-rose-950/60 to-slate-900/80 shadow-sm">
            <Wifi className="h-4.5 w-4.5 text-rose-400" strokeWidth={2.25} />
            <span className="absolute bottom-1.5 h-1.5 w-1.5 rounded-full bg-rose-500" />
          </div>
        ) : (
          <Image
            src="/logo.png"
            alt="HyperThings Logo"
            width={250}
            height={60}
            className="object-contain w-full h-auto"
            priority
          />
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 pt-6 pb-2">
        {/* Section Label - Menu */}
        {!collapsed || isMobile ? (
          <p className="px-4 mb-3 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-sidebar-section-label)]">
            Menu
          </p>
        ) : null}

        {/* Primary Nav */}
        <div className="space-y-0.5">
          {primaryNavItems.map(renderNavItem)}
        </div>

        {/* Secondary Nav */}
        <div className="mt-2 space-y-0.5">
          {secondaryNavItems.map(renderNavItem)}
        </div>
      </nav>

      {/* Footer Section */}
      <div className="mt-auto">
        {/* Theme Toggle */}
        {!collapsed || isMobile ? (
          <div className="px-4 pt-4 pb-2">
            <div className="flex items-center rounded-xl bg-[var(--color-sidebar-toggle-bg)] p-1">
              <button
                onClick={() => theme === "dark" && toggleTheme()}
                className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-[12px] font-medium transition-all duration-200 ${theme === "light"
                  ? "bg-[var(--color-sidebar-toggle-active)] text-[var(--color-sidebar-toggle-active-text)] shadow-sm"
                  : "text-[var(--color-sidebar-toggle-text)] hover:text-[var(--color-sidebar-text-active)]"
                  }`}
              >
                <Sun className="h-3.5 w-3.5" />
                <span>Light</span>
              </button>
              <button
                onClick={() => theme === "light" && toggleTheme()}
                className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-[12px] font-medium transition-all duration-200 ${theme === "dark"
                  ? "bg-[var(--color-sidebar-toggle-active)] text-[var(--color-sidebar-toggle-active-text)] shadow-sm"
                  : "text-[var(--color-sidebar-toggle-text)] hover:text-[var(--color-sidebar-text-active)]"
                  }`}
              >
                <Moon className="h-3.5 w-3.5" />
                <span>Dark</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex justify-center py-3">
            <button
              onClick={toggleTheme}
              title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--color-sidebar-text)] hover:bg-[var(--color-sidebar-hover)] hover:text-[var(--color-sidebar-text-active)] transition-all duration-200"
            >
              {theme === "light" ? (
                <Moon className="h-4.5 w-4.5" />
              ) : (
                <Sun className="h-4.5 w-4.5" />
              )}
            </button>
          </div>
        )}

        {/* User Profile */}
        <div className={`border-t border-[var(--color-sidebar-border)] ${collapsed && !isMobile ? "px-2 py-3" : "px-4 py-3"}`}>
          <div className={`flex items-center ${collapsed && !isMobile ? "justify-center" : "gap-3"}`}>
            {/* Avatar */}
            <div className="flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-[12px] font-bold text-white shadow-md shadow-violet-500/20">
              {username ? username.charAt(0).toUpperCase() : "H"}
            </div>

            {!collapsed || isMobile ? (
              <>
                {/* User Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-[var(--color-sidebar-text-active)] truncate leading-tight">
                    HyperThings
                  </p>
                  <p className="text-[11px] text-[var(--color-sidebar-text)] truncate leading-tight mt-0.5">
                    {username || "admin"}
                  </p>
                </div>

                {/* Logout Button */}
                <button
                  onClick={async () => {
                    await logout();
                    window.location.href = "/login";
                  }}
                  title="Log out"
                  className="flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-sidebar-text)] hover:bg-[var(--color-sidebar-hover)] hover:text-red-400 transition-all duration-200"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            ) : null}
          </div>
        </div>

        {/* Collapse Toggle */}
        <button
          onClick={toggle}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={`hidden md:flex w-full items-center justify-center gap-2 border-t border-[var(--color-sidebar-border)] py-2.5 text-[var(--color-sidebar-text)] hover:text-[var(--color-sidebar-text-active)] hover:bg-[var(--color-sidebar-hover)] transition-all duration-200 text-[12px] font-medium`}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
