import type { Metadata } from "next";
import { requirePlatformOwner } from "@/lib/auth";

export const metadata: Metadata = { title: "Back Office — Organizations" };

export default async function BackOfficeOrganizationsPage() {
  await requirePlatformOwner();
  return (
    <div className="max-w-3xl mx-auto px-6 py-8 lg:px-10">
      <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--color-primary)" }}>
        Organizations
      </h1>
      <p className="text-sm" style={{ color: "var(--color-text)", opacity: 0.6 }}>
        Coming soon — this section is reserved for platform management.
      </p>
    </div>
  );
}