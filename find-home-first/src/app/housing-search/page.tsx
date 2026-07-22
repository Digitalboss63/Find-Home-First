/**
 * /housing-search — Housing Search
 *
 * Server component: fetches property candidates from the repository and
 * passes them to the interactive client component.
 * Falls back to demo data when DATABASE_URL is absent or a query fails.
 */
import type { Metadata } from "next";
import { DEMO_PROPERTIES } from "@/demo/data";
import { listPropertyCandidates } from "@/lib/repository";
import type { PropertyItemView } from "@/lib/types";
import HousingSearchClient from "./HousingSearchClient";

export const metadata: Metadata = {
  title: "Housing Search",
  description:
    "Search for available private housing units for placement evaluation.",
};

export default async function HousingSearchPage() {
  const dbCandidates = await listPropertyCandidates();
  const usingDemo = dbCandidates === null;

  let properties: PropertyItemView[];

  if (usingDemo) {
    // Map demo records to the shared view shape
    properties = DEMO_PROPERTIES.map((p) => ({
      id: p.id,
      address: p.address,
      community: p.community,
      bedrooms: p.bedrooms,
      monthlyRent: p.monthlyRent,
      availableDate: p.availableDate,
      landlordContact: p.landlordContact,
      notes: p.notes,
    }));
  } else {
    // Normalise DB records — only surface active listings
    properties = dbCandidates
      .filter((c) => c.listingStatus === "active")
      .map((c) => ({
        id: c.id,
        address: c.address,
        community: c.community ?? "",
        bedrooms: c.bedrooms ?? 0,
        monthlyRent: c.monthlyRent ? parseFloat(c.monthlyRent) : 0,
        availableDate: c.availableDate ?? "",
        // DB records don't carry a free-text landlord field yet — leave blank
        landlordContact: "",
        notes: "",
      }));
  }

  return <HousingSearchClient properties={properties} usingDemo={usingDemo} />;
}
