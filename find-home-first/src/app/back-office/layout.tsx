/**
 * /back-office — Platform Owner Back Office layout.
 *
 * SECURITY: requirePlatformOwner() is called server-side in every page.
 * This layout provides the navigation shell only — it does NOT authorize.
 * Authorization must happen inside each page/route handler individually.
 *
 * Back Office is isolated from the operator workspace AppShell.
 * Staff and organization Owners never see this layout.
 */
import Link from "next/link";
import { isPlatformOwner } from "@/lib/auth";
import { redirect } from "next/navigation";

// ─── Navigation ───────────────────────────────────────────────────────────────

const NAV = [
  { href: "/back-office", label: "Overview" },
  { href: "/back-office/organizations", label: "Organizations" },
  { href: "/back-office/users", label: "Users" },
  { href: "/back-office/plans", label: "Plans" },
  { href: "/back-office/site-settings", label: "Site Settings" },
  { href: "/back-office/site-settings/integrations", label: "  Integrations", indent: true },
  { href: "/back-office/site-settings/integrations/ada-widget", label: "    ADA Widget", indent: true },
  { href: "/back-office/audit-log", label: "Audit Log" },
  { href: "/back-office/system-health", label: "System Health" },
];

export default async function BackOfficeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Gate the entire layout. If not platform owner, redirect immediately.
  // Individual pages also call requirePlatformOwner() for defence-in-depth.
  const ok = await isPlatformOwner();
  if (!ok) redirect("/access-denied");

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: "var(--color-background)" }}>
      {/* ── Sidebar ───────────────────────────────────────────── */}
      <aside
        className="hidden lg:flex flex-col w-52 shrink-0 fixed inset-y-0 left-0 z-20 overflow-y-auto"
        style={{ backgroundColor: "#1a1a2e", borderRight: "1px solid rgba(255,255,255,0.08)" }}
      >
        <div className="px-5 pt-6 pb-3 shrink-0">
          <Link href="/back-office" className="block">
            <span className="text-white font-bold text-sm tracking-tight">
              Back Office
            </span>
            <span
              className="block text-xs mt-0.5 font-medium tracking-widest uppercase"
              style={{ color: "rgba(255,255,255,0.3)" }}
            >
              Platform
            </span>
          </Link>
        </div>

        <nav aria-label="Back office navigation" className="flex-1 px-3 pb-6">
          <ul className="space-y-0.5 mt-2">
            {NAV.map(({ href, label, indent }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                  style={{
                    color: indent ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.65)",
                    fontSize: indent ? "0.78rem" : undefined,
                  }}
                >
                  {label.trim()}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div
          className="px-5 py-4 shrink-0 border-t text-xs"
          style={{ borderColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.3)" }}
        >
          <Link href="/" className="hover:opacity-70">
            ← Operator Workspace
          </Link>
        </div>
      </aside>

      {/* ── Content ───────────────────────────────────────────── */}
      <main
        className="flex-1 min-h-screen lg:ml-52 outline-none"
        tabIndex={-1}
        id="back-office-content"
      >
        {children}
      </main>
    </div>
  );
}
