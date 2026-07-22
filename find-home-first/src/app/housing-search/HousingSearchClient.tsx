"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import DemoNotice from "@/components/DemoNotice";
import type { PropertyItemView } from "@/lib/types";

// ─── Community imagery ────────────────────────────────────────────────────────
// Images stored in public/images/. Source: Unsplash (free license).
// See public/images/IMAGE_SOURCES.md for full attribution.

const COMMUNITY_IMAGES: Record<string, { src: string; alt: string }> = {
  Eastside: {
    src: "/images/community-eastside.jpg",
    alt: "Eastside community — modern multi-unit residential apartment building",
  },
  Northview: {
    src: "/images/community-northview.jpg",
    alt: "Northview community — family-friendly suburban residential neighborhood",
  },
  Downtown: {
    src: "/images/community-downtown.jpg",
    alt: "Downtown community — urban district with multi-unit housing",
  },
  Westpark: {
    src: "/images/community-westpark.jpg",
    alt: "Westpark community — quiet residential neighborhood with accessible housing",
  },
};

const BEDROOM_OPTIONS = [
  { value: "", label: "Any" },
  { value: "0", label: "Studio / SRO" },
  { value: "1", label: "1 Bedroom" },
  { value: "2", label: "2 Bedrooms" },
  { value: "3", label: "3+ Bedrooms" },
];

function formatCurrency(amount: number) {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function formatDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const fieldStyle: React.CSSProperties = {
  backgroundColor: "#fff",
  border: "1px solid var(--color-border)",
  borderRadius: "0.5rem",
  color: "var(--color-text)",
  padding: "0.5rem 0.75rem",
  fontSize: "0.875rem",
  width: "100%",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.75rem",
  fontWeight: 600,
  marginBottom: "0.375rem",
  color: "var(--color-text)",
  opacity: 0.65,
};

interface Props {
  properties: PropertyItemView[];
  usingDemo: boolean;
}

export default function HousingSearchClient({ properties, usingDemo }: Props) {
  // Derive the community filter options from actual data
  const communities = useMemo(() => {
    const seen = new Set<string>();
    for (const p of properties) {
      if (p.community) seen.add(p.community);
    }
    return ["All Communities", ...Array.from(seen).sort()];
  }, [properties]);

  const [community, setCommunity] = useState("All Communities");
  const [bedrooms, setBedrooms] = useState("");
  const [maxRent, setMaxRent] = useState("");
  const [availableBy, setAvailableBy] = useState("");

  const filtered = useMemo(() => {
    return properties.filter((p) => {
      if (community !== "All Communities" && p.community !== community)
        return false;
      if (bedrooms !== "") {
        const b = parseInt(bedrooms, 10);
        if (bedrooms === "3") {
          if (p.bedrooms < 3) return false;
        } else {
          if (p.bedrooms !== b) return false;
        }
      }
      if (maxRent !== "" && p.monthlyRent > parseInt(maxRent, 10)) return false;
      if (availableBy !== "" && p.availableDate > availableBy) return false;
      return true;
    });
  }, [properties, community, bedrooms, maxRent, availableBy]);

  const hasActiveFilters =
    community !== "All Communities" ||
    bedrooms !== "" ||
    maxRent !== "" ||
    availableBy !== "";

  function handleReset() {
    setCommunity("All Communities");
    setBedrooms("");
    setMaxRent("");
    setAvailableBy("");
  }

  const demoMessage =
    "Demonstration data — RentCast and Zillow integrations are future phases.";

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 lg:px-10">
      {/* Page header */}
      <div className="mb-6">
        {usingDemo && <DemoNotice message={demoMessage} />}
        <h1
          className="text-2xl font-bold"
          style={{ color: "var(--color-primary)" }}
        >
          Housing Search
        </h1>
        <p
          className="mt-1 text-sm"
          style={{ color: "var(--color-text)", opacity: 0.6 }}
        >
          Find available private units to evaluate for placement.
        </p>
      </div>

      {/* ── Filter form ─────────────────────────────────────────────── */}
      <section aria-labelledby="filters-heading" className="mb-8">
        <div
          className="rounded-xl p-5"
          style={{
            backgroundColor: "var(--color-surface-soft)",
            border: "1px solid var(--color-border)",
          }}
        >
          <h2
            id="filters-heading"
            className="text-sm font-semibold mb-4"
            style={{ color: "var(--color-primary)" }}
          >
            Filter units
          </h2>

          <form
            role="search"
            aria-label="Housing unit filters"
            onSubmit={(e) => e.preventDefault()}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              {/* Community */}
              <div>
                <label htmlFor="community" style={labelStyle}>
                  Community
                </label>
                <select
                  id="community"
                  name="community"
                  value={community}
                  onChange={(e) => setCommunity(e.target.value)}
                  style={fieldStyle}
                >
                  {communities.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Bedrooms */}
              <div>
                <label htmlFor="bedrooms" style={labelStyle}>
                  Bedrooms
                </label>
                <select
                  id="bedrooms"
                  name="bedrooms"
                  value={bedrooms}
                  onChange={(e) => setBedrooms(e.target.value)}
                  style={fieldStyle}
                >
                  {BEDROOM_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Max rent */}
              <div>
                <label htmlFor="max-rent" style={labelStyle}>
                  Max monthly rent ($)
                </label>
                <input
                  type="number"
                  id="max-rent"
                  name="max-rent"
                  min={0}
                  step={50}
                  placeholder="No limit"
                  value={maxRent}
                  onChange={(e) => setMaxRent(e.target.value)}
                  style={fieldStyle}
                />
              </div>

              {/* Available by */}
              <div>
                <label htmlFor="available-by" style={labelStyle}>
                  Available by
                </label>
                <input
                  type="date"
                  id="available-by"
                  name="available-by"
                  value={availableBy}
                  onChange={(e) => setAvailableBy(e.target.value)}
                  style={fieldStyle}
                />
              </div>
            </div>

            {/* Reset */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleReset}
                disabled={!hasActiveFilters}
                className="text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text)",
                  backgroundColor: "#fff",
                }}
              >
                Reset filters
              </button>
              {hasActiveFilters && (
                <span
                  className="text-xs"
                  style={{ color: "var(--color-secondary)" }}
                >
                  {filtered.length} of {properties.length} units shown
                </span>
              )}
            </div>
          </form>
        </div>
      </section>

      {/* ── Results ─────────────────────────────────────────────────── */}
      <section aria-labelledby="results-heading">
        <h2
          id="results-heading"
          className="text-base font-semibold mb-4"
          style={{ color: "var(--color-primary)" }}
        >
          {filtered.length === 0
            ? "No units match the current filters"
            : `Results — ${filtered.length} unit${filtered.length === 1 ? "" : "s"}`}
        </h2>

        {filtered.length === 0 ? (
          <div
            className="rounded-xl px-6 py-10 text-center"
            style={{
              backgroundColor: "var(--color-surface-soft)",
              border: "1px solid var(--color-border)",
            }}
          >
            <p
              className="text-sm mb-2"
              style={{ color: "var(--color-text)", opacity: 0.65 }}
            >
              No units match the current filters.
            </p>
            <button
              type="button"
              onClick={handleReset}
              className="text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
              style={{
                backgroundColor: "#fff",
                border: "1px solid var(--color-border)",
                color: "var(--color-secondary)",
              }}
            >
              Clear filters
            </button>
          </div>
        ) : (
          <ul className="space-y-4">
            {filtered.map((unit) => {
              const img = COMMUNITY_IMAGES[unit.community];
              const bedsLabel =
                unit.bedrooms === 0
                  ? "Studio / SRO"
                  : `${unit.bedrooms} Bedroom${unit.bedrooms !== 1 ? "s" : ""}`;

              return (
                <li
                  key={unit.id}
                  className="rounded-xl overflow-hidden"
                  style={{
                    backgroundColor: "#fff",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  <div className="flex flex-col sm:flex-row">
                    {/* Community image — contextual neighbourhood character */}
                    {img && (
                      <div className="sm:w-36 shrink-0 relative overflow-hidden h-40 sm:h-auto">
                        <Image
                          src={img.src}
                          alt={img.alt}
                          width={288}
                          height={320}
                          className="w-full h-full object-cover absolute inset-0"
                          style={{ position: "absolute" }}
                        />
                      </div>
                    )}

                    {/* Details */}
                    <div className="flex-1 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                        <div>
                          <h3
                            className="font-semibold text-sm leading-snug"
                            style={{ color: "var(--color-primary)" }}
                          >
                            {unit.address}
                          </h3>
                          <p
                            className="text-xs mt-0.5"
                            style={{ color: "var(--color-text)", opacity: 0.6 }}
                          >
                            {unit.community}
                          </p>
                        </div>
                        <p
                          className="font-bold text-base shrink-0"
                          style={{ color: "var(--color-primary)" }}
                        >
                          {unit.monthlyRent > 0
                            ? formatCurrency(unit.monthlyRent)
                            : "—"}
                          {unit.monthlyRent > 0 && (
                            <span
                              className="font-normal text-xs ml-1"
                              style={{ opacity: 0.6 }}
                            >
                              /mo
                            </span>
                          )}
                        </p>
                      </div>

                      <div
                        className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs mt-3"
                        style={{ color: "var(--color-text)", opacity: 0.75 }}
                      >
                        <div>
                          <span
                            className="block font-semibold mb-0.5"
                            style={{ opacity: 0.55 }}
                          >
                            Bedrooms
                          </span>
                          {bedsLabel}
                        </div>
                        <div>
                          <span
                            className="block font-semibold mb-0.5"
                            style={{ opacity: 0.55 }}
                          >
                            Available
                          </span>
                          {unit.availableDate ? (
                            <time dateTime={unit.availableDate}>
                              {formatDate(unit.availableDate)}
                            </time>
                          ) : (
                            "—"
                          )}
                        </div>
                        {unit.landlordContact && (
                          <div className="col-span-2">
                            <span
                              className="block font-semibold mb-0.5"
                              style={{ opacity: 0.55 }}
                            >
                              Landlord contact
                            </span>
                            {unit.landlordContact}
                          </div>
                        )}
                        {unit.notes && (
                          <div className="col-span-2">
                            <span
                              className="block font-semibold mb-0.5"
                              style={{ opacity: 0.55 }}
                            >
                              Notes
                            </span>
                            {unit.notes}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
