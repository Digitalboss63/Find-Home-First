/**
 * /housing-search — Housing Search
 *
 * Structure only. Visual design is REPLIT-UI ownership.
 *
 * Required content per GUIDED_WORKSPACE_UI_SPEC.md:
 * - Filter fields: community, bedrooms, max rent, available-by date
 * - Results list: address, community, bedrooms, rent, available date, landlord, notes
 *
 * Phase 1 note: No submit button is rendered. Filter logic and live search
 * require database and RentCast/Zillow integration (future phases). The fields
 * are present as structural placeholders so REPLIT-UI can design the layout;
 * they will be wired to real filtering in a future phase.
 *
 * Demo data is shown unconditionally as the current result set.
 */
import type { Metadata } from "next";
import { DEMO_PROPERTIES } from "@/demo/data";

export const metadata: Metadata = {
  title: "Housing Search",
  description: "Search for available private housing units.",
};

const COMMUNITIES = ["All Communities", "Eastside", "Northview", "Downtown", "Westpark"];

export default function HousingSearchPage() {
  return (
    <div>
      <h1>Housing Search</h1>
      <p>Find available private units to evaluate for placement.</p>
      <p>
        <em>
          Demonstration data. RentCast adapter and manual Zillow entry are future phases.
        </em>
      </p>

      {/* Filter fields — structural placeholders only, no submit action */}
      <section aria-labelledby="filters-heading">
        <h2 id="filters-heading">Filters</h2>
        <p className="sr-only">
          Filter controls will be activated when search integration is available.
        </p>

        <div>
          <label htmlFor="community">Community</label>
          <select id="community" name="community" disabled aria-disabled="true">
            {COMMUNITIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="bedrooms">Bedrooms</label>
          <select id="bedrooms" name="bedrooms" disabled aria-disabled="true">
            <option value="">Any</option>
            <option value="0">Studio / SRO</option>
            <option value="1">1 Bedroom</option>
            <option value="2">2 Bedrooms</option>
            <option value="3">3+ Bedrooms</option>
          </select>
        </div>

        <div>
          <label htmlFor="max-rent">Max monthly rent ($)</label>
          <input
            type="number"
            id="max-rent"
            name="max-rent"
            min={0}
            step={50}
            placeholder="e.g. 1500"
            disabled
            aria-disabled="true"
          />
        </div>

        <div>
          <label htmlFor="available-by">Available by</label>
          <input
            type="date"
            id="available-by"
            name="available-by"
            disabled
            aria-disabled="true"
          />
        </div>
      </section>

      {/* Results */}
      <section aria-labelledby="results-heading">
        <h2 id="results-heading">
          Results ({DEMO_PROPERTIES.length} units — demonstration data)
        </h2>
        <ul>
          {DEMO_PROPERTIES.map((unit) => (
            <li key={unit.id}>
              <h3>{unit.address}</h3>
              <p>Community: {unit.community}</p>
              <p>
                Bedrooms:{" "}
                {unit.bedrooms === 0 ? "Studio / SRO" : `${unit.bedrooms} BR`}
              </p>
              <p>Monthly rent: ${unit.monthlyRent.toLocaleString()}</p>
              <p>Available: {unit.availableDate}</p>
              <p>Landlord: {unit.landlordContact}</p>
              {unit.notes && <p>Notes: {unit.notes}</p>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
