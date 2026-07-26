"use client";

import {
  useMemo,
  useState,
  useRef,
  useTransition,
  useCallback,
} from "react";
import type { PropertySearchDraftView } from "@/lib/repository";
import type { RentCastListing, RentCastOwner } from "@/lib/rentcast";
import {
  searchPropertiesAction,
  saveDraftAction,
  clearDraftAction,
  fetchOwnerAction,
  saveLeadAction,
} from "./actions";

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

const STATUS_OPTIONS = [
  { value: "active", label: "Active listings" },
  { value: "inactive", label: "Inactive / previously listed" },
  { value: "", label: "Active or inactive" },
];

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

// ─── Owner panel ──────────────────────────────────────────────────────────────

function OwnerPanel({
  propertyId,
}: {
  propertyId: string;
}) {
  const [owner, setOwner] = useState<RentCastOwner | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetched, setFetched] = useState(false);

  async function loadOwner() {
    setLoading(true);
    setError(null);
    const result = await fetchOwnerAction(propertyId);
    setLoading(false);
    setFetched(true);
    if (result.unconfigured) {
      setError("Owner lookup is not yet configured.");
    } else if (result.error) {
      setError(result.error);
    } else {
      setOwner(result.owner);
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

  // Compute opportunity indicators — presented as signals, not conclusions
  const indicators: string[] = [];
  if (owner.ownerOccupied === false) indicators.push("Non-owner-occupied");
  if (owner.mailingDiffersFromProperty)
    indicators.push("Mailing address differs from property address");
  if (owner.ownerType === "Individual") indicators.push("Individual owner");

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

      {indicators.length > 0 && (
        <div className="mt-2 pt-2" style={{ borderTop: "1px solid var(--color-border)" }}>
          <p
            className="font-semibold text-xs mb-1"
            style={{ color: "var(--color-secondary)" }}
          >
            Potential Owner Opportunity Indicators
          </p>
          <ul className="space-y-0.5">
            {indicators.map((ind) => (
              <li
                key={ind}
                className="flex items-center gap-1.5"
                style={{ color: "var(--color-text)", opacity: 0.8 }}
              >
                <span aria-hidden="true" style={{ color: "var(--color-secondary)" }}>
                  ●
                </span>
                {ind}
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

// ─── Listing card ─────────────────────────────────────────────────────────────

function ListingCard({ listing }: { listing: RentCastListing }) {
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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
      });
      setSaving(false);
      if (result.duplicate) {
        setSaveMsg("Already saved in your pipeline.");
      } else if (result.ok) {
        setSaveMsg("Saved to your property leads.");
      } else {
        setSaveMsg(result.error ?? "Could not save.");
      }
    });
  }

  const propertyLabel = [
    listing.propertyType,
    listing.bedrooms != null
      ? `${listing.bedrooms} BR`
      : null,
    listing.bathrooms != null ? `${listing.bathrooms} BA` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li
      className="rounded-xl overflow-hidden"
      style={{
        backgroundColor: "#fff",
        border: "1px solid var(--color-border)",
      }}
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

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || isPending}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white disabled:opacity-50"
            style={{ backgroundColor: "var(--color-action)" }}
          >
            {saving ? "Saving…" : "Save Property Lead"}
          </button>
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

        {/* On-demand owner enrichment */}
        {listing.id && (
          <OwnerPanel propertyId={listing.id} />
        )}
      </div>
    </li>
  );
}

// ─── Manual property lead form ────────────────────────────────────────────────

const MANUAL_SOURCES = [
  { value: "zillow", label: "Zillow (manual)" },
  { value: "craigslist", label: "Craigslist" },
  { value: "facebook", label: "Facebook Marketplace" },
  { value: "referral", label: "Referral" },
  { value: "driving", label: "Driving for Dollars" },
  { value: "other", label: "Other" },
];

function ManualLeadForm() {
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
              Add a property lead from Zillow or any source manually.
              Zillow is manual-only — no scraping.
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

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  initialDraft: PropertySearchDraftView;
  savedLeadCount: number;
  rentCastConfigured: boolean;
  isDemoMode: boolean;
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
  rentCastConfigured,
}: Props) {
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
  function handleReset() {
    const hasSomething =
      city || state || zipCode || propertyType || minBedrooms ||
      minBathrooms || maxRent || maxDaysListed || submitted;

    if (hasSomething) {
      const confirmed = window.confirm(
        "Reset will clear your saved search criteria and results. Continue?"
      );
      if (!confirmed) return;
    }

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
              <button
                type="button"
                onClick={handleReset}
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
      <ManualLeadForm />

      {/* ── Results ──────────────────────────────────────────────────── */}
      {submitted ? (
        <section aria-labelledby="results-heading">
          <h2
            id="results-heading"
            className="text-base font-semibold mb-4"
            style={{ color: "var(--color-primary)" }}
          >
            {isSearching
              ? "Searching…"
              : results.length === 0
              ? "No properties found"
              : `Results — ${results.length} propert${results.length === 1 ? "y" : "ies"}`}
          </h2>

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

          {!isSearching && results.length === 0 && !searchError && (
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

          {!isSearching && results.length > 0 && (
            <ul className="space-y-4" aria-label="Property search results">
              {results.map((listing) => (
                <ListingCard key={listing.id || listing.formattedAddress} listing={listing} />
              ))}
            </ul>
          )}
        </section>
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
