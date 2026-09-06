/**
 * /back-office — Find Home First administrative workspace.
 *
 * Platform-owner pages continue to enforce requirePlatformOwner() individually.
 * Billing Support is also available to explicitly authorized billing-support staff.
 * Organization owner/staff roles do not grant Back Office access.
 */
import Link from "next/link";
import { requireBillingSupport } from "@/lib/support-auth";

interface BackOfficeNavItem {
  href: string;
  label: string;
  indent?: boolean;
}

const OWNER_NAV: BackOfficeNavItem[] = [
  { href: "/back-office", label: "Overview" },
  { href: "/back-office/organizations", label: "Organizations" },
  { href: "/back-office/users", label: "Users" },
  { href: "/back-office/plans", label: "Plans" },
  { href: "/back-office/billing", label: "Billing Support" },
  { href: "/back-office/site-settings", label: "Site Settings" },
  { href: "/back-office/site-settings/training-videos", label: "  Training Videos", indent: true },
  { href: "/back-office/site-settings/integrations", label: "  Integrations", indent: true },
  { href: "/back-office/site-settings/integrations/ada-widget", label: "    ADA Widget", indent: true },
  { href: "/back-office/audit-log", label: "Audit Log" },
  { href: "/back-office/system-health", label: "System Health" },
];

const SUPPORT_NAV: BackOfficeNavItem[] = [
  { href: "/back-office/billing", label: "Billing Support" },
];

export default async function BackOfficeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const actor = await requireBillingSupport();
  const nav = actor.isPlatformOwner ? OWNER_NAV : SUPPORT_NAV;
  const backOfficeHome = actor.isPlatformOwner
    ? "/back-office"
    : "/back-office/billing";

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: "var(--color-background)" }}>
      <aside
        className="hidden lg:flex flex-col w-52 shrink-0 fixed inset-y-0 left-0 z-20 overflow-y-auto"
        style={{ backgroundColor: "#1a1a2e", borderRight: "1px solid rgba(255,255,255,0.08)" }}
      >
        <div className="px-5 pt-6 pb-3 shrink-0">
          <Link href={backOfficeHome} className="block">
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

          <Link
            href="/"
            className="mt-4 flex items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold transition-colors"
            style={{ color: "#fff", backgroundColor: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.14)" }}
          >
            ← Return to App
          </Link>
        </div>

        <nav aria-label="Back office navigation" className="flex-1 px-3 pb-6">
          <ul className="space-y-0.5 mt-2">
            {nav.map(({ href, label, indent }) => (
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
            ← Return to App
          </Link>
        </div>
      </aside>

      <header
        className="lg:hidden fixed inset-x-0 top-0 z-20 px-4 py-3"
        style={{ backgroundColor: "#1a1a2e", borderBottom: "1px solid rgba(255,255,255,0.08)" }}
      >
        <div className="flex items-center justify-between gap-3 mb-2">
          <Link href={backOfficeHome} className="font-bold text-sm text-white">
            Back Office
          </Link>
          <Link
            href="/"
            className="rounded-md px-3 py-1.5 text-xs font-semibold"
            style={{ color: "#fff", backgroundColor: "rgba(255,255,255,0.12)" }}
          >
            ← Return to App
          </Link>
        </div>
        <nav aria-label="Mobile back office navigation" className="overflow-x-auto">
          <ul className="flex gap-2 min-w-max pb-1">
            {nav.filter((item) => !item.indent).map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="block rounded-md px-3 py-1.5 text-xs font-medium"
                  style={{ color: "rgba(255,255,255,0.78)", backgroundColor: "rgba(255,255,255,0.08)" }}
                >
                  {label}
                </Link>
              </li>
            ))}
            {actor.isPlatformOwner && (
              <>
                <li>
                  <Link
                    href="/back-office/site-settings/training-videos"
                    className="block rounded-md px-3 py-1.5 text-xs font-medium"
                    style={{ color: "#fff", backgroundColor: "#0F766E" }}
                  >
                    Training Videos
                  </Link>
                </li>
                <li>
                  <Link
                    href="/back-office/site-settings/integrations/ada-widget"
                    className="block rounded-md px-3 py-1.5 text-xs font-medium"
                    style={{ color: "#fff", backgroundColor: "#8B5CF6" }}
                  >
                    ADA Widget
                  </Link>
                </li>
              </>
            )}
          </ul>
        </nav>
      </header>

      <main
        className="flex-1 min-h-screen pt-24 lg:pt-0 lg:ml-52 outline-none"
        tabIndex={-1}
        id="back-office-content"
      >
        {children}
      </main>
    </div>
  );
}
