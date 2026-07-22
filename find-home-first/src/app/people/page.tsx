/**
 * /people — People & Contacts
 *
 * Section 1: Referral Contacts — partner organisation contacts
 * Section 2: Prospective Residents — individuals being considered for placement
 *
 * Data source: PostgreSQL via repository when DATABASE_URL is set,
 * otherwise falls back to src/demo/data.ts.
 */
import type { Metadata } from "next";
import {
  DEMO_PROSPECTIVE_RESIDENTS,
  DEMO_REFERRAL_CONTACTS,
} from "@/demo/data";
import { listContacts, listResidents } from "@/lib/repository";
import type { ContactView, ResidentView } from "@/lib/repository";
import DemoNotice from "@/components/DemoNotice";

export const metadata: Metadata = {
  title: "People & Contacts",
  description: "Referral contacts and prospective residents.",
};

// ── Normalised row shapes used by this page ───────────────────────────────────

interface ContactRow {
  id: string;
  name: string;
  organizationName: string | null;
  roleTitle: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
}

interface ResidentRow {
  id: string;
  name: string;
  referredBy: string;
  householdSize: number;
  bedroomsNeeded: number;
  accessibilityNeeds: string;
  incomeRange: string;
  notes: string;
  status: string;
}

// ── Demo adapters ─────────────────────────────────────────────────────────────

function demoContactRows(): ContactRow[] {
  return DEMO_REFERRAL_CONTACTS.map((c) => ({
    id: c.id,
    name: c.name,
    organizationName: c.organization,
    roleTitle: c.role,
    email: c.email,
    phone: c.phone,
    notes: c.notes,
  }));
}

function demoResidentRows(): ResidentRow[] {
  return DEMO_PROSPECTIVE_RESIDENTS.map((r) => ({
    id: r.id,
    name: r.name,
    referredBy: r.referredBy,
    householdSize: r.householdSize,
    bedroomsNeeded: r.bedroomsNeeded,
    accessibilityNeeds: r.accessibilityNeeds,
    incomeRange: r.incomeRange,
    notes: r.notes,
    status: r.status,
  }));
}

function dbContactRows(rows: ContactView[]): ContactRow[] {
  // Show only referral-type contacts in this section
  return rows
    .filter((c) => c.contactType === "referral")
    .map((c) => ({
      id: c.id,
      name: c.name,
      organizationName: c.organizationName,
      roleTitle: c.roleTitle,
      email: c.email,
      phone: c.phone,
      notes: c.notes,
    }));
}

function dbResidentRows(rows: ResidentView[]): ResidentRow[] {
  return rows.map((r) => ({
    id: r.id,
    name: r.displayName,
    referredBy: r.referredByName ?? "—",
    householdSize: r.householdSize,
    bedroomsNeeded: r.bedroomsNeeded,
    accessibilityNeeds: r.accessibilityNeeds ?? "None noted",
    incomeRange: r.incomeRange ?? "—",
    notes: r.notes ?? "",
    status: r.placementStatus,
  }));
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ResidentStatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    pending: { bg: "#FEF9C3", text: "#854D0E", label: "Pending" },
    active: {
      bg: "var(--color-surface-soft)",
      text: "var(--color-secondary)",
      label: "Active",
    },
    placed: { bg: "#DCFCE7", text: "#166534", label: "Placed" },
    inactive: {
      bg: "#F3F4F6",
      text: "#6B7280",
      label: "Inactive",
    },
  };
  const s = map[status] ?? map.pending;
  return (
    <span
      className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{ backgroundColor: s.bg, color: s.text }}
    >
      {s.label}
    </span>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function PeoplePage() {
  const [dbContacts, dbResidents] = await Promise.all([
    listContacts(),
    listResidents(),
  ]);

  const usingDemo = dbContacts === null || dbResidents === null;

  const contactRows: ContactRow[] = usingDemo
    ? demoContactRows()
    : dbContactRows(dbContacts);

  const residentRows: ResidentRow[] = usingDemo
    ? demoResidentRows()
    : dbResidentRows(dbResidents);

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 lg:px-10">
      <div className="mb-8">
        {usingDemo && <DemoNotice />}
        <h1
          className="text-2xl font-bold"
          style={{ color: "var(--color-primary)" }}
        >
          People &amp; Contacts
        </h1>
      </div>

      {/* ── Referral Contacts ─────────────────────────────────────── */}
      <section aria-labelledby="referral-heading" className="mb-12">
        <h2
          id="referral-heading"
          className="text-sm font-semibold uppercase tracking-widest mb-4"
          style={{ color: "var(--color-text)", opacity: 0.75 }}
        >
          Referral Contacts ({contactRows.length})
        </h2>

        {contactRows.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--color-text)", opacity: 0.6 }}>
            No referral contacts yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {contactRows.map((contact) => (
              <li
                key={contact.id}
                className="rounded-xl px-5 py-4"
                style={{
                  backgroundColor: "#fff",
                  border: "1px solid var(--color-border)",
                }}
              >
                <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                  <div>
                    <h3
                      className="font-semibold text-sm"
                      style={{ color: "var(--color-primary)" }}
                    >
                      {contact.name}
                    </h3>
                    {(contact.roleTitle || contact.organizationName) && (
                      <p
                        className="text-xs mt-0.5"
                        style={{ color: "var(--color-text)", opacity: 0.6 }}
                      >
                        {[contact.roleTitle, contact.organizationName]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                  </div>
                </div>

                <div
                  className="flex flex-wrap gap-x-6 gap-y-1 text-sm mt-2"
                  style={{ color: "var(--color-text)", opacity: 0.75 }}
                >
                  {contact.email && (
                    <div>
                      <a
                        href={`mailto:${contact.email}`}
                        className="font-medium transition-opacity hover:opacity-70"
                        style={{ color: "var(--color-secondary)" }}
                      >
                        {contact.email}
                      </a>
                    </div>
                  )}
                  {contact.phone && <div>{contact.phone}</div>}
                </div>

                {contact.notes && (
                  <p
                    className="mt-2.5 text-xs leading-relaxed"
                    style={{ color: "var(--color-text)", opacity: 0.6 }}
                  >
                    {contact.notes}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Prospective Residents ────────────────────────────────── */}
      <section aria-labelledby="residents-heading">
        <h2
          id="residents-heading"
          className="text-sm font-semibold uppercase tracking-widest mb-4"
          style={{ color: "var(--color-text)", opacity: 0.75 }}
        >
          Prospective Residents ({residentRows.length})
        </h2>

        {residentRows.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--color-text)", opacity: 0.6 }}>
            No prospective residents yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {residentRows.map((resident) => {
              const bedsLabel =
                resident.bedroomsNeeded === 0
                  ? "Studio / SRO"
                  : `${resident.bedroomsNeeded} BR`;
              const householdLabel = `${resident.householdSize} ${
                resident.householdSize === 1 ? "person" : "people"
              }`;

              return (
                <li
                  key={resident.id}
                  className="rounded-xl px-5 py-4"
                  style={{
                    backgroundColor: "#fff",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                    <h3
                      className="font-semibold text-sm"
                      style={{ color: "var(--color-primary)" }}
                    >
                      {resident.name}
                    </h3>
                    <ResidentStatusBadge status={resident.status} />
                  </div>

                  <div
                    className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 text-xs"
                    style={{ color: "var(--color-text)", opacity: 0.75 }}
                  >
                    <div>
                      <span
                        className="block font-semibold mb-0.5"
                        style={{ opacity: 0.55 }}
                      >
                        Referred by
                      </span>
                      {resident.referredBy}
                    </div>
                    <div>
                      <span
                        className="block font-semibold mb-0.5"
                        style={{ opacity: 0.55 }}
                      >
                        Household
                      </span>
                      {householdLabel}
                    </div>
                    <div>
                      <span
                        className="block font-semibold mb-0.5"
                        style={{ opacity: 0.55 }}
                      >
                        Bedrooms needed
                      </span>
                      {bedsLabel}
                    </div>
                    <div>
                      <span
                        className="block font-semibold mb-0.5"
                        style={{ opacity: 0.55 }}
                      >
                        Income range
                      </span>
                      {resident.incomeRange}
                    </div>
                    <div className="col-span-2">
                      <span
                        className="block font-semibold mb-0.5"
                        style={{ opacity: 0.55 }}
                      >
                        Accessibility needs
                      </span>
                      {resident.accessibilityNeeds}
                    </div>
                  </div>

                  {resident.notes && (
                    <p
                      className="mt-3 text-xs leading-relaxed"
                      style={{ color: "var(--color-text)", opacity: 0.6 }}
                    >
                      {resident.notes}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
