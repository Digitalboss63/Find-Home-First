/**
 * /back-office/audit-log — Platform audit event log.
 * Platform-owner only.
 */
import type { Metadata } from "next";
import { requirePlatformOwner } from "@/lib/auth";
import { listAuditLog } from "@/lib/repository";

export const metadata: Metadata = { title: "Back Office — Audit Log" };

export default async function AuditLogPage() {
  await requirePlatformOwner();
  const entries = await listAuditLog(200);

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 lg:px-10">
      <div className="mb-8">
        <h1
          className="text-2xl font-bold"
          style={{ color: "var(--color-primary)" }}
        >
          Audit Log
        </h1>
        <p
          className="mt-1 text-sm"
          style={{ color: "var(--color-text)", opacity: 0.6 }}
        >
          Platform-level events in reverse chronological order.
        </p>
      </div>

      {!entries || entries.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--color-text)", opacity: 0.55 }}>
          No audit events recorded yet.
        </p>
      ) : (
        <ul className="space-y-2" aria-label="Audit log entries">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="rounded-lg px-4 py-3 text-xs"
              style={{
                backgroundColor: "#fff",
                border: "1px solid var(--color-border)",
              }}
            >
              <div className="flex flex-wrap justify-between gap-2 mb-0.5">
                <span
                  className="font-semibold"
                  style={{ color: "var(--color-primary)" }}
                >
                  {entry.eventType}
                </span>
                <time
                  dateTime={entry.createdAt.toISOString()}
                  style={{ color: "var(--color-text)", opacity: 0.45 }}
                >
                  {entry.createdAt.toLocaleString()}
                </time>
              </div>
              {entry.detail && (
                <p style={{ color: "var(--color-text)", opacity: 0.7 }}>
                  {entry.detail}
                </p>
              )}
              {entry.actorEmail && (
                <p style={{ color: "var(--color-text)", opacity: 0.45 }}>
                  Actor: {entry.actorEmail}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
