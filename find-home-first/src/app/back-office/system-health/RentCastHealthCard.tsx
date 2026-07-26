"use client";

import { useState, useTransition } from "react";
import { testRentCastAction } from "./actions";
import type { RentCastTestResult } from "./actions";

export default function RentCastHealthCard() {
  const [result, setResult] = useState<RentCastTestResult | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleTest() {
    startTransition(async () => {
      const r = await testRentCastAction();
      setResult(r);
    });
  }

  return (
    <div
      className="rounded-xl p-5"
      style={{
        backgroundColor: "#fff",
        border: "1px solid var(--color-border)",
      }}
    >
      <h2
        className="text-base font-semibold mb-3"
        style={{ color: "var(--color-primary)" }}
      >
        RentCast API
      </h2>

      <button
        type="button"
        onClick={handleTest}
        disabled={isPending}
        className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50 mb-4"
        style={{ backgroundColor: "var(--color-action)" }}
      >
        {isPending ? "Testing…" : "Test RentCast Connection"}
      </button>

      {isPending && (
        <p className="text-sm" style={{ color: "var(--color-text)", opacity: 0.6 }}>
          Running connection test…
        </p>
      )}

      {!isPending && result && (
        <div className="space-y-2 text-sm">
          {/* Connected / Failed */}
          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: result.connected ? "#22C55E" : "#EF4444",
                display: "inline-block",
                flexShrink: 0,
              }}
            />
            <span style={{ color: result.connected ? "#166534" : "#991B1B", fontWeight: 600 }}>
              {result.connected ? "Connected ✓" : "Failed ✗"}
            </span>
          </div>

          {/* Error */}
          {result.error && (
            <p
              className="rounded-lg px-3 py-2 text-sm"
              style={{ backgroundColor: "#FEF2F2", color: "#991B1B", border: "1px solid #FECACA" }}
              role="alert"
            >
              {result.error}
            </p>
          )}

          {/* Details table */}
          {result.connected && (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs mt-3">
              <dt style={{ color: "var(--color-text)", opacity: 0.6 }}>HTTP status</dt>
              <dd style={{ color: "var(--color-text)" }}>{result.httpStatus ?? "—"}</dd>

              <dt style={{ color: "var(--color-text)", opacity: 0.6 }}>Result count</dt>
              <dd style={{ color: "var(--color-text)" }}>{result.resultCount}</dd>

              <dt style={{ color: "var(--color-text)", opacity: 0.6 }}>Listing contacts</dt>
              <dd style={{ color: "var(--color-text)" }}>{result.hasListingContact ? "Yes" : "No"}</dd>

              <dt style={{ color: "var(--color-text)", opacity: 0.6 }}>Owner lookup</dt>
              <dd style={{ color: "var(--color-text)" }}>{result.hasOwnerLookup ? "Yes" : "No"}</dd>

              <dt style={{ color: "var(--color-text)", opacity: 0.6 }}>Tested at</dt>
              <dd style={{ color: "var(--color-text)" }}>
                {new Date(result.testedAt).toLocaleString()}
              </dd>
            </dl>
          )}
        </div>
      )}
    </div>
  );
}
