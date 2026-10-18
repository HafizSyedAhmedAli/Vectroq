"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronDown,
  ExternalLink,
  FileText,
  FolderOpen,
  Home,
  Inbox,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Users,
  Tag,
  UserCog,
  X,
  type LucideIcon,
} from "lucide-react";
import type { Brand } from "@/lib/brand";
import { ROLE_LABEL, hasRole, type Role } from "@/lib/auth/roles";
import { BrandLogo } from "./BrandLogo";
import { VerifyEmailBanner } from "./VerifyEmailBanner";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  owner?: boolean;
}

const NAV: NavItem[] = [
  { href: "/office/dashboard", label: "Dashboard", icon: Home },
  { href: "/office", label: "Projects", icon: FolderOpen, exact: true },
  { href: "/office/leads", label: "Leads", icon: Inbox },
  { href: "/office/team", label: "Team", icon: Users, owner: true },
  { href: "/office/rates", label: "Rates", icon: Tag },
  { href: "/office/settings", label: "Settings", icon: Settings, owner: true },
  { href: "/office/account", label: "Account", icon: UserCog },
];

// Static pages under /office. Anything else under /office/ is a project page.
const STATIC_PAGES = [
  "/office/dashboard",
  "/office/leads",
  "/office/rates",
  "/office/team",
  "/office/settings",
  "/office/account",
];

const COLLAPSE_KEY = "vq_sidebar_collapsed";

function isActive(item: NavItem, pathname: string) {
  if (item.exact) {
    return (
      pathname === "/office" ||
      (pathname.startsWith("/office/") &&
        !STATIC_PAGES.some((p) => pathname.startsWith(p)))
    );
  }
  return pathname.startsWith(item.href);
}

export function OfficeShell({
  brand,
  orgSlug,
  role,
  userName,
  userEmail,
  emailVerified,
  children,
}: {
  brand: Brand;
  orgSlug: string;
  role: Role;
  userName: string;
  userEmail: string;
  emailVerified: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawer, setDrawer] = useState(false); // mobile slide-out
  const [menu, setMenu] = useState(false);
  const [collapsed, setCollapsed] = useState(false); // desktop icon rail

  // Restore the saved choice after mount (storage can be unavailable).
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  // close the drawer and the user menu whenever the page changes
  useEffect(() => {
    setDrawer(false);
    setMenu(false);
  }, [pathname]);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest("[data-user-menu]"))
        setMenu(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menu]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const links = NAV.filter((l) => !l.owner || hasRole(role, "OWNER"));
  const initial = userName.trim().charAt(0).toUpperCase() || "?";
  const brandInitial = brand.name.trim().charAt(0).toUpperCase() || "?";

  // Collapsed styles only apply from lg up; the mobile drawer is always full.
  const hideWhenCollapsed = collapsed ? "lg:hidden" : "";
  const centerWhenCollapsed = collapsed ? "lg:justify-center lg:px-0" : "";

  return (
    <div className="min-h-screen bg-stone-50 print:bg-white">
      {drawer && (
        <div
          aria-hidden
          onClick={() => setDrawer(false)}
          className="fixed inset-0 z-40 bg-black/40 lg:hidden print:hidden"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-stone-200/70 bg-white transition-all duration-200 lg:translate-x-0 print:hidden ${
          collapsed ? "lg:w-[76px]" : "lg:w-64"
        } ${drawer ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div
          className={`flex h-[72px] items-center justify-between px-5 ${
            collapsed ? "lg:justify-center lg:px-0" : ""
          }`}
        >
          <Link href="/office/dashboard" className="flex items-center">
            <span className={hideWhenCollapsed}>
              <BrandLogo brand={brand} className="h-9 w-auto" />
            </span>
            {collapsed && (
              <span
                aria-label={brand.name}
                className="hidden size-10 place-items-center rounded-xl bg-brand text-lg font-extrabold text-white lg:grid"
              >
                {brandInitial}
              </span>
            )}
          </Link>

          {/* mobile: close the drawer */}
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setDrawer(false)}
            className="grid size-9 cursor-pointer place-items-center rounded-lg text-stone-500 hover:bg-stone-100 lg:hidden"
          >
            <X className="size-5" />
          </button>

          {/* desktop: collapse, shown next to the logo while expanded */}
          {!collapsed && (
            <button
              type="button"
              aria-label="Collapse sidebar"
              aria-expanded
              title="Collapse sidebar"
              onClick={toggleCollapsed}
              className="hidden size-9 cursor-pointer place-items-center rounded-lg text-stone-500 hover:bg-stone-100 lg:grid"
            >
              <PanelLeftClose className="size-5" />
            </button>
          )}
        </div>

        <nav className="mt-2 flex-1 space-y-1 px-3" aria-label="Main">
          {links.map((l) => {
            const active = isActive(l, pathname);
            const Icon = l.icon;
            return (
              <Link
                key={l.href}
                href={l.href}
                title={collapsed ? l.label : undefined}
                aria-label={l.label}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${centerWhenCollapsed} ${
                  active
                    ? "bg-brand/10 text-brand"
                    : "text-stone-600 hover:bg-stone-100 hover:text-brand-black"
                }`}
              >
                <Icon className="size-5 shrink-0" />
                <span className={`truncate ${hideWhenCollapsed}`}>
                  {l.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-stone-100 p-3">
          <Link
            href={`/c/${orgSlug}`}
            target="_blank"
            title={collapsed ? "Client Form" : undefined}
            aria-label="Client Form"
            className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-stone-600 transition hover:bg-stone-100 hover:text-brand-black ${centerWhenCollapsed}`}
          >
            <FileText className="size-5 shrink-0" />
            <span className={`flex-1 truncate ${hideWhenCollapsed}`}>
              Client Form
            </span>
            <ExternalLink
              className={`size-4 text-stone-400 ${hideWhenCollapsed}`}
            />
          </Link>
        </div>
      </aside>

      {/* Content column */}
      <div
        className={`transition-[padding] duration-200 print:pl-0 ${
          collapsed ? "lg:pl-[76px]" : "lg:pl-64"
        }`}
      >
        {/* 72px tall on purpose: pages use min-h-[calc(100vh-72px)] */}
        <header className="sticky top-0 z-30 flex h-[72px] items-center gap-3 border-b border-stone-200/70 bg-white/90 px-4 backdrop-blur sm:px-6 print:hidden">
          {/* mobile: open the drawer */}
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setDrawer(true)}
            className="grid size-10 cursor-pointer place-items-center rounded-lg text-stone-600 hover:bg-stone-100 lg:hidden"
          >
            <Menu className="size-5" />
          </button>

          {/* desktop: expand, shown only while the sidebar is collapsed */}
          {collapsed && (
            <button
              type="button"
              aria-label="Expand sidebar"
              aria-expanded={false}
              title="Expand sidebar"
              onClick={toggleCollapsed}
              className="hidden size-10 cursor-pointer place-items-center rounded-lg text-stone-600 hover:bg-stone-100 lg:grid"
            >
              <PanelLeftOpen className="size-5" />
            </button>
          )}

          <Link href="/office/dashboard" className="lg:hidden">
            <BrandLogo brand={brand} className="h-8 w-auto" />
          </Link>

          <div className="relative ml-auto" data-user-menu>
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={menu}
              onClick={() => setMenu((m) => !m)}
              className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-stone-100"
            >
              <span className="grid size-10 place-items-center rounded-full bg-brand/10 text-sm font-bold text-brand">
                {initial}
              </span>
              <span className="hidden text-left leading-tight sm:block">
                <span className="block text-sm font-semibold text-brand-black">
                  {userName}
                </span>
                <span className="block text-xs text-stone-500">
                  {ROLE_LABEL[role]}
                </span>
              </span>
              <ChevronDown className="size-4 text-stone-500" />
            </button>

            {menu && (
              <div
                role="menu"
                className="absolute right-0 top-14 z-40 w-60 overflow-hidden rounded-xl border border-stone-200 bg-white py-1 shadow-xl"
              >
                <div className="border-b border-stone-100 px-4 py-3">
                  <p className="truncate text-sm font-semibold text-brand-black">
                    {userName}
                  </p>
                  <p className="truncate text-xs text-stone-500">{userEmail}</p>
                </div>
                <Link
                  href="/office/account"
                  role="menuitem"
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-stone-700 hover:bg-stone-50"
                >
                  <UserCog className="size-4" /> Account and password
                </Link>
                {hasRole(role, "OWNER") && (
                  <Link
                    href="/office/settings"
                    role="menuitem"
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-stone-700 hover:bg-stone-50"
                  >
                    <Settings className="size-4" /> Company settings
                  </Link>
                )}
                <button
                  type="button"
                  role="menuitem"
                  onClick={logout}
                  className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left text-sm text-red-600 hover:bg-stone-50"
                >
                  <LogOut className="size-4" /> Log out
                </button>
              </div>
            )}
          </div>
        </header>

        {!emailVerified && <VerifyEmailBanner email={userEmail} />}

        {children}
      </div>
    </div>
  );
}
