"use client";

import {
  useMemo,
  useState,
  useRef,
  useEffect,
  useTransition,
  useCallback,
} from "react";
import type { PropertySearchDraftView, PropertyLeadView } from "@/lib/repository";
import type { RentCastListing, RentCastOwner } from "@/lib/rentcast";
import { scoreFromListing, enrichScoreWithOwner } from "@/lib/opportunity-score";
import type { OpportunityResult } from "@/lib/opportunity-score";
import {
  searchPropertiesAction,
  saveDraftAction,
  clearDraftAction,
  fetchOwnerAction,
  saveLeadAction,
  linkOwnerToLeadAction,
  searchThisAreaAction,
  savePropertyTypePreferencesAction,
} from "./actions";
import { PropertyResultsLayout } from "./PropertyResultsLayout";
import {
  PIPELINE_STAGE_LABELS,
  TERMINAL_STAGES,
} from "@/lib/lead-pipeline";
import { LeadWorkspace } from "./LeadWorkspace";
import {
  SUPPORTED_PROPERTY_TYPES,
  classifyListing,
  rankListings,
  type PropertyFitCriteria,
  type PropertyTypePreferences,
  type ListingClassification,
} from "@/lib/property-relevance";

// ─── Constants ────────────────────────────────────────────────────────────────

const PROPERTY_TYPES = [
  { value: "", label: "Any type" },
  { value: "Single Family", label: "Single Family" },
  { value: "Multi Family", label: "Multi-Family" },
  { value: "Condo", label: "Condo" },
  { value: "Townhouse", label: "Townhouse" },
  { value: "Apartment", label: "Apartment" },
  { value: "Other", label: "Other" },
];

const BEDROOM_OPTIONS = [
  { value: "", label: "Any" },
  { value: "0", label: "Studio / SRO" },
  { value: "1", label: "1+" },
  { value: "2", label: "2+" },
  { value: "3", label: "3+" },
  { value: "4", label: "4+" },
];

const BATHROOM_OPTIONS = [
  { value: "", label: "Any" },
  { value: "1", label: "1+" },
  { value: "1.5", label: "1.5+" },
  { value: "2", label: "2+" },
];

// "Any status" is intentionally absent. RentCast omitting status defaults to
// Active — we always send explicitly. Merging Active + Inactive would cost two
// API calls and is deferred to a future phase.
const STATUS_OPTIONS = [
  { value: "active", label: "Active listings" },
  { value: "inactive", label: "Inactive listings" },
];

const MANUAL_SOURCES = [
  { value: "zillow", label: "Zillow (manual entry)" },
  { value: "apartments_com", label: "Apartments.com (manual entry)" },
  { value: "realtor_com", label: "Realtor.com (manual entry)" },
  { value: "craigslist", label: "Craigslist" },
  { value: "facebook", label: "Facebook Marketplace" },
  { value: "direct_owner", label: "Direct Owner Outreach" },
  { value: "referral", label: "Referral" },
  { value: "driving", label: "Driving for Dollars" },
  { value: "other", label: "Other" },
];

// PIPELINE_STAGES is imported from @/lib/lead-pipeline above

// ─── Styles ───────────────────────────────────────────────────────────────────

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(n: number | null) {
  if (n == null) return "—";
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Debounce: fire fn only after ms ms of silence. */
function useDebounced<T>(fn: (val: T) => void, ms: number) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  return useCallback(
    (val: T) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => fn(val), ms);
    },
    [fn, ms]
  );
}

// ─── Score badge ──────────────────────────────────────────────────────────────

function ScoreBadge({ result, isEnriched }: { result: OpportunityResult; isEnriched?: boolean }) {
  const availableSignals = result.signals.filter((s) => s.available && s.earned > 0).length;
  const label = isEnriched
    ? `Owner Opportunity: ${result.score}/100`
    : `Listing signals: ${availableSignals}`;
  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{
        backgroundColor: result.score >= 40 ? "var(--color-secondary)" : "var(--color-surface-soft)",
        color: result.score >= 40 ? "#fff" : "var(--color-text)",
        border: "1px solid var(--color-border)",
      }}
    >
      {label}
    </div>
  );
}

// ─── Fit badge ────────────────────────────────────────────────────────────────

function FitBadge({ fitStatus }: { fitStatus: "strong_fit" | "review_needed" | "does_not_meet" }) {
  const config = {
    strong_fit: { symbol: "✓", label: "Strong Fit", bg: "#D1FAE5", color: "#065F46", border: "#6EE7B7" },
    review_needed: { symbol: "?", label: "Review Needed", bg: "#FEF3C7", color: "#92400E", border: "#FDE68A" },
    does_not_meet: { symbol: "×", label: "Does Not Meet", bg: "#FEE2E2", color: "#991B1B", border: "#FECACA" },
  }[fitStatus];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
      style={{ backgroundColor: config.bg, color: config.color, border: `1px solid ${config.border}` }}
    >
      {config.symbol} {config.label}
    </span>
  );
}

// ─── Owner panel ──────────────────────────────────────────────────────────────

function OwnerPanel({
  propertyId,
  leadId,
  projectId,
  listing,
}: {
  propertyId: string;
  leadId: string | null;
  projectId: string;
  listing: RentCastListing;
}) {
  const [owner, setOwner] = useState<RentCastOwner | null>(null);
  const [enrichedScore, setEnrichedScore] = useState<OpportunityResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetched, setFetched] = useState(false);

  async function loadOwner() {
    setLoading(true);
    setError(null);
    const result = await fetchOwnerAction(propertyId, projectId);
    setLoading(false);
    setFetched(true);
    if (result.unconfigured) {
      setError("Owner lookup is not yet configured.");
    } else if (result.error) {
      setError(result.error);
    } else {
      setOwner(result.owner);
      if (result.owner) {
        const enriched = enrichScoreWithOwner(listing, result.owner);
        setEnrichedScore(enriched);
        // Sequence B: link owner to lead if we have both IDs (lead was saved first)
        if (leadId && result.ownerId) {
          linkOwnerToLeadAction(leadId, result.ownerId, projectId).catch(() => {
            // non-fatal — link failure does not block UI
          });
        }
      }
    }
  }

  if (!fetched) {
    return (
      <button
        type="button"
        onClick={loadOwner}
        className="text-xs font-semibold px-3 py-1.5 rounded-lg"
        style={{
          border: "1px solid var(--color-border)",
          backgroundColor: "#fff",
          color: "var(--color-secondary)",
        }}
      >
        View Owner Details
      </button>
    );
  }

  if (loading) {
    return (
      <p className="text-xs" style={{ color: "var(--color-text)", opacity: 0.55 }}>
        Loading owner details…
      </p>
    );
  }

  if (error) {
    return (
      <p className="text-xs" style={{ color: "#B91C1C" }}>
        {error}
      </p>
    );
  }

  if (!owner) {
    return (
      <p className="text-xs" style={{ color: "var(--color-text)", opacity: 0.55 }}>
        No owner information found for this property.
      </p>
    );
  }

  return (
    <div
      className="mt-3 rounded-lg p-3 text-xs space-y-1.5"
      style={{
        backgroundColor: "var(--color-surface-soft)",
        border: "1px solid var(--color-border)",
      }}
    >
      <p
        className="font-semibold text-xs mb-1"
        style={{ color: "var(--color-primary)" }}
      >
        Owner Information
      </p>
      {owner.ownerName && (
        <p style={{ color: "var(--color-text)", opacity: 0.85 }}>
          <span style={{ opacity: 0.55 }}>Name: </span>
          {owner.ownerName}
        </p>
      )}
      {owner.ownerType && (
        <p style={{ color: "var(--color-text)", opacity: 0.85 }}>
          <span style={{ opacity: 0.55 }}>Type: </span>
          {owner.ownerType}
        </p>
      )}
      {owner.mailingAddress && (
        <p style={{ color: "var(--color-text)", opacity: 0.85 }}>
          <span style={{ opacity: 0.55 }}>Mailing address: </span>
          {owner.mailingAddress}
        </p>
      )}
      {owner.ownerOccupied != null && (
        <p style={{ color: "var(--color-text)", opacity: 0.85 }}>
          <span style={{ opacity: 0.55 }}>Owner-occupied: </span>
          {owner.ownerOccupied ? "Yes" : "No"}
        </p>
      )}

      {enrichedScore && (
        <div className="mt-2 pt-2" style={{ borderTop: "1px solid var(--color-border)" }}>
          <div className="flex items-center gap-2 mb-2">
            <p className="font-semibold text-xs" style={{ color: "var(--color-secondary)" }}>
              Opportunity Score
            </p>
            <ScoreBadge result={enrichedScore} isEnriched={true} />
          </div>
          <ul className="space-y-0.5">
            {enrichedScore.signals.filter((s) => s.available && s.earned > 0).map((sig) => (
              <li
                key={sig.key}
                className="flex items-center gap-1.5"
                style={{ color: "var(--color-text)", opacity: 0.8 }}
              >
                <span aria-hidden="true" style={{ color: "var(--color-secondary)" }}>●</span>
                {sig.label}
                {sig.value && typeof sig.value === "string" && <span style={{ opacity: 0.55 }}> ({sig.value})</span>}
              </li>
            ))}
          </ul>
          <p
            className="mt-1.5 text-xs"
            style={{ color: "var(--color-text)", opacity: 0.5 }}
          >
            These are supporting signals. Use your own judgment before
            contacting the owner.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Fit reasons panel ────────────────────────────────────────────────────────

function FitReasonsPanel({ reasons }: { reasons: import("@/lib/property-relevance").FitReason[] }) {
  const [open, setOpen] = useState(false);
  const statusIcon = { pass: "✓", fail: "×", missing: "?", info: "ℹ" } as const;
  const statusColor = {
    pass: "#065F46",
    fail: "#991B1B",
    missing: "#92400E",
    info: "#1E3A5F",
  } as const;
  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        className="text-xs font-medium underline"
        style={{ color: "var(--color-secondary)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
      >
        {open ? "▲ Hide rating details" : "▼ Why this rating?"}
      </button>
      {open && (
        <ul className="mt-2 space-y-1 text-xs pl-1">
          {reasons.map((r, i) => (
            <li key={i} style={{ color: statusColor[r.status] }}>
              <span aria-hidden="true">{statusIcon[r.status]}</span> {r.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Listing card ─────────────────────────────────────────────────────────────

function ListingCard({
  listing,
  projectId,
  isSelected,
  onSelect,
  savedLeadIds,
  onSaved,
  classification,
}: {
  listing: RentCastListing;
  projectId: string;
  isSelected: boolean;
  onSelect: () => void;
  savedLeadIds: Set<string>;
  onSaved?: (leadId: string) => void;
  classification?: ListingClassification;
}) {
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [leadId, setLeadId] = useState<string | null>(null);
  const cardRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (isSelected && cardRef.current) {
      cardRef.current.scrollIntoView({
        behavior: prefersReducedMotion() ? "auto" : "smooth",
        block: "nearest",
      });
    }
  }, [isSelected]);

  // Pre-enrichment opportunity score from listing data only
  const preScore = useMemo(() => scoreFromListing(listing), [listing]);
  const isSaved = listing.id ? savedLeadIds.has(listing.id) : false;

  function handleSave() {
    startTransition(async () => {
      setSaving(true);
      setSaveMsg(null);
      const result = await saveLeadAction({
        source: "rentcast",
        externalId: listing.id || undefined,
        address: listing.formattedAddress || listing.addressLine1,
        city: listing.city || undefined,
        state: listing.state || undefined,
        zip: listing.zipCode || undefined,
        propertyType: listing.propertyType || undefined,
        bedrooms: listing.bedrooms ?? undefined,
        bathrooms: listing.bathrooms ?? undefined,
        monthlyRent: listing.price ?? undefined,
        listingStatus: listing.status || undefined,
        listingDate: listing.listingDate || undefined,
        lastSeenDate: listing.lastSeenDate || undefined,
        daysOnMarket: listing.daysOnMarket ?? undefined,
        listingContact: listing.listedBy || undefined,
        listingPhone: listing.listedByPhone || undefined,
        listingEmail: listing.listedByEmail || undefined,
        projectId,
        opportunityScore: preScore.score,
        opportunitySignals: JSON.stringify(preScore.signals),
      });
      setSaving(false);
      if (result.duplicate) {
        setSaveMsg("Already saved in your pipeline.");
        if (result.leadId) {
          setLeadId(result.leadId);
          // Already in DB — still notify parent so ★ appears if session started before save
          onSaved?.(result.leadId);
        }
      } else if (result.ok) {
        setSaveMsg("Saved to your property leads.");
        if (result.leadId) {
          setLeadId(result.leadId);
          // Notify parent so the ★ appears immediately without a page reload
          onSaved?.(result.leadId);
        }
      } else {
        setSaveMsg(result.error ?? "Could not save.");
      }
    });
  }

  const propertyLabel = [
    listing.propertyType,
    listing.bedrooms != null ? `${listing.bedrooms} BR` : null,
    listing.bathrooms != null ? `${listing.bathrooms} BA` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li
      ref={cardRef}
      className="rounded-xl overflow-hidden"
      style={{
        backgroundColor: "#fff",
        border: isSelected ? "2px solid var(--color-primary)" : "1px solid var(--color-border)",
        cursor: "pointer",
      }}
      onClick={onSelect}
    >
      <div className="p-5">
        {/* Header row */}
        <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
          <div className="min-w-0">
            <h3
              className="font-semibold text-sm leading-snug"
              style={{ color: "var(--color-primary)" }}
            >
              {listing.formattedAddress || listing.addressLine1}
              {isSaved && (
                <span
                  className="ml-1.5 text-xs font-normal"
                  style={{ color: "#D97706" }}
                  title="Saved to pipeline"
                  aria-label="Saved"
                >
                  ★
                </span>
              )}
            </h3>
            {propertyLabel && (
              <p
                className="text-xs mt-0.5"
                style={{ color: "var(--color-text)", opacity: 0.6 }}
              >
                {propertyLabel}
              </p>
            )}
          </div>
          <div className="shrink-0 text-right">
            <p
              className="font-bold text-base"
              style={{ color: "var(--color-primary)" }}
            >
              {formatCurrency(listing.price)}
              {listing.price != null && (
                <span
                  className="font-normal text-xs ml-1"
                  style={{ opacity: 0.6 }}
                >
                  /mo
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Fit badge + score badge */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {classification && <FitBadge fitStatus={classification.fitStatus} />}
          <ScoreBadge result={preScore} isEnriched={false} />
        </div>

        {/* Expandable fit reasons */}
        {classification && classification.reasons.length > 0 && (
          <FitReasonsPanel reasons={classification.reasons} />
        )}

        {/* Metadata grid */}
        <div
          className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 text-xs mt-3 mb-4"
          style={{ color: "var(--color-text)", opacity: 0.75 }}
        >
          <div>
            <span className="block font-semibold mb-0.5" style={{ opacity: 0.55 }}>
              Status
            </span>
            {listing.status ?? "—"}
          </div>
          <div>
            <span className="block font-semibold mb-0.5" style={{ opacity: 0.55 }}>
              Listed
            </span>
            {formatDate(listing.listingDate)}
          </div>
          <div>
            <span className="block font-semibold mb-0.5" style={{ opacity: 0.55 }}>
              Days on market
            </span>
            {listing.daysOnMarket != null ? `${listing.daysOnMarket} days` : "—"}
          </div>
          <div>
            <span className="block font-semibold mb-0.5" style={{ opacity: 0.55 }}>
              Last seen
            </span>
            {formatDate(listing.lastSeenDate)}
          </div>
          {listing.listedBy && (
            <div className="col-span-2">
              <span className="block font-semibold mb-0.5" style={{ opacity: 0.55 }}>
                Listing contact
              </span>
              {listing.listedBy}
              {listing.listedByPhone && ` · ${listing.listedByPhone}`}
              {listing.listedByEmail && ` · ${listing.listedByEmail}`}
            </div>
          )}
        </div>

        {/* Actions — stopPropagation so button clicks don't deselect the card */}
        <div className="flex flex-wrap items-center gap-2 mb-3" onClick={e => e.stopPropagation()}>
          {/* Show "Save Anyway" on does_not_meet, otherwise "Save Property Lead" */}
          {classification?.fitStatus === "does_not_meet" ? (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || isPending}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50"
              style={{
                border: "1px solid var(--color-border)",
                backgroundColor: "#fff",
                color: "var(--color-text)",
              }}
            >
              {saving ? "Saving…" : "Save Anyway"}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || isPending}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white disabled:opacity-50"
              style={{ backgroundColor: "var(--color-action)" }}
            >
              {saving ? "Saving…" : "Save Property Lead"}
            </button>
          )}
          {saveMsg && (
            <span
              className="text-xs"
              style={{
                color: saveMsg.includes("Could not") ? "#B91C1C" : "var(--color-secondary)",
              }}
              aria-live="polite"
            >
              {saveMsg}
            </span>
          )}
        </div>

        {/* On-demand owner enrichment — stopPropagation so clicks don't deselect card */}
        {listing.id && (
          <div onClick={e => e.stopPropagation()}>
            <OwnerPanel
              propertyId={listing.id}
              leadId={leadId}
              projectId={projectId}
              listing={listing}
            />
          </div>
        )}
      </div>
    </li>
  );
}

// ─── Manual property lead form ────────────────────────────────────────────────

function ManualLeadForm({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState("zillow");
  const [sourceUrl, setSourceUrl] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [monthlyRent, setMonthlyRent] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [bathrooms, setBathrooms] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!address.trim()) return;
    startTransition(async () => {
      setMsg(null);
      const result = await saveLeadAction({
        source,
        sourceUrl: sourceUrl.trim() || undefined,
        address: address.trim(),
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        zip: zip.trim() || undefined,
        monthlyRent: monthlyRent ? parseFloat(monthlyRent) : undefined,
        bedrooms: bedrooms ? parseInt(bedrooms, 10) : undefined,
        bathrooms: bathrooms ? parseFloat(bathrooms) : undefined,
        propertyType: propertyType || undefined,
        listingContact: ownerName.trim() || undefined,
        listingPhone: ownerPhone.trim() || undefined,
        listingEmail: ownerEmail.trim() || undefined,
        notes: notes.trim() || undefined,
        projectId,
      });
      if (result.duplicate) {
        setMsg({ ok: false, text: "This property is already saved in your pipeline." });
      } else if (result.ok) {
        setMsg({ ok: true, text: "Property lead saved." });
        // Clear form
        setSourceUrl(""); setAddress(""); setCity(""); setState("");
        setZip(""); setMonthlyRent(""); setBedrooms(""); setBathrooms("");
        setPropertyType(""); setOwnerName(""); setOwnerPhone("");
        setOwnerEmail(""); setNotes("");
      } else {
        setMsg({ ok: false, text: result.error ?? "Could not save." });
      }
    });
  }

  return (
    <section aria-labelledby="manual-lead-heading" className="mb-8">
      <div
        className="rounded-xl overflow-hidden"
        style={{ border: "1px solid var(--color-border)" }}
      >
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center justify-between px-5 py-4 text-left"
          style={{
            backgroundColor: "var(--color-surface-soft)",
            color: "var(--color-primary)",
          }}
          aria-expanded={open}
          aria-controls="manual-lead-form"
        >
          <span className="font-semibold text-sm" id="manual-lead-heading">
            Add Property Manually
          </span>
          <span aria-hidden="true">{open ? "▲" : "▼"}</span>
        </button>

        {open && (
          <form
            id="manual-lead-form"
            onSubmit={handleSubmit}
            className="px-5 py-5 bg-white space-y-4"
          >
            <p className="text-xs" style={{ color: "var(--color-text)", opacity: 0.55 }}>
              Add a property lead from any source manually. Zillow and other portals
              require manual entry — no scraping.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Source */}
              <div>
                <label htmlFor="ml-source" style={labelStyle}>Source *</label>
                <select id="ml-source" value={source} onChange={(e) => setSource(e.target.value)} style={fieldStyle}>
                  {MANUAL_SOURCES.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              {/* Listing URL */}
              <div>
                <label htmlFor="ml-url" style={labelStyle}>Listing URL</label>
                <input type="url" id="ml-url" placeholder="https://…" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} style={fieldStyle} />
              </div>
              {/* Address */}
              <div className="sm:col-span-2">
                <label htmlFor="ml-address" style={labelStyle}>Address *</label>
                <input type="text" id="ml-address" required placeholder="123 Main St, Unit 4" value={address} onChange={(e) => setAddress(e.target.value)} style={fieldStyle} />
              </div>
              {/* City */}
              <div>
                <label htmlFor="ml-city" style={labelStyle}>City</label>
                <input type="text" id="ml-city" value={city} onChange={(e) => setCity(e.target.value)} style={fieldStyle} />
              </div>
              {/* State */}
              <div>
                <label htmlFor="ml-state" style={labelStyle}>State</label>
                <input type="text" id="ml-state" maxLength={2} placeholder="GA" value={state} onChange={(e) => setState(e.target.value.toUpperCase())} style={fieldStyle} />
              </div>
              {/* ZIP */}
              <div>
                <label htmlFor="ml-zip" style={labelStyle}>ZIP code</label>
                <input type="text" id="ml-zip" value={zip} onChange={(e) => setZip(e.target.value)} style={fieldStyle} />
              </div>
              {/* Monthly rent */}
              <div>
                <label htmlFor="ml-rent" style={labelStyle}>Monthly lease amount ($)</label>
                <input type="number" id="ml-rent" min={0} step={50} value={monthlyRent} onChange={(e) => setMonthlyRent(e.target.value)} style={fieldStyle} />
              </div>
              {/* Bedrooms */}
              <div>
                <label htmlFor="ml-beds" style={labelStyle}>Bedrooms</label>
                <select id="ml-beds" value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} style={fieldStyle}>
                  <option value="">—</option>
                  {BEDROOM_OPTIONS.filter((o) => o.value !== "").map((o) => (
                    <option key={o.value} value={o.value}>{o.label.replace("+", "")}</option>
                  ))}
                </select>
              </div>
              {/* Bathrooms */}
              <div>
                <label htmlFor="ml-baths" style={labelStyle}>Bathrooms</label>
                <select id="ml-baths" value={bathrooms} onChange={(e) => setBathrooms(e.target.value)} style={fieldStyle}>
                  <option value="">—</option>
                  {BATHROOM_OPTIONS.filter((o) => o.value !== "").map((o) => (
                    <option key={o.value} value={o.value}>{o.label.replace("+", "")}</option>
                  ))}
                </select>
              </div>
              {/* Property type */}
              <div>
                <label htmlFor="ml-type" style={labelStyle}>Property type</label>
                <select id="ml-type" value={propertyType} onChange={(e) => setPropertyType(e.target.value)} style={fieldStyle}>
                  {PROPERTY_TYPES.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              {/* Owner/contact name */}
              <div>
                <label htmlFor="ml-owner" style={labelStyle}>Owner / contact name</label>
                <input type="text" id="ml-owner" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} style={fieldStyle} />
              </div>
              {/* Phone */}
              <div>
                <label htmlFor="ml-phone" style={labelStyle}>Phone</label>
                <input type="tel" id="ml-phone" value={ownerPhone} onChange={(e) => setOwnerPhone(e.target.value)} style={fieldStyle} />
              </div>
              {/* Email */}
              <div>
                <label htmlFor="ml-email" style={labelStyle}>Email</label>
                <input type="email" id="ml-email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} style={fieldStyle} />
              </div>
              {/* Notes */}
              <div className="sm:col-span-2">
                <label htmlFor="ml-notes" style={labelStyle}>Notes</label>
                <textarea id="ml-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} style={{ ...fieldStyle, resize: "vertical" }} />
              </div>
            </div>

            {msg && (
              <p
                className="text-sm"
                style={{ color: msg.ok ? "var(--color-secondary)" : "#B91C1C" }}
                role={msg.ok ? undefined : "alert"}
                aria-live="polite"
              >
                {msg.text}
              </p>
            )}

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={isPending || !address.trim()}
                className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: "var(--color-action)" }}
              >
                {isPending ? "Saving…" : "Save Property Lead"}
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}

// ─── Lead Workspace ───────────────────────────────────────────────────────────

function SavedLeadsPanel({
  leads,
  projectId,
}: {
  leads: PropertyLeadView[];
  projectId: string;
}) {
  const [open, setOpen] = useState(false);
  const [stageUpdates, setStageUpdates] = useState<Record<string, string>>({});
  const [expandedLeadId, setExpandedLeadId] = useState<string | null>(null);

  if (leads.length === 0) return null;

  function handleStageChange(leadId: string, newStage: string) {
    setStageUpdates((prev) => ({ ...prev, [leadId]: newStage }));
  }

  return (
    <section aria-labelledby="saved-leads-heading" className="mb-8">
      <div
        className="rounded-xl overflow-hidden"
        style={{ border: "1px solid var(--color-border)" }}
      >
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center justify-between px-5 py-4 text-left"
          style={{
            backgroundColor: "var(--color-surface-soft)",
            color: "var(--color-primary)",
          }}
          aria-expanded={open}
          aria-controls="saved-leads-list"
        >
          <span className="font-semibold text-sm" id="saved-leads-heading">
            Saved Property Leads ({leads.length})
          </span>
          <span aria-hidden="true">{open ? "▲" : "▼"}</span>
        </button>

        {open && (
          <ul id="saved-leads-list" className="divide-y bg-white" style={{ borderTop: "1px solid var(--color-border)" }}>
            {leads.map((lead) => {
              const currentStage = stageUpdates[lead.id] ?? lead.acquisitionStage;
              const stageLabel = PIPELINE_STAGE_LABELS[currentStage] ?? currentStage;
              const isExpanded = expandedLeadId === lead.id;
              return (
                <li key={lead.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium" style={{ color: "var(--color-primary)" }}>
                        {lead.address}
                      </p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        <span
                          className="text-xs px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: "var(--color-surface-soft)",
                            border: "1px solid var(--color-border)",
                            color: "var(--color-text)",
                          }}
                        >
                          {lead.source}
                        </span>
                        {lead.daysOnMarket != null && (
                          <span className="text-xs" style={{ color: "var(--color-text)", opacity: 0.55 }}>
                            {lead.daysOnMarket} days on market
                          </span>
                        )}
                        {lead.opportunityScore != null && (
                          <span
                            className="text-xs px-2 py-0.5 rounded-full font-semibold"
                            style={{
                              backgroundColor: lead.opportunityScore >= 40 ? "var(--color-secondary)" : "var(--color-surface-soft)",
                              color: lead.opportunityScore >= 40 ? "#fff" : "var(--color-text)",
                              border: "1px solid var(--color-border)",
                            }}
                          >
                            Score: {lead.opportunityScore}
                          </span>
                        )}
                        <span
                          className="text-xs px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: TERMINAL_STAGES.has(currentStage) ? "#FEF3C7" : "var(--color-surface-soft)",
                            border: "1px solid var(--color-border)",
                            color: TERMINAL_STAGES.has(currentStage) ? "#92400E" : "var(--color-secondary)",
                          }}
                        >
                          {stageLabel}
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0">
                      <button
                        type="button"
                        onClick={() => setExpandedLeadId(isExpanded ? null : lead.id)}
                        className="text-xs font-semibold px-2.5 py-1 rounded-lg"
                        style={{
                          border: "1px solid var(--color-border)",
                          backgroundColor: isExpanded ? "var(--color-primary)" : "#fff",
                          color: isExpanded ? "#fff" : "var(--color-secondary)",
                          cursor: "pointer",
                        }}
                        aria-expanded={isExpanded}
                      >
                        {isExpanded ? "Close ▲" : "Workspace ▼"}
                      </button>
                    </div>
                  </div>
                  {isExpanded && (
                    <LeadWorkspace
                      lead={{ ...lead, acquisitionStage: currentStage }}
                      projectId={projectId}
                      onStageChange={handleStageChange}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  initialDraft: PropertySearchDraftView;
  savedLeadCount: number;
  savedLeads: PropertyLeadView[];
  rentCastConfigured: boolean;
  isDemoMode: boolean;
  projectId: string;
  hasCompletedReport: boolean;
  fitCriteria: PropertyFitCriteria;
  initialPropertyTypePreferences: PropertyTypePreferences;
}

/** Parse the stored results snapshot back to RentCastListing[]. */
function parseSnapshot(snapshot: string | null): RentCastListing[] {
  if (!snapshot) return [];
  try {
    const parsed = JSON.parse(snapshot);
    return Array.isArray(parsed) ? (parsed as RentCastListing[]) : [];
  } catch {
    return [];
  }
}

export default function PropertySearchClient({
  initialDraft,
  savedLeadCount,
  savedLeads: initialSavedLeads,
  rentCastConfigured,
  projectId,
  hasCompletedReport,
  fitCriteria,
  initialPropertyTypePreferences,
}: Props) {
  // ── Saved leads — tracked as state so the ★ appears immediately on save ──
  const [savedLeads, setSavedLeads] = useState<PropertyLeadView[]>(initialSavedLeads);

  // ── Fit criteria + property type preferences ─────────────────────────────
  const [fitCriteriaState, setFitCriteriaState] = useState<PropertyFitCriteria>(fitCriteria);
  const [typePrefs, setTypePrefs] = useState<PropertyTypePreferences>(initialPropertyTypePreferences);
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [prefsMsg, setPrefsMsg] = useState<string | null>(null);
  const [showTypeConfig, setShowTypeConfig] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "strong_fit" | "review_needed" | "does_not_meet" | "saved">("all");

  // ── Filter state — initialised from server-loaded draft ─────────────────
  const [city, setCity] = useState(initialDraft.city);
  const [state, setState] = useState(initialDraft.state);
  const [zipCode, setZipCode] = useState(initialDraft.zipCode);
  const [propertyType, setPropertyType] = useState(initialDraft.propertyType);
  const [minBedrooms, setMinBedrooms] = useState(initialDraft.minBedrooms);
  const [minBathrooms, setMinBathrooms] = useState(initialDraft.minBathrooms);
  const [maxRent, setMaxRent] = useState(initialDraft.maxRent);
  const [maxDaysListed, setMaxDaysListed] = useState(initialDraft.maxDaysListed);
  const [listingStatus, setListingStatus] = useState(initialDraft.listingStatus);

  const [submitted, setSubmitted] = useState(initialDraft.submitted);
  // Restore last result set from snapshot — no re-fetch on remount.
  const [results, setResults] = useState<RentCastListing[]>(() =>
    parseSnapshot(initialDraft.resultsSnapshot)
  );
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearching, startSearch] = useTransition();
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [isPending, startTransition] = useTransition();
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // ── Map state ────────────────────────────────────────────────────────────
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(
    initialDraft.mapLatitude && initialDraft.mapLongitude
      ? { lat: parseFloat(initialDraft.mapLatitude), lng: parseFloat(initialDraft.mapLongitude) }
      : null
  );
  const [mapRadius, setMapRadius] = useState<number>(initialDraft.mapRadiusMi ?? 10);
  const [isAreaSearching, startAreaSearch] = useTransition();

  // ── Draft helpers ────────────────────────────────────────────────────────
  function currentDraft(): PropertySearchDraftView {
    return {
      projectId: initialDraft.projectId, // always a string — required
      city,
      state,
      zipCode,
      propertyType,
      minBedrooms,
      minBathrooms,
      maxRent,
      maxDaysListed,
      listingStatus,
      submitted,
      lastSearchAt: initialDraft.lastSearchAt,
      resultsSnapshot: initialDraft.resultsSnapshot,
      resultsCount: initialDraft.resultsCount,
      queryFingerprint: initialDraft.queryFingerprint,
      mapLatitude: initialDraft.mapLatitude,
      mapLongitude: initialDraft.mapLongitude,
      mapRadiusMi: initialDraft.mapRadiusMi,
      mapMode: initialDraft.mapMode,
    };
  }

  const persistDraft = useCallback((draft: PropertySearchDraftView) => {
    startTransition(async () => {
      setSaveStatus("saving");
      const { ok } = await saveDraftAction(draft);
      setSaveStatus(ok ? "saved" : "error");
      if (ok) setTimeout(() => setSaveStatus("idle"), 2000);
    });
  }, []);

  const debouncedSave = useDebounced(persistDraft, 700);

  function handleFieldChange(
    setter: React.Dispatch<React.SetStateAction<string>>,
    key: keyof PropertySearchDraftView,
    value: string
  ) {
    setter(value);
    const draft = { ...currentDraft(), [key]: value };
    debouncedSave(draft);
  }

  // ── Search ───────────────────────────────────────────────────────────────
  function handleSearch() {
    const draft = currentDraft();
    setSubmitted(true);
    setSearchError(null);

    startSearch(async () => {
      const result = await searchPropertiesAction({
        ...draft,
        submitted: true,
        lastSearchAt: new Date(),
      });
      if (result.error) {
        setSearchError(result.error);
        setResults([]);
      } else {
        setResults(result.listings);
      }
    });
  }

  // ── Reset ────────────────────────────────────────────────────────────────
  const hasSomething =
    city || state || zipCode || propertyType || minBedrooms ||
    minBathrooms || maxRent || maxDaysListed || submitted;

  function handleResetRequest() {
    if (hasSomething) {
      setShowResetConfirm(true);
    } else {
      doReset();
    }
  }

  function doReset() {
    setShowResetConfirm(false);
    setCity(""); setState(""); setZipCode(""); setPropertyType("");
    setMinBedrooms(""); setMinBathrooms(""); setMaxRent("");
    setMaxDaysListed(""); setListingStatus("active");
    setSubmitted(false); setResults([]); setSearchError(null);

    startTransition(async () => {
      setSaveStatus("saving");
      const { ok } = await clearDraftAction(initialDraft.projectId); // always a string
      setSaveStatus(ok ? "idle" : "error");
    });
  }

  const hasActiveFilters = useMemo(
    () => !!(city || state || zipCode || propertyType || minBedrooms ||
      minBathrooms || maxRent || maxDaysListed),
    [city, state, zipCode, propertyType, minBedrooms, minBathrooms, maxRent, maxDaysListed]
  );

  // ── Saved leads set (for map indicator) ─────────────────────────────────
  const savedLeadIds = useMemo(
    () => new Set(savedLeads.map(l => l.externalId ?? l.id)),
    [savedLeads]
  );

  // ── Classify and rank results ─────────────────────────────────────────────
  const classifiedResults = useMemo(() => {
    const seenIds = new Set<string>();
    const seenAddresses = new Map<string, string>();
    return results.map((listing) =>
      classifyListing(listing, fitCriteriaState, savedLeadIds, seenIds, seenAddresses)
    );
  }, [results, fitCriteriaState, savedLeadIds]);

  const ranked = useMemo(
    () => rankListings(classifiedResults),
    [classifiedResults]
  );

  const counts = useMemo(() => {
    return {
      all: results.length,
      strong_fit: classifiedResults.filter(c => c.fitStatus === "strong_fit").length,
      review_needed: classifiedResults.filter(c => c.fitStatus === "review_needed").length,
      does_not_meet: classifiedResults.filter(c => c.fitStatus === "does_not_meet").length,
      saved: savedLeads.length,
    };
  }, [classifiedResults, results.length, savedLeads.length]);

  const classifiedById = useMemo(() => {
    const map: Record<string, ListingClassification> = {};
    classifiedResults.forEach(c => { map[c.listingId] = c; });
    return map;
  }, [classifiedResults]);

  // Listings visible in current tab (ranked order)
  const visibleListings = useMemo(() => {
    if (activeTab === "all") return ranked;
    if (activeTab === "saved") {
      return ranked.filter(c => savedLeadIds.has(c.listingId));
    }
    return ranked.filter(c => c.fitStatus === activeTab);
  }, [ranked, activeTab, savedLeadIds]);

  // The raw RentCast listings for visible classified results
  const visibleRawListings = useMemo(() => {
    const visibleSet = new Set(visibleListings.map(c => c.listingId));
    return results.filter(l => visibleSet.has(l.id));
  }, [results, visibleListings]);

  // ── Search This Area (map-driven) ────────────────────────────────────────
  function handleSearchThisArea(lat: number, lng: number, radiusMi: number) {
    setMapCenter({ lat, lng });
    setMapRadius(radiusMi);
    // Persist map state to draft
    startTransition(async () => {
      await saveDraftAction({
        ...currentDraft(),
        mapLatitude: String(lat),
        mapLongitude: String(lng),
        mapRadiusMi: radiusMi,
      });
    });
    startAreaSearch(async () => {
      const result = await searchThisAreaAction({
        projectId,
        latitude: lat,
        longitude: lng,
        radiusMiles: radiusMi,
        propertyType: propertyType || undefined,
        minBedrooms: minBedrooms || undefined,
        minBathrooms: minBathrooms || undefined,
        maxRent: maxRent || undefined,
        maxDaysListed: maxDaysListed || undefined,
        listingStatus: listingStatus || undefined,
      });
      if (result.error) {
        setSearchError(result.error);
      } else {
        setResults(result.listings);
        setSubmitted(true);
      }
    });
  }

  // ── Save property type preferences ──────────────────────────────────────
  async function handleSavePreferences() {
    setPrefsSaving(true);
    setPrefsMsg(null);
    const result = await savePropertyTypePreferencesAction(projectId, typePrefs);
    setPrefsSaving(false);
    if (result.ok) {
      setPrefsMsg("Preferences saved.");
      // Update fitCriteriaState so classification reruns immediately
      setFitCriteriaState(prev => ({ ...prev, propertyTypePreferences: typePrefs }));
      setTimeout(() => setPrefsMsg(null), 3000);
    } else {
      setPrefsMsg(result.error ?? "Could not save preferences.");
    }
  }

  const lastSearchLabel = initialDraft.lastSearchAt
    ? `Last searched ${new Date(initialDraft.lastSearchAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
    : null;

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 lg:px-10">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: "var(--color-primary)" }}>
          Find Properties &amp; Owners
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--color-text)", opacity: 0.6 }}>
          Find motivated property owners and suitable rental properties to
          lease. Set your criteria and press{" "}
          <strong>Search Properties</strong> to begin.
        </p>

        {/* Metadata row */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
          {savedLeadCount > 0 && (
            <p className="text-xs" style={{ color: "var(--color-secondary)" }}>
              {savedLeadCount} saved property lead{savedLeadCount !== 1 ? "s" : ""}
            </p>
          )}
          {lastSearchLabel && (
            <p className="text-xs" style={{ color: "var(--color-text)", opacity: 0.5 }}>
              {lastSearchLabel}
            </p>
          )}
          {saveStatus === "saving" && (
            <p className="text-xs" style={{ color: "var(--color-text)", opacity: 0.45 }} aria-live="polite">
              Saving draft…
            </p>
          )}
          {saveStatus === "saved" && (
            <p className="text-xs" style={{ color: "var(--color-secondary)" }} aria-live="polite">
              Draft saved
            </p>
          )}
        </div>

        {/* No City Report notice — non-blocking */}
        {!hasCompletedReport && (
          <div
            className="mt-4 flex gap-2 rounded-lg px-4 py-3 text-sm"
            style={{
              backgroundColor: "var(--color-surface-soft)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
            }}
          >
            <span aria-hidden="true" style={{ opacity: 0.6 }}>ℹ</span>
            <p>
              No City Report found for this project. Search criteria may not be prefilled.{" "}
              <a
                href={`/projects/${projectId}/research`}
                className="underline"
                style={{ color: "var(--color-secondary)" }}
              >
                View City Report
              </a>
            </p>
          </div>
        )}

        {/* RentCast not configured notice */}
        {!rentCastConfigured && (
          <div
            className="mt-4 flex gap-2 rounded-lg px-4 py-3 text-sm"
            style={{
              backgroundColor: "var(--color-surface-soft)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text)",
            }}
          >
            <span aria-hidden="true" style={{ opacity: 0.6 }}>ℹ</span>
            <p>
              Property search via RentCast is not yet configured. You can still
              save property leads manually using other sources.
            </p>
          </div>
        )}
      </div>

      {/* ── Suitable Property Types ──────────────────────────────────── */}
      <section aria-labelledby="type-prefs-heading" className="mb-6">
        <div
          className="rounded-xl overflow-hidden"
          style={{ border: "1px solid var(--color-border)" }}
        >
          <button
            type="button"
            onClick={() => setShowTypeConfig((o) => !o)}
            className="w-full flex items-center justify-between px-5 py-4 text-left"
            style={{ backgroundColor: "var(--color-surface-soft)", color: "var(--color-primary)" }}
            aria-expanded={showTypeConfig}
            aria-controls="type-prefs-panel"
          >
            <span className="font-semibold text-sm" id="type-prefs-heading">
              Suitable Property Types
            </span>
            <span aria-hidden="true">{showTypeConfig ? "▲" : "▼"}</span>
          </button>
          {showTypeConfig && (
            <div id="type-prefs-panel" className="px-5 py-5 bg-white space-y-4">
              <p className="text-xs" style={{ color: "var(--color-text)", opacity: 0.55 }}>
                Set your preference for each property type. Preferred types strengthen a listing&apos;s fit rating; excluded types fail it.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {SUPPORTED_PROPERTY_TYPES.map((type) => (
                  <div key={type} className="flex items-center justify-between gap-3">
                    <label
                      htmlFor={`pref-${type}`}
                      className="text-sm font-medium"
                      style={{ color: "var(--color-text)" }}
                    >
                      {type}
                    </label>
                    <select
                      id={`pref-${type}`}
                      value={typePrefs[type] ?? ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setTypePrefs((prev) => {
                          const next = { ...prev };
                          if (!val) {
                            delete next[type];
                          } else {
                            next[type] = val as "preferred" | "acceptable" | "excluded";
                          }
                          return next;
                        });
                      }}
                      style={{ ...fieldStyle, width: "auto", minWidth: "9rem" }}
                    >
                      <option value="">Not configured</option>
                      <option value="preferred">Preferred</option>
                      <option value="acceptable">Acceptable</option>
                      <option value="excluded">Excluded</option>
                    </select>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleSavePreferences}
                  disabled={prefsSaving}
                  className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                  style={{ backgroundColor: "var(--color-action)" }}
                >
                  {prefsSaving ? "Saving…" : "Save Preferences"}
                </button>
                {prefsMsg && (
                  <span
                    className="text-xs"
                    style={{ color: prefsMsg.includes("Could not") ? "#B91C1C" : "var(--color-secondary)" }}
                    aria-live="polite"
                  >
                    {prefsMsg}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Saved Leads Panel ────────────────────────────────────────── */}
      <SavedLeadsPanel leads={savedLeads} projectId={projectId} />

      {/* ── Filter form ──────────────────────────────────────────────── */}
      <section aria-labelledby="search-filters-heading" className="mb-8">
        <div
          className="rounded-xl p-5"
          style={{
            backgroundColor: "var(--color-surface-soft)",
            border: "1px solid var(--color-border)",
          }}
        >
          <h2
            id="search-filters-heading"
            className="text-sm font-semibold mb-4"
            style={{ color: "var(--color-primary)" }}
          >
            Search criteria
            {submitted && (
              <span className="ml-2 text-xs font-normal" style={{ color: "var(--color-secondary)" }}>
                (search active)
              </span>
            )}
          </h2>

          <form
            role="search"
            aria-label="Property search filters"
            onSubmit={(e) => { e.preventDefault(); handleSearch(); }}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              {/* City */}
              <div>
                <label htmlFor="city" style={labelStyle}>City</label>
                <input
                  type="text"
                  id="city"
                  name="city"
                  placeholder="e.g. Atlanta"
                  value={city}
                  onChange={(e) => handleFieldChange(setCity, "city", e.target.value)}
                  style={fieldStyle}
                />
              </div>

              {/* State */}
              <div>
                <label htmlFor="state" style={labelStyle}>State</label>
                <input
                  type="text"
                  id="state"
                  name="state"
                  placeholder="e.g. GA"
                  maxLength={2}
                  value={state}
                  onChange={(e) => handleFieldChange(setState, "state", e.target.value.toUpperCase())}
                  style={fieldStyle}
                />
              </div>

              {/* ZIP */}
              <div>
                <label htmlFor="zip" style={labelStyle}>ZIP code</label>
                <input
                  type="text"
                  id="zip"
                  name="zip"
                  placeholder="e.g. 30301"
                  value={zipCode}
                  onChange={(e) => handleFieldChange(setZipCode, "zipCode", e.target.value)}
                  style={fieldStyle}
                />
              </div>

              {/* Property type */}
              <div>
                <label htmlFor="property-type" style={labelStyle}>Property type</label>
                <select
                  id="property-type"
                  name="property-type"
                  value={propertyType}
                  onChange={(e) => handleFieldChange(setPropertyType, "propertyType", e.target.value)}
                  style={fieldStyle}
                >
                  {PROPERTY_TYPES.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              {/* Min bedrooms */}
              <div>
                <label htmlFor="min-bedrooms" style={labelStyle}>Minimum bedrooms</label>
                <select
                  id="min-bedrooms"
                  name="min-bedrooms"
                  value={minBedrooms}
                  onChange={(e) => handleFieldChange(setMinBedrooms, "minBedrooms", e.target.value)}
                  style={fieldStyle}
                >
                  {BEDROOM_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              {/* Min bathrooms */}
              <div>
                <label htmlFor="min-bathrooms" style={labelStyle}>Minimum bathrooms</label>
                <select
                  id="min-bathrooms"
                  name="min-bathrooms"
                  value={minBathrooms}
                  onChange={(e) => handleFieldChange(setMinBathrooms, "minBathrooms", e.target.value)}
                  style={fieldStyle}
                >
                  {BATHROOM_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              {/* Max rent */}
              <div>
                <label htmlFor="max-rent" style={labelStyle}>Max monthly lease amount ($)</label>
                <input
                  type="number"
                  id="max-rent"
                  name="max-rent"
                  min={0}
                  step={50}
                  placeholder="No limit"
                  value={maxRent}
                  onChange={(e) => handleFieldChange(setMaxRent, "maxRent", e.target.value)}
                  style={fieldStyle}
                />
              </div>

              {/* Listing age */}
              <div>
                <label htmlFor="max-days" style={labelStyle}>Max days listed</label>
                <input
                  type="number"
                  id="max-days"
                  name="max-days"
                  min={0}
                  placeholder="Any"
                  value={maxDaysListed}
                  onChange={(e) => handleFieldChange(setMaxDaysListed, "maxDaysListed", e.target.value)}
                  style={fieldStyle}
                />
              </div>

              {/* Listing status */}
              <div className="sm:col-span-2">
                <label htmlFor="listing-status" style={labelStyle}>Listing status</label>
                <select
                  id="listing-status"
                  name="listing-status"
                  value={listingStatus}
                  onChange={(e) => handleFieldChange(setListingStatus, "listingStatus", e.target.value)}
                  style={{ ...fieldStyle, maxWidth: "18rem" }}
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Action row */}
            <div className="flex flex-wrap items-center gap-3">
              {/* PRIMARY — Search Properties */}
              <button
                type="submit"
                disabled={isSearching || isPending || !rentCastConfigured}
                className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: "var(--color-action)" }}
              >
                {isSearching ? "Searching…" : "Search Properties"}
                <span aria-hidden="true">→</span>
              </button>

              {/* SECONDARY — Reset */}
              {!showResetConfirm ? (
                <button
                  type="button"
                  onClick={handleResetRequest}
                  disabled={isPending || (!hasActiveFilters && !submitted)}
                  className="text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text)",
                    backgroundColor: "#fff",
                  }}
                >
                  Reset &amp; clear saved search
                </button>
              ) : (
                <div
                  className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm"
                  style={{
                    border: "1px solid var(--color-border)",
                    backgroundColor: "#FEF2F2",
                  }}
                >
                  <span style={{ color: "#991B1B" }}>Clear all saved search data?</span>
                  <button
                    type="button"
                    onClick={doReset}
                    className="font-semibold text-sm px-3 py-1 rounded"
                    style={{ backgroundColor: "#991B1B", color: "#fff" }}
                  >
                    Confirm Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowResetConfirm(false)}
                    className="font-medium text-sm px-3 py-1 rounded"
                    style={{ border: "1px solid var(--color-border)", backgroundColor: "#fff" }}
                  >
                    Cancel
                  </button>
                </div>
              )}

              {submitted && !isSearching && (
                <span className="text-xs" style={{ color: "var(--color-secondary)" }}>
                  {results.length} result{results.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </form>
        </div>
      </section>

      {/* ── Manual property lead form ────────────────────────────────── */}
      <ManualLeadForm projectId={projectId} />

      {/* ── Results ──────────────────────────────────────────────────── */}
      {submitted ? (
        <PropertyResultsLayout
          listings={visibleRawListings}
          savedLeadIds={savedLeadIds}
          selectedId={selectedId}
          onSelectListing={setSelectedId}
          onSearchThisArea={handleSearchThisArea}
          initialCenter={mapCenter}
          initialRadius={mapRadius}
          isSearching={isSearching || isAreaSearching}
          classifiedById={classifiedById}
          listContent={
            <section aria-labelledby="results-heading">
              <h2
                id="results-heading"
                className="text-base font-semibold mb-4"
                style={{ color: "var(--color-primary)" }}
              >
                {isSearching || isAreaSearching
                  ? "Searching…"
                  : results.length === 0
                  ? "No properties found"
                  : `Results — ${results.length} propert${results.length === 1 ? "y" : "ies"}`}
              </h2>

              {/* Tab bar */}
              {results.length > 0 && !isSearching && !isAreaSearching && (
                <div
                  role="tablist"
                  aria-label="Filter results by fit"
                  className="flex flex-wrap gap-1 mb-4"
                >
                  {(["all", "strong_fit", "review_needed", "does_not_meet", "saved"] as const).map((tab) => {
                    const labels = {
                      all: "All",
                      strong_fit: "Strong Fit",
                      review_needed: "Review Needed",
                      does_not_meet: "Does Not Meet",
                      saved: "Saved",
                    };
                    const count = counts[tab];
                    const isActive = activeTab === tab;
                    return (
                      <button
                        key={tab}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => setActiveTab(tab)}
                        className="text-xs font-semibold px-3 py-1.5 rounded-full"
                        style={{
                          backgroundColor: isActive ? "var(--color-primary)" : "var(--color-surface-soft)",
                          color: isActive ? "#fff" : "var(--color-text)",
                          border: "1px solid var(--color-border)",
                        }}
                      >
                        {labels[tab]} ({count})
                      </button>
                    );
                  })}
                </div>
              )}

              {searchError && (
                <div
                  className="rounded-xl px-5 py-4 mb-4 text-sm"
                  style={{
                    backgroundColor: "#FEF2F2",
                    border: "1px solid #FECACA",
                    color: "#991B1B",
                  }}
                  role="alert"
                >
                  {searchError}
                </div>
              )}

              {!isSearching && !isAreaSearching && results.length === 0 && !searchError && (
                <div
                  className="rounded-xl px-6 py-10 text-center"
                  style={{
                    backgroundColor: "var(--color-surface-soft)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  <p className="text-sm mb-2" style={{ color: "var(--color-text)", opacity: 0.65 }}>
                    No properties matched your criteria. Try broadening your search.
                  </p>
                </div>
              )}

              {!isSearching && !isAreaSearching && results.length > 0 && (
                <ul className="space-y-4" aria-label="Property search results">
                  {visibleRawListings.map((listing) => (
                    <ListingCard
                      key={listing.id || listing.formattedAddress}
                      listing={listing}
                      projectId={projectId}
                      isSelected={selectedId === listing.id}
                      onSelect={() => setSelectedId(prev => prev === listing.id ? null : listing.id)}
                      savedLeadIds={savedLeadIds}
                      classification={classifiedById[listing.id]}
                      onSaved={(leadId) => {
                        // Add to savedLeads immediately so the ★ appears without a reload.
                        setSavedLeads(prev => {
                          const extId = listing.id ?? "";
                          if (prev.some(l => (l.externalId ?? l.id) === extId)) return prev;
                          const stub: PropertyLeadView = {
                            id: leadId,
                            externalId: extId,
                            address: listing.formattedAddress || listing.addressLine1 || "",
                            source: "rentcast",
                            sourceUrl: null,
                            acquisitionStage: "researching",
                            qualificationStatus: "pending",
                            qualificationReason: null,
                            followUpDate: null,
                            notes: null,
                            ownerId: null,
                            projectId,
                            city: listing.city ?? null,
                            state: listing.state ?? null,
                            zip: listing.zipCode ?? null,
                            propertyType: listing.propertyType ?? null,
                            bedrooms: listing.bedrooms ?? null,
                            bathrooms: listing.bathrooms != null ? String(listing.bathrooms) : null,
                            monthlyRent: listing.price != null ? String(listing.price) : null,
                            listingStatus: listing.status || "Active",
                            listingDate: listing.listingDate ?? null,
                            lastSeenDate: listing.lastSeenDate ?? null,
                            daysOnMarket: listing.daysOnMarket ?? null,
                            listingContact: listing.listedBy ?? null,
                            listingPhone: listing.listedByPhone ?? null,
                            listingEmail: listing.listedByEmail ?? null,
                            opportunityScore: null,
                            opportunitySignals: null,
                          };
                          return [...prev, stub];
                        });
                      }}
                    />
                  ))}
                </ul>
              )}
            </section>
          }
        />
      ) : (
        /* Pre-search prompt */
        <div
          className="rounded-xl px-6 py-10 text-center"
          style={{
            backgroundColor: "var(--color-surface-soft)",
            border: "1px solid var(--color-border)",
          }}
        >
          <p className="text-sm font-medium" style={{ color: "var(--color-text)", opacity: 0.7 }}>
            Set your search criteria above and press{" "}
            <strong>Search Properties</strong> to find rental listings.
          </p>
        </div>
      )}
    </div>
  );
}
