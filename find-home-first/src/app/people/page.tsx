/**
 * /people — People & Contacts
 *
 * Structure only. Visual design is REPLIT-UI ownership.
 *
 * Required content per GUIDED_WORKSPACE_UI_SPEC.md:
 * - Section 1: Referral Contacts — name, org, role, email, phone, notes
 * - Section 2: Prospective Residents — name, referred-by, household, bedrooms,
 *   accessibility needs, income range, status (pending/active/placed), notes
 * - No public portal. Staff and owner only.
 */
import type { Metadata } from "next";
import {
  DEMO_REFERRAL_CONTACTS,
  DEMO_PROSPECTIVE_RESIDENTS,
} from "@/demo/data";

export const metadata: Metadata = {
  title: "People & Contacts",
  description: "Referral contacts and prospective residents.",
};

export default function PeoplePage() {
  return (
    <div>
      <h1>People &amp; Contacts</h1>

      {/* Referral Contacts */}
      <section aria-labelledby="referral-heading">
        <h2 id="referral-heading">
          Referral Contacts ({DEMO_REFERRAL_CONTACTS.length})
        </h2>
        <ul>
          {DEMO_REFERRAL_CONTACTS.map((contact) => (
            <li key={contact.id}>
              <h3>{contact.name}</h3>
              <p>{contact.role} — {contact.organization}</p>
              <p>
                Email:{" "}
                <a href={`mailto:${contact.email}`}>{contact.email}</a>
              </p>
              <p>Phone: {contact.phone}</p>
              {contact.notes && <p>Notes: {contact.notes}</p>}
            </li>
          ))}
        </ul>
      </section>

      {/* Prospective Residents */}
      <section aria-labelledby="residents-heading">
        <h2 id="residents-heading">
          Prospective Residents ({DEMO_PROSPECTIVE_RESIDENTS.length})
        </h2>
        <ul>
          {DEMO_PROSPECTIVE_RESIDENTS.map((resident) => (
            <li key={resident.id}>
              <h3>{resident.name}</h3>
              <p>Status: {resident.status}</p>
              <p>Referred by: {resident.referredBy}</p>
              <p>
                Household: {resident.householdSize}{" "}
                {resident.householdSize === 1 ? "person" : "people"}
              </p>
              <p>
                Bedrooms needed:{" "}
                {resident.bedroomsNeeded === 0
                  ? "Studio / SRO"
                  : `${resident.bedroomsNeeded} BR`}
              </p>
              <p>Accessibility needs: {resident.accessibilityNeeds}</p>
              <p>Income range: {resident.incomeRange}</p>
              {resident.notes && <p>Notes: {resident.notes}</p>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
