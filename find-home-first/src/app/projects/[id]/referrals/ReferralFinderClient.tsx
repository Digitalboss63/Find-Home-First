"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ReferralPartnerView } from "@/lib/repository-referrals";
import {
  addQualifiedPartnerToContactsAction,
  generateReferralPartnersAction,
  saveReferralPartnerAction,
  startReferralOutreachAction,
} from "./actions";

type Tab = "recommended" | "review" | "excluded" | "all";

const badge: Record<string, { label: string; bg: string; color: string }> = {
  qualified: { label: "Qualified referral source", bg: "#DCFCE7", color: "#166534" },
  review_needed: { label: "Needs verification", bg: "#FEF3C7", color: "#92400E" },
  excluded: { label: "Excluded", bg: "#FEE2E2", color: "#991B1B" },
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={{ display: "grid", gap: "0.3rem", fontSize: "0.78rem", fontWeight: 600, color: "var(--color-primary)" }}>
    {label}{children}
  </label>;
}
function CandidateCard({ projectId, candidate }: { projectId: string; candidate: ReferralPartnerView }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [contactName, setContactName] = useState(candidate.contactName ?? "");
  const [roleTitle, setRoleTitle] = useState(candidate.roleTitle ?? "");
  const [email, setEmail] = useState(candidate.email ?? "");
  const [phone, setPhone] = useState(candidate.phone ?? "");
  const [verification, setVerification] = useState(candidate.verificationStatus);
  const [capacity, setCapacity] = useState(candidate.referralCapacityStatus);
  const [operatorStatus, setOperatorStatus] = useState(candidate.operatesCompetingHousing === null ? "unknown" : String(candidate.operatesCompetingHousing));
  const [outreach, setOutreach] = useState(candidate.outreachStatus);
  const [notes, setNotes] = useState(candidate.notes ?? "");
  const appearance = badge[candidate.eligibilityStatus] ?? badge.review_needed;

  function save() {
    setMessage(null);
    startTransition(async () => {
      const result = await saveReferralPartnerAction({
        projectId,
        candidateId: candidate.id,
        contactName,
        roleTitle,
        email,
        phone,
        verificationStatus: verification,
        referralCapacityStatus: capacity,
        operatesCompetingHousing: operatorStatus === "unknown" ? null : operatorStatus === "true",
        outreachStatus: outreach,
        notes,
      });
      setMessage(result.ok ? result.message : result.error);
      if (result.ok) {
        setEditing(false);
        router.refresh();
      }
    });
  }

  function promote() {
    setMessage(null);
    startTransition(async () => {
      const result = await addQualifiedPartnerToContactsAction(projectId, candidate.id);
      setMessage(result.ok ? result.message : result.error);
      if (result.ok) router.refresh();
    });
  }

  return <article style={{ border: "1px solid var(--color-border)", borderRadius: "0.8rem", padding: "1rem", background: "#fff" }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
      <div>
        <h3 style={{ margin: 0, color: "var(--color-primary)", fontSize: "1rem" }}>{candidate.organizationName}</h3>
        <p style={{ margin: "0.2rem 0 0", fontSize: "0.84rem", opacity: 0.72 }}>{candidate.programName} · {candidate.serviceArea}</p>
      </div>
      <span style={{ alignSelf: "flex-start", borderRadius: "999px", padding: "0.3rem 0.65rem", fontSize: "0.72rem", fontWeight: 700, background: appearance.bg, color: appearance.color }}>
        {appearance.label}
      </span>
    </div>

    <p style={{ margin: "0.8rem 0", fontSize: "0.84rem", lineHeight: 1.5 }}>{candidate.eligibilityReason}</p>
    <dl style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(12rem, 1fr))", gap: "0.55rem 1rem", fontSize: "0.8rem", margin: "0 0 0.8rem" }}>
      <div><dt style={{ fontWeight: 700 }}>Population</dt><dd style={{ margin: "0.15rem 0 0" }}>{candidate.populationServed ?? "Confirm locally"}</dd></div>
      <div><dt style={{ fontWeight: 700 }}>Referral process</dt><dd style={{ margin: "0.15rem 0 0" }}>{candidate.referralProcess ?? "Confirm locally"}</dd></div>
      <div><dt style={{ fontWeight: 700 }}>Contact</dt><dd style={{ margin: "0.15rem 0 0" }}>{candidate.contactName || "No public individual listed — contact program intake"}</dd></div>
      <div><dt style={{ fontWeight: 700 }}>Outreach</dt><dd style={{ margin: "0.15rem 0 0", textTransform: "capitalize" }}>{candidate.outreachStatus.replaceAll("_", " ")}</dd></div>
    </dl>

    <p style={{ margin: "0.6rem 0", fontSize: "0.75rem", color: "var(--color-text)", opacity: 0.75 }}>
      Source checked {candidate.sourceDate}: <a href={candidate.sourceUrl} target="_blank" rel="noreferrer" style={{ color: "var(--color-action)" }}>{candidate.sourceAgency} ↗</a>
    </p>

    {editing && <div style={{ borderTop: "1px solid var(--color-border)", marginTop: "0.8rem", paddingTop: "0.9rem", display: "grid", gap: "0.75rem" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(11rem, 1fr))", gap: "0.65rem" }}>
        <Field label="Caseworker / intake contact"><input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Only enter a verified name" /></Field>
        <Field label="Role"><input value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} placeholder="Case manager, intake coordinator…" /></Field>
        <Field label="Email"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Phone"><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
        <Field label="Source verification"><select value={verification} onChange={(e) => setVerification(e.target.value)}><option value="official_source">Official source found</option><option value="needs_verification">Needs verification</option><option value="confirmed">Contact confirmed</option></select></Field>
        <Field label="External referrals"><select value={capacity} onChange={(e) => setCapacity(e.target.value)}><option value="needs_confirmation">Needs confirmation</option><option value="confirmed_external">Confirmed — refers externally</option><option value="no_external_referrals">No outside referrals</option></select></Field>
        <Field label="Competing housing operator"><select value={operatorStatus} onChange={(e) => setOperatorStatus(e.target.value)}><option value="unknown">Unknown</option><option value="false">No</option><option value="true">Yes — exclude</option></select></Field>
        <Field label="Outreach status"><select value={outreach} onChange={(e) => setOutreach(e.target.value)}><option value="not_contacted">Not contacted</option><option value="contacted">Contacted</option><option value="confirmed">Confirmed relationship</option><option value="not_a_fit">Not a fit</option></select></Field>
      </div>
      <Field label="Notes"><textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Eligibility, intake steps, current capacity, follow-up…" /></Field>
      <div style={{ display: "flex", gap: "0.6rem" }}>
        <button type="button" onClick={save} disabled={pending} style={{ background: "var(--color-action)", color: "#fff", border: 0, borderRadius: "0.45rem", padding: "0.55rem 0.9rem", fontWeight: 700 }}>{pending ? "Saving…" : "Save verification"}</button>
        <button type="button" onClick={() => setEditing(false)} disabled={pending}>Cancel</button>
      </div>
    </div>}

    {!editing && <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
      <button type="button" onClick={() => setEditing(true)}>Verify / update</button>
      {candidate.eligibilityStatus === "qualified" && <button type="button" onClick={promote} disabled={pending || !!candidate.promotedContactId} style={{ background: candidate.promotedContactId ? "#DCFCE7" : "var(--color-primary)", color: candidate.promotedContactId ? "#166534" : "#fff", border: 0, borderRadius: "0.45rem", padding: "0.5rem 0.8rem", fontWeight: 700 }}>
        {candidate.promotedContactId ? "✓ In People & Contacts" : "Add to People & Contacts"}
      </button>}
    </div>}
    {message && <p role="status" style={{ fontSize: "0.8rem", margin: "0.7rem 0 0", fontWeight: 600 }}>{message}</p>}
  </article>;
}

export default function ReferralFinderClient({ projectId, candidates, projectStatus }: { projectId: string; candidates: ReferralPartnerView[]; projectStatus: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("recommended");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const visible = candidates.filter((candidate) => {
    if (tab === "recommended") return candidate.eligibilityStatus === "qualified";
    if (tab === "review") return candidate.eligibilityStatus === "review_needed";
    if (tab === "excluded") return candidate.eligibilityStatus === "excluded";
    return true;
  });

  function run(action: () => Promise<{ ok: boolean; message?: string; error?: string }>) {
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      setMessage(result.ok ? result.message ?? "Done." : result.error ?? "Action failed.");
      if (result.ok) router.refresh();
    });
  }

  const counts = {
    recommended: candidates.filter((c) => c.eligibilityStatus === "qualified").length,
    review: candidates.filter((c) => c.eligibilityStatus === "review_needed").length,
    excluded: candidates.filter((c) => c.eligibilityStatus === "excluded").length,
    all: candidates.length,
  };

  return <>
    <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: "0.75rem", padding: "1rem", marginBottom: "1rem" }}>
      <strong style={{ color: "#1E3A8A" }}>What this list means</strong>
      <p style={{ margin: "0.35rem 0 0", fontSize: "0.84rem", lineHeight: 1.5, color: "#1E3A8A" }}>
        We are looking for caseworkers and intake teams that can send qualified residents to Find Home First. An organization is not approved merely because it is a nonprofit. Competing housing operators and sources that do not refer externally are excluded.
      </p>
    </div>

    <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginBottom: "1rem" }}>
      <button type="button" onClick={() => run(() => generateReferralPartnersAction(projectId))} disabled={pending} style={{ background: "var(--color-action)", color: "#fff", border: 0, borderRadius: "0.5rem", padding: "0.65rem 1rem", fontWeight: 700 }}>
        {pending ? "Working…" : candidates.length ? "Update from City Report" : "Build Referral List"}
      </button>
      {(projectStatus === "preparing_property" || projectStatus === "seeking_referrals") && candidates.length > 0 && <button type="button" onClick={() => run(() => startReferralOutreachAction(projectId))} disabled={pending}>
        {projectStatus === "seeking_referrals" ? "✓ Referral outreach active" : "Start referral outreach"}
      </button>}
    </div>
    {message && <p role="status" style={{ fontSize: "0.84rem", fontWeight: 700 }}>{message}</p>}

    {candidates.length > 0 && <nav aria-label="Referral list filters" style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", borderBottom: "1px solid var(--color-border)", paddingBottom: "0.7rem", marginBottom: "1rem" }}>
      {(["recommended", "review", "excluded", "all"] as Tab[]).map((item) => <button key={item} type="button" aria-pressed={tab === item} onClick={() => setTab(item)} style={{ borderRadius: "999px", padding: "0.45rem 0.75rem", fontWeight: 700, background: tab === item ? "var(--color-primary)" : "#fff", color: tab === item ? "#fff" : "var(--color-primary)" }}>
        {item === "recommended" ? "Qualified" : item === "review" ? "Needs verification" : item === "excluded" ? "Excluded" : "All"} ({counts[item]})
      </button>)}
    </nav>}

    {candidates.length === 0 ? <div style={{ border: "1px dashed var(--color-border)", borderRadius: "0.75rem", padding: "2rem", textAlign: "center" }}>
      <h2 style={{ fontSize: "1rem", margin: "0 0 0.4rem", color: "var(--color-primary)" }}>No referral list yet</h2>
      <p style={{ margin: 0, fontSize: "0.84rem", opacity: 0.7 }}>Build the list from the project&apos;s completed City Report. This uses saved report data and official program links—no paid search request.</p>
    </div> : visible.length === 0 ? <p style={{ fontSize: "0.85rem", opacity: 0.7 }}>No sources in this category yet.</p> : <div style={{ display: "grid", gap: "0.9rem" }}>
      {visible.map((candidate) => <CandidateCard key={candidate.id} projectId={projectId} candidate={candidate} />)}
    </div>}
  </>;
}
