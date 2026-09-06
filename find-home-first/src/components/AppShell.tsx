"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import UserMenu from "@/components/UserMenu";
import FhfGuide from "@/components/FhfGuide";

const LAST_PROJECT_STORAGE_KEY = "find-home-first:last-project-id";

// ─── Navigation items ─────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: HomeIcon },
  { href: "/projects", label: "Projects", icon: ProjectsIcon },
  { href: "/housing-search", label: "Find Properties", icon: SearchIcon },
  { href: "/people", label: "People & Contacts", icon: PeopleIcon },
  { href: "/tasks", label: "Tasks", icon: TasksIcon },
  { href: "/help", label: "Help Center", icon: HelpIcon },
  { href: "/plan", label: "Plan & Billing", icon: PlanIcon },
];

// ─── Inline SVG icons ─────────────────────────────────────────────────────────

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function ProjectsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-5-5" />
      <path d="M11 8v6M8 11h6" />
    </svg>
  );
}

function PeopleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}

function TasksIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
    </svg>
  );
}

function HelpIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M9.8 9a2.35 2.35 0 014.55.75c0 1.75-2.35 2-2.35 3.75" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function PlanIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  );
}

function BackOfficeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l8 4v5c0 5-3.4 8.3-8 9-4.6-.7-8-4-8-9V7l8-4z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" aria-hidden="true">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

// ─── NavLinks — defined outside AppShell to prevent creation during render ────

function NavLinks({
  isActive,
  onNavigate,
  showBackOffice,
  findPropertiesHref,
}: {
  isActive: (href: string) => boolean;
  onNavigate?: () => void;
  showBackOffice: boolean;
  findPropertiesHref: string;
}) {
  const items = showBackOffice
    ? [
        ...NAV_ITEMS,
        { href: "/back-office", label: "Back Office", icon: BackOfficeIcon },
      ]
    : NAV_ITEMS;

  return (
    <ul className="mt-3 space-y-0.5 px-2">
      {items.map(({ href, label, icon: Icon }) => {
        const active = isActive(href);
        const resolvedHref = href === "/housing-search" ? findPropertiesHref : href;
        return (
          <li key={href}>
            <Link
              href={resolvedHref}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={[
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150",
                active
                  ? "bg-white/[0.15] text-white"
                  : "text-white/60 hover:text-white hover:bg-white/10",
              ].join(" ")}
            >
              <Icon className="w-[18px] h-[18px] shrink-0" />
              <span>{label}</span>
              {active && <span className="sr-only">(current page)</span>}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

// ─── Logo — shows custom logo when set, falls back to FHF text wordmark ───────

function BrandLogo({
  logoSrc,
  className,
}: {
  logoSrc?: string | null;
  className?: string;
}) {
  if (logoSrc) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoSrc}
        alt="Find Home First"
        className={className ?? "h-8 w-auto max-w-[148px] object-contain object-left"}
        draggable={false}
      />
    );
  }
  return (
    <>
      <span className="text-white font-bold text-[17px] leading-tight tracking-tight group-hover:text-white/90 transition-colors">
        Find Home First
      </span>
    </>
  );
}

// ─── AppShell ─────────────────────────────────────────────────────────────────

export default function AppShell({
  children,
  showBackOffice = false,
  logoSrc,
}: {
  children: React.ReactNode;
  showBackOffice?: boolean;
  logoSrc?: string | null;
}) {
  const pathname = usePathname();
  const inBackOffice = pathname.startsWith("/back-office");
  const projectFromPath = pathname.match(/^\/projects\/([^/]+)/)?.[1] ?? null;
  const [lastProjectId, setLastProjectId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const hamburgerRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const activeProjectId = projectFromPath ?? lastProjectId;
  const findPropertiesHref = activeProjectId
    ? `/housing-search?project=${encodeURIComponent(activeProjectId)}`
    : "/housing-search";

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const openDrawer = () => {
    setDrawerOpen(true);
    setTimeout(() => closeButtonRef.current?.focus(), 60);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setTimeout(() => hamburgerRef.current?.focus(), 60);
  };

  // Remember the current project so normal sidebar navigation back to
  // Find Properties reopens that project's saved search instead of a generic
  // project-less route. The saved city/state/ZIP still belong to the draft and
  // only change when the user edits them or explicitly selects a ranked ZIP.
  useEffect(() => {
    let projectId = projectFromPath;

    if (pathname.startsWith("/housing-search")) {
      const queryProject = new URLSearchParams(window.location.search).get("project");
      if (queryProject) projectId = queryProject;
    }

    if (projectId) {
      window.sessionStorage.setItem(LAST_PROJECT_STORAGE_KEY, projectId);
      setLastProjectId(projectId);
      return;
    }

    const storedProjectId = window.sessionStorage.getItem(LAST_PROJECT_STORAGE_KEY);
    if (storedProjectId) setLastProjectId(storedProjectId);
  }, [pathname, projectFromPath]);

  // Escape key closes drawer
  useEffect(() => {
    if (!drawerOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDrawer();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [drawerOpen]);

  // Prevent body scroll while drawer is open
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  // Back Office owns its platform-owner shell. Avoid nesting the operator
  // sidebar and footer around it while preserving the shared root providers.
  if (inBackOffice) return <>{children}</>;

  return (
    <div className="flex min-h-screen">
      {/* ══ Desktop sidebar ══════════════════════════════════════════ */}
      <aside
        className="hidden lg:flex flex-col w-56 xl:w-60 shrink-0 fixed inset-y-0 left-0 z-20 overflow-y-auto"
        style={{ backgroundColor: "var(--color-primary)" }}
      >
        {/* Banner landmark */}
        <header role="banner" className="px-5 pt-6 pb-2 shrink-0">
          <Link
            href="/"
            aria-label="Find Home First — go to home workspace"
            className="block group"
          >
            <BrandLogo logoSrc={logoSrc} className="h-8 w-auto max-w-[148px] object-contain object-left" />
          </Link>
          {!logoSrc && (
            <p
              className="text-[11px] mt-1 font-medium tracking-widest uppercase"
              style={{ color: "rgba(255,255,255,0.35)" }}
            >
              Housing Workspace
            </p>
          )}
        </header>

        <nav aria-label="Primary navigation" className="flex-1">
          <NavLinks
            isActive={isActive}
            showBackOffice={showBackOffice}
            findPropertiesHref={findPropertiesHref}
          />
        </nav>

        {/* Sidebar bottom */}
        <div
          className="px-5 py-4 shrink-0 border-t"
          style={{ borderColor: "rgba(255,255,255,0.1)" }}
        >
          <UserMenu />
        </div>
      </aside>

      {/* ══ Main column ══════════════════════════════════════════════ */}
      <div className="flex flex-col flex-1 min-h-screen lg:ml-56 xl:ml-60">
        {/* Mobile top bar */}
        <div
          className="lg:hidden flex items-center justify-between px-4 py-3 border-b shrink-0 sticky top-0 z-10"
          style={{
            backgroundColor: "var(--color-primary)",
            borderColor: "rgba(255,255,255,0.15)",
          }}
        >
          <Link
            href="/"
            aria-label="Find Home First — go to home workspace"
          >
            <BrandLogo logoSrc={logoSrc} className="h-7 w-auto max-w-[130px] object-contain" />
          </Link>
          <button
            ref={hamburgerRef}
            onClick={openDrawer}
            className="p-2 rounded-lg text-white/70 hover:text-white transition-colors"
            aria-label="Open navigation menu"
            aria-expanded={drawerOpen}
            aria-controls="mobile-nav-drawer"
          >
            <MenuIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Page content */}
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 outline-none"
          style={{ backgroundColor: "var(--color-background)" }}
        >
          {children}
        </main>

        {/* Footer */}
        <footer
          role="contentinfo"
          className="px-6 py-4 border-t text-xs shrink-0"
          style={{
            borderColor: "var(--color-border)",
            color: "var(--color-text)",
            opacity: 0.5,
          }}
        >
          © {new Date().getFullYear()} Find Home First. Demonstration environment — all data is fictional.
        </footer>
      </div>

      <FhfGuide />

      {/* ══ Mobile overlay ═══════════════════════════════════════════ */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
          aria-hidden="true"
          onClick={closeDrawer}
        />
      )}

      {/* ══ Mobile drawer ════════════════════════════════════════════ */}
      <aside
        id="mobile-nav-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className={[
          "fixed inset-y-0 left-0 z-50 w-64 flex flex-col lg:hidden",
          "transition-transform duration-200 ease-out",
          drawerOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
        style={{ backgroundColor: "var(--color-primary)" }}
        aria-hidden={!drawerOpen}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-2 shrink-0">
          <BrandLogo logoSrc={logoSrc} className="h-7 w-auto max-w-[130px] object-contain" />
          <button
            ref={closeButtonRef}
            onClick={closeDrawer}
            className="p-2 rounded-lg text-white/70 hover:text-white transition-colors"
            aria-label="Close navigation menu"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>
        <nav
          aria-label="Mobile primary navigation"
          className="flex-1 overflow-y-auto"
        >
          <NavLinks
            isActive={isActive}
            onNavigate={closeDrawer}
            showBackOffice={showBackOffice}
            findPropertiesHref={findPropertiesHref}
          />
        </nav>
        <div
          className="px-5 py-4 shrink-0 border-t"
          style={{ borderColor: "rgba(255,255,255,0.1)" }}
        >
          <UserMenu />
        </div>
      </aside>
    </div>
  );
}
