import type { Metadata } from "next";
import { requirePlatformOwner } from "@/lib/auth";
import { isRentCastConfigured } from "@/lib/rentcast";
import RentCastHealthCard from "./RentCastHealthCard";

export const metadata: Metadata = { title: "Back Office — System Health" };

export default async function BackOfficeSystemHealthPage() {
  await requirePlatformOwner();

  // Configured status only — never show any portion of the key
  const rentCastConfigured = isRentCastConfigured();

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 lg:px-10">
      <h1
        className="text-2xl font-bold mb-2"
        style={{ color: "var(--color-primary)" }}
      >
        System Health
      </h1>
      <p
        className="text-sm mb-8"
        style={{ color: "var(--color-text)", opacity: 0.6 }}
      >
        Platform integration health checks and diagnostics.
      </p>

      {/* ── RentCast ───────────────────────────────────────────────────── */}
      <section aria-labelledby="rentcast-health-heading" className="mb-8">
        <h2
          id="rentcast-health-heading"
          className="text-sm font-semibold uppercase tracking-widest mb-3"
          style={{ color: "var(--color-text)", opacity: 0.75 }}
        >
          RentCast Integration
        </h2>

        {/* Configured status — no key content ever shown */}
        <div
          className="flex items-center gap-2 mb-4 text-sm"
          style={{ color: "var(--color-text)" }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              backgroundColor: rentCastConfigured ? "#22C55E" : "#9CA3AF",
              display: "inline-block",
              flexShrink: 0,
            }}
          />
          <span>
            RENTCAST_API_KEY:{" "}
            <strong>{rentCastConfigured ? "configured" : "not configured"}</strong>
          </span>
        </div>

        {rentCastConfigured ? (
          <RentCastHealthCard />
        ) : (
          <div
            className="rounded-xl px-5 py-4 text-sm"
            style={{
              backgroundColor: "var(--color-surface-soft)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
            }}
          >
            Set the <code>RENTCAST_API_KEY</code> environment variable to enable
            the RentCast integration.
          </div>
        )}
      </section>
    </div>
  );
}
