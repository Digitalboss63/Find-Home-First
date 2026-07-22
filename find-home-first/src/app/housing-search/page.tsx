/**
 * /housing-search — Housing Search
 *
 * Metadata is exported here (server component wrapper).
 * Interactive filtering is in HousingSearchClient.tsx (client component).
 */
import type { Metadata } from "next";
import HousingSearchClient from "./HousingSearchClient";

export const metadata: Metadata = {
  title: "Housing Search",
  description: "Search for available private housing units for placement evaluation.",
};

export default function HousingSearchPage() {
  return <HousingSearchClient />;
}
