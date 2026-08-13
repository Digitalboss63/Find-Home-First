import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { requireOrganization } from "@/lib/auth";
import { getProjectById } from "@/lib/repository";
import { listReferralPartners } from "@/lib/repository-referrals";
import ReferralFinderClient from "./ReferralFinderClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Referral Partner Finder" };

export default async function ReferralFinderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { organizationId } = await requireOrganization();
  const db = getDb();
  if (!db) notFound();
  const project = await getProjectById(id, organizationId);
  if (!project) notFound();
  const candidates = await listReferralPartners(db, organizationId, id);

  return <div style={{ maxWidth: "58rem", margin: "0 auto", padding: "2rem 1.5rem" }}>
    <Link href={`/projects/${id}`} style={{ color: "var(--color-action)", textDecoration: "none", fontSize: "0.85rem" }}>← Back to Project</Link>
    <header style={{ margin: "1.2rem 0" }}>
      <p style={{ textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "0.72rem", fontWeight: 700, opacity: 0.6, margin: 0 }}>Placement · {project.community}</p>
      <h1 style={{ color: "var(--color-primary)", margin: "0.25rem 0", fontSize: "1.6rem" }}>Caseworker &amp; Referral Partner Finder</h1>
      <p style={{ margin: 0, fontSize: "0.9rem", opacity: 0.7 }}>Find and verify the teams that can refer qualified residents into this project&apos;s housing.</p>
    </header>
    <ReferralFinderClient
      projectId={id}
      candidates={candidates}
      projectStatus={project.currentStatus}
      community={project.community}
    />
  </div>;
}
