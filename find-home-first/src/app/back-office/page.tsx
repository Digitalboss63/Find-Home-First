/**
 * /back-office — Overview
 *
 * Platform-owner only. requirePlatformOwner() enforced here.
 */
import type { Metadata } from "next";
import { requirePlatformOwner } from "@/lib/auth";
import { getPlatformSetting, listAuditLog } from "@/lib/repository";

export const metadata: Metadata = { title: "Back Office — Overview" };

export default async function BackOfficeOverviewPage() {
  await requirePlatformOwner();

  const [adaSetting, recentLog] = await Promise.all([
    getPlatformSetting("ada_widget"),
    listAuditLog(5),
  ]);

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 lg:px-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-primary)" }}>
          Back Office Overview
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--color-text)", opacity: 0.6 }}>
          Platform-level management. Visible to the platform owner only.
        </p>
      </div>

      {/* ── Quick status ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
        <div
          className="rounded-xl px-5 py-4"
          style={{
            backgroundColor: "#fff",
            border: "1px solid var(--color-border)",
          }}
        >
          <h2 className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--color-text)", opacity: 0.6 }}>
            ADA Widget
          </h2>
          <p className="text-sm font-semibold" style={{ color: "var(--color-primary)" }}>
            {adaSetting?.enabled ? "Enabled" : "Disabled"}
          </p>
          <a
            href="/back-office/integrations"
            className="text-xs mt-1 block"
            style={{ color: "var(--color-secondary)" }}
          >
            Manage →
          </a>
        </div>
      </div>

      {/* ── Recent audit events ───────────────────────────────── */}
      <section aria-labelledby="recent-audit-heading">
        <h2
          id="recent-audit-heading"
          className="text-sm font-semibold uppercase tracking-widest mb-4"
          style={{ color: "var(--color-text)", opacity: 0.75 }}
        >
          Recent Audit Events
        </h2>
        {!recentLog || recentLog.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--color-text)", opacity: 0.55 }}>
            No audit events yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {recentLog.map((entry) => (
              <li
                key={entry.id}
                className="rounded-lg px-4 py-3 text-xs"
                style={{
                  backgroundColor: "var(--color-surface-soft)",
                  border: "1px solid var(--color-border)",
                }}
              >
                <div className="flex justify-between gap-4">
                  <span
                    className="font-semibold"
                    style={{ color: "var(--color-primary)" }}
                  >
                    {entry.eventType}
                  </span>
                  <time
                    dateTime={entry.createdAt.toISOString()}
                    style={{ color: "var(--color-text)", opacity: 0.5 }}
                  >
                    {entry.createdAt.toLocaleString()}
                  </time>
                </div>
                {entry.detail && (
                  <p className="mt-0.5" style={{ color: "var(--color-text)", opacity: 0.65 }}>
                    {entry.detail}
                  </p>
                )}
                {entry.actorEmail && (
                  <p style={{ color: "var(--color-text)", opacity: 0.45 }}>
                    {entry.actorEmail}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
