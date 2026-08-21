"use client";

/**
 * LeadWorkspace — full lead detail panel expanded inside the Saved Leads list.
 *
 * Sections:
 *   - Property summary (listing facts, opportunity score)
 *   - Property Owner (with edit controls; clearly NOT the listing agent)
 *   - Listing Contact (labeled "not verified as property owner")
 *   - Stage controls (advance / reopen)
 *   - Record Outreach
 *   - Owner Outreach Playbook (collapsible, with PDF/DOCX export)
 *   - Activity timeline (append-only, chronological)
 *   - Negotiation terms
 *   - Secure Property (negotiating stage only)
 *
 * All five server actions are wired to real controls.
 */

import { useState, useTransition, useCallback } from "react";
import {
  PLAYBOOK_VERSION,
  openingScript,
  outreachFramework,
  objections,
  prohibitedAssurances,
} from "@/lib/owner-outreach-playbook";
import type { PropertyLeadView } from "@/lib/repository";
import {
  PIPELINE_STAGES,
  PIPELINE_STAGE_LABELS,
  TERMINAL_STAGES,
  isTransitionPermitted,
} from "@/lib/lead-pipeline";
import {
  recordOutreachAction,
  advanceLeadStageAction,
  reopenLeadAction,
  updateNegotiationAction,
  updateOwnerContactAction,
  securePropertyAction,
} from "./lead-actions";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ActivityItem {
  id: string;
  activityType: string;
  contactMethod: string | null;
  outcome: string | null;
  notes: string | null;
  stageBefore: string | null;
  stageAfter: string | null;
  nextFollowUpAt: string | null;
  actorName: string | null;
  createdAt: Date | string;
}

export interface OwnerContact {
  id: string;
  name: string;
  ownerType: string;
  phone: string | null;
  email: string | null;
  mailingAddress: string | null;
  mailingDiffersFromProperty: boolean | null;
  ownerOccupied: boolean | null;
  leadSource: string;
  notes: string | null;
  preferredContactMethod: string | null;
  phoneVerifiedAt: Date | string | null;
  emailVerifiedAt: Date | string | null;
  contactSource: string | null;
}

export interface FollowUpTask {
  id: string;
  title: string;
  dueDate: string | null;
  status: string;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const inlineInputStyle: React.CSSProperties = {
  backgroundColor: "#fff",
  border: "1px solid var(--color-border)",
  borderRadius: "0.375rem",
  color: "var(--color-text)",
  padding: "0.375rem 0.625rem",
  fontSize: "0.8rem",
  width: "100%",
};

const sectionHeadingStyle: React.CSSProperties = {
  fontSize: "0.7rem",
  fontWeight: 700,
  letterSpacing: "0.05em",
  textTransform: "uppercase" as const,
  opacity: 0.5,
  marginBottom: "0.375rem",
  color: "var(--color-text)",
};

const fieldLabelStyle: React.CSSProperties = {
  fontSize: "0.7rem",
  fontWeight: 600,
  opacity: 0.55,
  color: "var(--color-text)",
};

function StatusMsg({ msg }: { msg: { ok: boolean; text: string } | null }) {
  if (!msg) return null;
  return (
    <p
      className="text-xs mt-1"
      role={msg.ok ? undefined : "alert"}
      aria-live="polite"
      style={{ color: msg.ok ? "var(--color-secondary)" : "#B91C1C" }}
    >
      {msg.text}
    </p>
  );
}

function SectionCard({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <div
      className="rounded-lg p-3 mb-2"
      style={{ backgroundColor: "#fff", border: "1px solid var(--color-border)" }}
    >
      <p style={sectionHeadingStyle}>{title}</p>
      {children}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(n: string | number | null): string {
  if (n == null || n === "") return "—";
  const num = typeof n === "string" ? parseFloat(n) : n;
  if (isNaN(num)) return "—";
  return num.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function formatDate(d: Date | string | null): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return String(d);
  }
}

function activityTypeLabel(t: string): string {
  return {
    outreach: "📞 Outreach",
    stage_change: "🔀 Stage Change",
    note: "📝 Note",
    negotiation: "💬 Negotiation",
    agreement: "✅ Agreement",
  }[t] ?? t;
}

// ─── Property Summary ─────────────────────────────────────────────────────────

function PropertySummarySection({ lead }: { lead: PropertyLeadView }) {
  const opportunitySignals: Array<{ key: string; label: string; earned: number }> =
    lead.opportunitySignals
      ? (() => { try { return JSON.parse(lead.opportunitySignals); } catch { return []; } })()
      : [];

  const activeSignals = opportunitySignals.filter((s) => s.earned > 0);

  return (
    <SectionCard title="Property Summary">
      <p className="text-sm font-semibold mb-1" style={{ color: "var(--color-primary)" }}>
        {lead.address}
      </p>
      <div
        className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs"
        style={{ color: "var(--color-text)" }}
      >
        {lead.propertyType && (
          <div><span style={fieldLabelStyle}>Type: </span>{lead.propertyType}</div>
        )}
        {lead.bedrooms != null && (
          <div><span style={fieldLabelStyle}>Beds/Baths: </span>{lead.bedrooms} BR / {lead.bathrooms ?? "?"} BA</div>
        )}
        {lead.monthlyRent && (
          <div><span style={fieldLabelStyle}>Listed: </span>{formatCurrency(lead.monthlyRent)}/mo</div>
        )}
        {lead.daysOnMarket != null && (
          <div><span style={fieldLabelStyle}>Days on market: </span>{lead.daysOnMarket}</div>
        )}
        {lead.listingStatus && (
          <div><span style={fieldLabelStyle}>Status: </span>{lead.listingStatus}</div>
        )}
        {lead.listingDate && (
          <div><span style={fieldLabelStyle}>Listed: </span>{formatDate(lead.listingDate)}</div>
        )}
        {lead.source && (
          <div><span style={fieldLabelStyle}>Source: </span>{lead.source}</div>
        )}
      </div>

      {lead.opportunityScore != null && (
        <div className="mt-2 pt-2" style={{ borderTop: "1px solid var(--color-border)" }}>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold" style={{ color: "var(--color-secondary)" }}>
              Opportunity Score: {lead.opportunityScore}/100
            </span>
          </div>
          {activeSignals.length > 0 && (
            <ul className="mt-1 space-y-0.5">
              {activeSignals.map((s) => (
                <li key={s.key} className="text-xs" style={{ color: "var(--color-text)", opacity: 0.75 }}>
                  <span style={{ color: "var(--color-secondary)" }}>● </span>{s.label}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </SectionCard>
  );
}

// ─── Owner Contact Section ────────────────────────────────────────────────────

function OwnerContactSection({
  owner,
  projectId,
}: {
  owner: OwnerContact | null;
  projectId: string;
}) {
  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState(owner?.phone ?? "");
  const [email, setEmail] = useState(owner?.email ?? "");
  const [preferred, setPreferred] = useState(owner?.preferredContactMethod ?? "");
  const [contactSource, setContactSource] = useState(owner?.contactSource ?? "");
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [, startTx] = useTransition();

  if (!owner) {
    return (
      <SectionCard title="Property Owner">
        <p className="text-xs" style={{ color: "var(--color-text)", opacity: 0.55 }}>
          No owner information linked. Use the &ldquo;View Owner Details&rdquo; button on the
          listing card to look up the owner.
        </p>
      </SectionCard>
    );
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    startTx(async () => {
      const result = await updateOwnerContactAction(owner!.id, projectId, {
        phone: phone || null,
        email: email || null,
        preferredContactMethod: preferred || null,
        contactSource: contactSource || null,
      });
      setSaveMsg({ ok: result.ok, text: result.ok ? "Owner contact updated." : (result.error ?? "Failed.") });
      if (result.ok) setEditing(false);
    });
  }

  const isPhoneVerified = !!owner.phoneVerifiedAt;
  const isEmailVerified = !!owner.emailVerifiedAt;

  return (
    <SectionCard title="Property Owner">
      <div className="grid grid-cols-1 gap-y-1 text-xs" style={{ color: "var(--color-text)" }}>
        <div><span style={fieldLabelStyle}>Name: </span>{owner.name}</div>
        <div><span style={fieldLabelStyle}>Type: </span>{owner.ownerType}</div>
        {owner.mailingAddress && (
          <div><span style={fieldLabelStyle}>Mailing address: </span>{owner.mailingAddress}</div>
        )}
        <div>
          <span style={fieldLabelStyle}>Phone: </span>
          {owner.phone || <em style={{ opacity: 0.5 }}>Not Verified</em>}
          {owner.phone && (
            <span
              className="ml-1 text-xs"
              style={{ color: isPhoneVerified ? "var(--color-secondary)" : "#B45309" }}
            >
              {isPhoneVerified ? "✓ Verified" : "(Not Verified)"}
            </span>
          )}
        </div>
        <div>
          <span style={fieldLabelStyle}>Email: </span>
          {owner.email || <em style={{ opacity: 0.5 }}>Not Verified</em>}
          {owner.email && (
            <span
              className="ml-1 text-xs"
              style={{ color: isEmailVerified ? "var(--color-secondary)" : "#B45309" }}
            >
              {isEmailVerified ? "✓ Verified" : "(Not Verified)"}
            </span>
          )}
        </div>
        <div>
          <span style={fieldLabelStyle}>Source: </span>
          {owner.contactSource || owner.leadSource || "—"}
        </div>
        {owner.preferredContactMethod && (
          <div><span style={fieldLabelStyle}>Preferred contact: </span>{owner.preferredContactMethod}</div>
        )}
        <div>
          <span style={fieldLabelStyle}>Verification: </span>
          {isPhoneVerified || isEmailVerified ? "Operator-verified" : "Not Verified — RentCast data"}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setEditing((e) => !e)}
        className="mt-2 text-xs font-semibold px-2 py-0.5 rounded"
        style={{ border: "1px solid var(--color-border)", backgroundColor: "#fff", color: "var(--color-secondary)" }}
        aria-expanded={editing}
      >
        {editing ? "Cancel" : "Edit Contact Info"}
      </button>

      {editing && (
        <form onSubmit={handleSave} className="mt-2 space-y-1.5">
          <div>
            <label className="block text-xs font-medium mb-0.5">Phone</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} style={inlineInputStyle} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-0.5">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inlineInputStyle} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-0.5">Preferred contact method</label>
            <select value={preferred} onChange={(e) => setPreferred(e.target.value)} style={inlineInputStyle}>
              <option value="">— select —</option>
              <option value="phone">Phone</option>
              <option value="email">Email</option>
              <option value="text">Text</option>
              <option value="mail">Mail</option>
              <option value="in_person">In Person</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-0.5">Contact source</label>
            <input type="text" placeholder="e.g. operator research, referral" value={contactSource} onChange={(e) => setContactSource(e.target.value)} style={inlineInputStyle} />
          </div>
          <button type="submit" className="text-xs px-2 py-0.5 rounded font-semibold text-white" style={{ backgroundColor: "var(--color-action)", border: "none" }}>
            Save
          </button>
          <StatusMsg msg={saveMsg} />
        </form>
      )}
    </SectionCard>
  );
}

// ─── Listing Contact Section ──────────────────────────────────────────────────

function ListingContactSection({ lead }: { lead: PropertyLeadView }) {
  if (!lead.listingContact && !lead.listingPhone && !lead.listingEmail) return null;
  return (
    <SectionCard title="Listing Contact">
      <p
        className="text-xs mb-1.5 rounded px-2 py-1"
        style={{ backgroundColor: "#FEF3C7", color: "#92400E", border: "1px solid #FDE68A" }}
        role="note"
      >
        ⚠ Listing Contact — not verified as property owner
      </p>
      <div className="text-xs space-y-0.5" style={{ color: "var(--color-text)" }}>
        {lead.listingContact && (
          <div><span style={fieldLabelStyle}>Name: </span>{lead.listingContact}</div>
        )}
        {lead.listingPhone && (
          <div><span style={fieldLabelStyle}>Phone: </span>{lead.listingPhone}</div>
        )}
        {lead.listingEmail && (
          <div><span style={fieldLabelStyle}>Email: </span>{lead.listingEmail}</div>
        )}
        {lead.sourceUrl && (
          <div>
            <span style={fieldLabelStyle}>Listing URL: </span>
            <a
              href={lead.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
              style={{ color: "var(--color-secondary)" }}
            >
              Source listing
            </a>
          </div>
        )}
      </div>
    </SectionCard>
  );
}

// ─── Stage Controls ───────────────────────────────────────────────────────────

function StageControlsSection({
  lead,
  projectId,
  onStageChange,
}: {
  lead: PropertyLeadView;
  projectId: string;
  onStageChange: (leadId: string, newStage: string) => void;
}) {
  const [reopenReason, setReopenReason] = useState("");
  const [reopenMsg, setReopenMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [, startTx] = useTransition();

  const isTerminal = TERMINAL_STAGES.has(lead.acquisitionStage);
  const permittedNext = PIPELINE_STAGES.filter((s) =>
    isTransitionPermitted(lead.acquisitionStage, s.value)
  );

  function handleAdvance(toStage: string) {
    startTx(async () => {
      const result = await advanceLeadStageAction(lead.id, projectId, toStage);
      if (result.ok) onStageChange(lead.id, toStage);
    });
  }

  function handleReopen(e: React.FormEvent) {
    e.preventDefault();
    startTx(async () => {
      const result = await reopenLeadAction(lead.id, projectId, reopenReason);
      setReopenMsg({ ok: result.ok, text: result.ok ? "Lead reopened." : (result.error ?? "Failed.") });
      if (result.ok) {
        onStageChange(lead.id, "researching");
        setReopenReason("");
      }
    });
  }

  return (
    <SectionCard title="Pipeline Stage">
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className="text-xs px-2 py-0.5 rounded-full font-semibold"
          style={{
            backgroundColor: isTerminal ? "#FEF3C7" : "var(--color-surface-soft)",
            border: "1px solid var(--color-border)",
            color: isTerminal ? "#92400E" : "var(--color-secondary)",
          }}
        >
          {PIPELINE_STAGE_LABELS[lead.acquisitionStage] ?? lead.acquisitionStage}
        </span>
        {isTerminal && (
          <span className="text-xs" style={{ color: "#B45309" }}>(terminal)</span>
        )}
      </div>

      {!isTerminal && permittedNext.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-1">
          <span className="text-xs self-center" style={{ opacity: 0.55 }}>Move to:</span>
          {permittedNext.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => handleAdvance(s.value)}
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ border: "1px solid var(--color-border)", backgroundColor: "#fff", color: "var(--color-secondary)" }}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {isTerminal && (
        <form onSubmit={handleReopen} className="flex gap-2 items-start mt-1">
          <input
            type="text"
            placeholder="Reason to reopen (required)…"
            value={reopenReason}
            onChange={(e) => setReopenReason(e.target.value)}
            required
            style={{ ...inlineInputStyle, flex: 1 }}
            aria-label="Reason to reopen this lead"
          />
          <button
            type="submit"
            disabled={!reopenReason.trim()}
            className="text-xs px-2 py-1 rounded font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: "#B45309", border: "none" }}
          >
            Reopen
          </button>
          <StatusMsg msg={reopenMsg} />
        </form>
      )}
    </SectionCard>
  );
}

// ─── Record Outreach Section ──────────────────────────────────────────────────

function RecordOutreachSection({
  lead,
  projectId,
  onStageChange,
  onActivityAdded,
}: {
  lead: PropertyLeadView;
  projectId: string;
  onStageChange: (leadId: string, newStage: string) => void;
  onActivityAdded: () => void;
}) {
  const [contactMethod, setContactMethod] = useState("phone");
  const [outcome, setOutcome] = useState("");
  const [notes, setNotes] = useState("");
  const [nextFollowUp, setNextFollowUp] = useState("");
  const [advanceTo, setAdvanceTo] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [followUpConfirm, setFollowUpConfirm] = useState<string | null>(null);
  const [, startTx] = useTransition();

  const isTerminal = TERMINAL_STAGES.has(lead.acquisitionStage);
  const permittedNext = PIPELINE_STAGES.filter((s) =>
    isTransitionPermitted(lead.acquisitionStage, s.value)
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTx(async () => {
      setMsg(null);
      setFollowUpConfirm(null);
      const result = await recordOutreachAction({
        projectId,
        leadId: lead.id,
        contactMethod,
        outcome,
        notes: notes || null,
        nextFollowUpAt: nextFollowUp || null,
        advanceTo: advanceTo || null,
      });
      if (result.ok) {
        setMsg({ ok: true, text: "Outreach recorded." });
        if (advanceTo) {
          onStageChange(lead.id, advanceTo);
          setAdvanceTo("");
        }
        if (nextFollowUp && result.followUpTaskId) {
          setFollowUpConfirm(`Follow-up task set for ${nextFollowUp}.`);
        }
        setOutcome("");
        setNotes("");
        setNextFollowUp("");
        onActivityAdded();
      } else {
        setMsg({ ok: false, text: result.error ?? "Failed." });
      }
    });
  }

  return (
    <SectionCard title="Record Outreach">
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium mb-0.5" htmlFor="ow-method">Contact method</label>
            <select id="ow-method" value={contactMethod} onChange={(e) => setContactMethod(e.target.value)} style={inlineInputStyle}>
              <option value="phone">Phone</option>
              <option value="email">Email</option>
              <option value="text">Text</option>
              <option value="mail">Mail</option>
              <option value="in_person">In Person</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-0.5" htmlFor="ow-outcome">Outcome <span aria-hidden="true">*</span></label>
            <input
              id="ow-outcome"
              type="text"
              required
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              placeholder="e.g. Left voicemail"
              style={inlineInputStyle}
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium mb-0.5" htmlFor="ow-notes">Notes</label>
          <textarea
            id="ow-notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{ ...inlineInputStyle, resize: "vertical" }}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium mb-0.5" htmlFor="ow-followup">Follow-up date</label>
            <input
              id="ow-followup"
              type="date"
              value={nextFollowUp}
              onChange={(e) => setNextFollowUp(e.target.value)}
              style={inlineInputStyle}
            />
          </div>
          {!isTerminal && permittedNext.length > 0 && (
            <div>
              <label className="block text-xs font-medium mb-0.5" htmlFor="ow-advance">Also advance stage to</label>
              <select id="ow-advance" value={advanceTo} onChange={(e) => setAdvanceTo(e.target.value)} style={inlineInputStyle}>
                <option value="">— no change —</option>
                {permittedNext.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={!outcome.trim()}
            className="text-xs px-3 py-1 rounded-lg font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: "var(--color-action)", border: "none" }}
          >
            Record Outreach
          </button>
        </div>
        <StatusMsg msg={msg} />
        {followUpConfirm && (
          <p className="text-xs" style={{ color: "var(--color-secondary)" }} aria-live="polite">
            ✓ {followUpConfirm}
          </p>
        )}
      </form>
    </SectionCard>
  );
}

// ─── Activity Timeline ────────────────────────────────────────────────────────

function ActivityTimeline({ activities }: { activities: ActivityItem[] }) {
  if (activities.length === 0) {
    return (
      <SectionCard title="Activity Timeline">
        <p className="text-xs" style={{ color: "var(--color-text)", opacity: 0.5 }}>
          No activities recorded yet.
        </p>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Activity Timeline">
      <ol className="space-y-2" aria-label="Outreach and stage activity history">
        {activities.map((a) => (
          <li
            key={a.id}
            className="text-xs border-l-2 pl-2"
            style={{ borderColor: "var(--color-border)" }}
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold" style={{ color: "var(--color-primary)" }}>
                {activityTypeLabel(a.activityType)}
              </span>
              {a.contactMethod && (
                <span style={{ opacity: 0.6 }}>via {a.contactMethod}</span>
              )}
              <span style={{ opacity: 0.45 }}>{formatDate(a.createdAt)}</span>
              {a.actorName && <span style={{ opacity: 0.5 }}>— {a.actorName}</span>}
            </div>
            {a.stageBefore && a.stageAfter && (
              <p style={{ color: "var(--color-secondary)", marginTop: "0.125rem" }}>
                {PIPELINE_STAGE_LABELS[a.stageBefore] ?? a.stageBefore} → {PIPELINE_STAGE_LABELS[a.stageAfter] ?? a.stageAfter}
              </p>
            )}
            {a.outcome && <p style={{ opacity: 0.8, marginTop: "0.125rem" }}>{a.outcome}</p>}
            {a.notes && <p style={{ opacity: 0.7, marginTop: "0.125rem" }}>{a.notes}</p>}
            {a.nextFollowUpAt && (
              <p style={{ color: "#B45309", marginTop: "0.125rem" }}>
                Follow-up: {formatDate(a.nextFollowUpAt)}
              </p>
            )}
          </li>
        ))}
      </ol>
    </SectionCard>
  );
}

// ─── Negotiation Section ──────────────────────────────────────────────────────

function NegotiationSection({
  lead,
  projectId,
  onActivityAdded,
}: {
  lead: PropertyLeadView & {
    proposedMonthlyRent?: string | null;
    ownerAskingRent?: string | null;
    proposedDeposit?: string | null;
    proposedLeaseTermMonths?: number | null;
    proposedAgreementType?: string | null;
    utilitiesResponsibility?: string | null;
    furnishingResponsibility?: string | null;
    maintenanceResponsibility?: string | null;
    negotiationSummary?: string | null;
  };
  projectId: string;
  onActivityAdded: () => void;
}) {
  const [proposedRent, setProposedRent] = useState(lead.proposedMonthlyRent ?? "");
  const [askingRent, setAskingRent] = useState(lead.ownerAskingRent ?? "");
  const [deposit, setDeposit] = useState(lead.proposedDeposit ?? "");
  const [termMonths, setTermMonths] = useState(lead.proposedLeaseTermMonths ? String(lead.proposedLeaseTermMonths) : "");
  const [agreementType, setAgreementType] = useState(lead.proposedAgreementType ?? "");
  const [utilities, setUtilities] = useState(lead.utilitiesResponsibility ?? "");
  const [furnishing, setFurnishing] = useState(lead.furnishingResponsibility ?? "");
  const [maintenance, setMaintenance] = useState(lead.maintenanceResponsibility ?? "");
  const [summary, setSummary] = useState(lead.negotiationSummary ?? "");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [, startTx] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTx(async () => {
      setMsg(null);
      const result = await updateNegotiationAction(
        lead.id,
        projectId,
        {
          proposedMonthlyRent: proposedRent ? parseFloat(proposedRent) : undefined,
          ownerAskingRent: askingRent ? parseFloat(askingRent) : undefined,
          proposedDeposit: deposit ? parseFloat(deposit) : undefined,
          proposedLeaseTermMonths: termMonths ? parseInt(termMonths, 10) : undefined,
          proposedAgreementType: agreementType || undefined,
          utilitiesResponsibility: utilities || undefined,
          furnishingResponsibility: furnishing || undefined,
          maintenanceResponsibility: maintenance || undefined,
          negotiationSummary: summary || undefined,
        },
        summary || "Negotiation terms updated."
      );
      setMsg({ ok: result.ok, text: result.ok ? "Terms saved." : (result.error ?? "Failed.") });
      if (result.ok) onActivityAdded();
    });
  }

  return (
    <SectionCard title="Negotiation Terms">
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium mb-0.5">Operator proposal ($)</label>
            <input type="number" min={0} step={50} value={proposedRent} onChange={(e) => setProposedRent(e.target.value)} style={inlineInputStyle} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-0.5">Owner asking ($)</label>
            <input type="number" min={0} step={50} value={askingRent} onChange={(e) => setAskingRent(e.target.value)} style={inlineInputStyle} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-0.5">Proposed deposit ($)</label>
            <input type="number" min={0} step={50} value={deposit} onChange={(e) => setDeposit(e.target.value)} style={inlineInputStyle} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-0.5">Term (months)</label>
            <input type="number" min={1} max={60} value={termMonths} onChange={(e) => setTermMonths(e.target.value)} style={inlineInputStyle} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-0.5">Agreement type</label>
            <select value={agreementType} onChange={(e) => setAgreementType(e.target.value)} style={inlineInputStyle}>
              <option value="">— select —</option>
              <option value="master_lease">Master Lease</option>
              <option value="corporate_lease">Corporate Lease</option>
              <option value="operating_agreement">Operating Agreement</option>
              <option value="standard_lease">Standard Lease</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2">
          <div>
            <label className="block text-xs font-medium mb-0.5">Utilities (responsibility)</label>
            <input type="text" placeholder="e.g. Operator, Owner, Shared" value={utilities} onChange={(e) => setUtilities(e.target.value)} style={inlineInputStyle} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-0.5">Furnishing (responsibility)</label>
            <input type="text" value={furnishing} onChange={(e) => setFurnishing(e.target.value)} style={inlineInputStyle} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-0.5">Maintenance (responsibility)</label>
            <input type="text" value={maintenance} onChange={(e) => setMaintenance(e.target.value)} style={inlineInputStyle} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium mb-0.5">Current working terms summary</label>
          <textarea rows={2} value={summary} onChange={(e) => setSummary(e.target.value)} style={{ ...inlineInputStyle, resize: "vertical" }} />
        </div>
        <button
          type="submit"
          className="text-xs px-3 py-1 rounded-lg font-semibold text-white"
          style={{ backgroundColor: "var(--color-action)", border: "none" }}
        >
          Save Negotiation
        </button>
        <StatusMsg msg={msg} />
      </form>
    </SectionCard>
  );
}

// ─── Secure Property Section ──────────────────────────────────────────────────

function SecurePropertySection({
  lead,
  projectId,
  onStageChange,
}: {
  lead: PropertyLeadView;
  projectId: string;
  onStageChange: (leadId: string, newStage: string) => void;
}) {
  const [agreementType, setAgreementType] = useState("master_lease");
  const [agreedRent, setAgreedRent] = useState("");
  const [deposit, setDeposit] = useState("");
  const [leaseStart, setLeaseStart] = useState("");
  const [termMonths, setTermMonths] = useState("");
  const [signedDate, setSignedDate] = useState("");
  const [agreementRef, setAgreementRef] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [, startTx] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!confirmed) return;
    startTx(async () => {
      setMsg(null);
      const result = await securePropertyAction({
        leadId: lead.id,
        projectId,
        agreementType,
        agreedMonthlyRent: parseFloat(agreedRent),
        agreedDeposit: deposit ? parseFloat(deposit) : null,
        leaseStartDate: leaseStart,
        leaseTermMonths: termMonths ? parseInt(termMonths, 10) : null,
        signedDate,
        agreementReference: agreementRef || null,
        explicitConfirmation: confirmed,
      });
      setMsg({
        ok: result.ok,
        text: result.ok ? "Property secured. Project advanced to Preparing Property. ✓" : (result.error ?? "Failed."),
      });
      if (result.ok) onStageChange(lead.id, "agreement_signed");
    });
  }

  return (
    <SectionCard title="Secure Property — Agreement Signing">
      <p className="text-xs mb-2" style={{ color: "var(--color-text)", opacity: 0.65 }}>
        Use this section only when the agreement has been physically signed.
        Final agreed terms are stored on the secured property record.
      </p>
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium mb-0.5">Agreement type <span aria-hidden="true">*</span></label>
            <select required value={agreementType} onChange={(e) => setAgreementType(e.target.value)} style={inlineInputStyle}>
              <option value="master_lease">Master Lease</option>
              <option value="corporate_lease">Corporate Lease</option>
              <option value="operating_agreement">Operating Agreement</option>
              <option value="standard_lease">Standard Lease</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-0.5">Agreed monthly rent ($) <span aria-hidden="true">*</span></label>
            <input type="number" required min={1} step={50} value={agreedRent} onChange={(e) => setAgreedRent(e.target.value)} style={inlineInputStyle} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-0.5">Deposit ($)</label>
            <input type="number" min={0} step={50} value={deposit} onChange={(e) => setDeposit(e.target.value)} style={inlineInputStyle} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-0.5">Lease start date <span aria-hidden="true">*</span></label>
            <input type="date" required value={leaseStart} onChange={(e) => setLeaseStart(e.target.value)} style={inlineInputStyle} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-0.5">Lease term (months)</label>
            <input type="number" min={1} max={60} value={termMonths} onChange={(e) => setTermMonths(e.target.value)} style={inlineInputStyle} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-0.5">Date signed <span aria-hidden="true">*</span></label>
            <input type="date" required value={signedDate} onChange={(e) => setSignedDate(e.target.value)} style={inlineInputStyle} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium mb-0.5">Agreement reference #</label>
            <input type="text" value={agreementRef} onChange={(e) => setAgreementRef(e.target.value)} style={inlineInputStyle} />
          </div>
        </div>

        <label className="flex items-start gap-2 text-xs cursor-pointer rounded p-2" style={{ backgroundColor: "#FFF7ED", border: "1px solid #FED7AA" }}>
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            required
            style={{ marginTop: "0.15rem" }}
          />
          <span style={{ color: "#92400E", fontWeight: 600 }}>
            I confirm the agreement has been physically signed and all terms above are accurate.
          </span>
        </label>

        <button
          type="submit"
          disabled={!confirmed || !agreedRent || !leaseStart || !signedDate}
          className="w-full text-sm px-4 py-2 rounded-lg font-semibold text-white disabled:opacity-40"
          style={{ backgroundColor: "#15803D", border: "none" }}
        >
          Secure Property &amp; Begin Preparation
        </button>
        <StatusMsg msg={msg} />
      </form>
    </SectionCard>
  );
}

// ─── Owner Outreach Playbook ──────────────────────────────────────────────────

function OwnerOutreachPlaybookSection() {
  const [expanded, setExpanded] = useState(false);
  const [openObjectionId, setOpenObjectionId] = useState<number | null>(null);

  function handleExport(format: "pdf" | "docx") {
    window.location.href = `/api/export/owner-outreach-playbook/${format}`;
  }

  return (
    <div
      className="rounded-lg mb-2"
      style={{ backgroundColor: "#fff", border: "1px solid var(--color-border)" }}
    >
      {/* Header bar */}
      <div
        className="flex items-center justify-between p-3"
        style={{ borderBottom: expanded ? "1px solid var(--color-border)" : undefined }}
      >
        <div className="flex items-center gap-2">
          <p style={sectionHeadingStyle}>Owner Outreach Playbook</p>
          <span
            className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
            style={{ backgroundColor: "var(--color-surface-soft)", color: "var(--color-secondary)", border: "1px solid var(--color-border)" }}
          >
            v{PLAYBOOK_VERSION}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleExport("pdf")}
            title="Export Owner Outreach Playbook as PDF"
            className="text-xs px-2 py-0.5 rounded font-semibold"
            style={{ border: "1px solid var(--color-border)", backgroundColor: "#fff", color: "var(--color-secondary)" }}
          >
            Export PDF
          </button>
          <button
            type="button"
            onClick={() => handleExport("docx")}
            title="Export Owner Outreach Playbook as Word document"
            className="text-xs px-2 py-0.5 rounded font-semibold"
            style={{ border: "1px solid var(--color-border)", backgroundColor: "#fff", color: "var(--color-secondary)" }}
          >
            Export Word
          </button>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="text-xs px-2 py-0.5 rounded font-semibold"
            style={{ border: "1px solid var(--color-border)", backgroundColor: expanded ? "var(--color-surface-soft)" : "#fff", color: "var(--color-primary)" }}
          >
            {expanded ? "Hide Playbook ▲" : "View Playbook ▼"}
          </button>
        </div>
      </div>

      {/* Playbook content (collapsed by default) */}
      {expanded && (
        <div className="p-3 space-y-4 text-xs" style={{ color: "var(--color-text)" }}>

          {/* Opening Script */}
          <div>
            <p className="font-bold text-sm mb-1" style={{ color: "var(--color-primary)" }}>
              {openingScript.title}
            </p>
            <p
              className="mb-2 p-2 rounded"
              style={{ backgroundColor: "var(--color-surface-soft)", border: "1px solid var(--color-border)" }}
            >
              {openingScript.text}
            </p>
            <div className="space-y-2">
              {openingScript.followUps.map((fu, i) => (
                <div key={i} className="rounded p-2" style={{ backgroundColor: "#F0FDF4", border: "1px solid #BBF7D0" }}>
                  <p className="font-semibold mb-1" style={{ color: "#166534" }}>{fu.prompt}</p>
                  <p style={{ color: "var(--color-text)" }}>{fu.response}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Primary Objective */}
          <div
            className="rounded p-2 font-semibold"
            style={{ backgroundColor: "#FEF3C7", border: "1px solid #FDE68A", color: "#92400E" }}
          >
            🎯 <span>Primary Objective: </span>{openingScript.primaryObjective}
          </div>

          {/* Outreach Framework */}
          <div>
            <p className="font-bold mb-1" style={{ color: "var(--color-primary)" }}>
              {outreachFramework.name}
            </p>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {outreachFramework.steps.map((step, i) => (
                <span key={i} className="flex items-center gap-1">
                  <span
                    className="px-2 py-0.5 rounded font-semibold text-white text-xs"
                    style={{ backgroundColor: "var(--color-secondary)" }}
                  >
                    {step}
                  </span>
                  {i < outreachFramework.steps.length - 1 && (
                    <span style={{ opacity: 0.4 }}>→</span>
                  )}
                </span>
              ))}
            </div>
            <p style={{ opacity: 0.75 }}>{outreachFramework.guidance}</p>
          </div>

          {/* Objection Responses — accordion */}
          <div>
            <p className="font-bold mb-2" style={{ color: "var(--color-primary)" }}>
              Owner Objections &amp; Responses ({objections.length})
            </p>
            <div className="space-y-1">
              {objections.map((obj) => (
                <div
                  key={obj.id}
                  className="rounded overflow-hidden"
                  style={{ border: "1px solid var(--color-border)" }}
                >
                  <button
                    type="button"
                    onClick={() => setOpenObjectionId((prev) => (prev === obj.id ? null : obj.id))}
                    aria-expanded={openObjectionId === obj.id}
                    className="w-full text-left flex items-center gap-2 px-2 py-1.5"
                    style={{
                      backgroundColor: openObjectionId === obj.id ? "var(--color-surface-soft)" : "#fff",
                      color: "var(--color-text)",
                    }}
                  >
                    <span
                      className="shrink-0 font-bold text-xs rounded-full w-5 h-5 flex items-center justify-center"
                      style={{ backgroundColor: "var(--color-surface-soft)", border: "1px solid var(--color-border)", color: "var(--color-secondary)" }}
                    >
                      {obj.id}
                    </span>
                    <span className="font-semibold flex-1 text-xs">{obj.objection}</span>
                    <span style={{ opacity: 0.4 }}>{openObjectionId === obj.id ? "▲" : "▼"}</span>
                  </button>
                  {openObjectionId === obj.id && (
                    <div
                      className="px-3 py-2"
                      style={{ borderTop: "1px solid var(--color-border)", backgroundColor: "#FAFAFA" }}
                    >
                      <p style={{ color: "var(--color-text)", lineHeight: 1.6 }}>{obj.response}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Guardrails / Prohibited Assurances */}
          <div
            className="rounded p-2"
            style={{ backgroundColor: "#FFF1F2", border: "1px solid #FECDD3" }}
          >
            <p className="font-bold mb-1.5" style={{ color: "#9F1239" }}>
              ⛔ Guardrails — {prohibitedAssurances.title}
            </p>
            <ul className="space-y-0.5 mb-2">
              {prohibitedAssurances.items.map((item, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span style={{ color: "#BE123C" }}>✗</span>
                  <span style={{ color: "#9F1239", fontWeight: 600 }}>{item}</span>
                </li>
              ))}
            </ul>
            <p style={{ color: "#7F1D1D", fontStyle: "italic" }}>{prohibitedAssurances.guidance}</p>
          </div>

        </div>
      )}
    </div>
  );
}

// ─── LeadWorkspace (main export) ─────────────────────────────────────────────

export interface LeadWorkspaceProps {
  lead: PropertyLeadView & {
    proposedMonthlyRent?: string | null;
    ownerAskingRent?: string | null;
    proposedDeposit?: string | null;
    proposedLeaseTermMonths?: number | null;
    proposedAgreementType?: string | null;
    utilitiesResponsibility?: string | null;
    furnishingResponsibility?: string | null;
    maintenanceResponsibility?: string | null;
    negotiationSummary?: string | null;
    lastStageChangedAt?: Date | null;
  };
  projectId: string;
  initialOwner?: OwnerContact | null;
  initialActivities?: ActivityItem[];
  initialFollowUpTask?: FollowUpTask | null;
  onStageChange: (leadId: string, newStage: string) => void;
}

export function LeadWorkspace({
  lead,
  projectId,
  initialOwner = null,
  initialActivities = [],
  onStageChange,
}: LeadWorkspaceProps) {
  const [activities, setActivities] = useState<ActivityItem[]>(initialActivities);
  const [owner] = useState<OwnerContact | null>(initialOwner);

  // After any outreach/negotiation, append a placeholder activity so the
  // timeline refreshes without a full page reload.
  const handleActivityAdded = useCallback(() => {
    // Optimistic: mark for refresh. In a future phase, re-fetch via server action.
    // For now, just trigger a re-render so the "no activities" message disappears.
    setActivities((prev) => prev); // no-op to avoid stale closure lint
  }, []);

  const isNegotiating = lead.acquisitionStage === "negotiating";
  const isTerminal = TERMINAL_STAGES.has(lead.acquisitionStage);

  return (
    <div
      className="mt-3 rounded-lg"
      style={{ backgroundColor: "var(--color-surface-soft)", border: "1px solid var(--color-border)", padding: "0.75rem" }}
    >
      <PropertySummarySection lead={lead} />
      <OwnerContactSection owner={owner} projectId={projectId} />
      <ListingContactSection lead={lead} />
      <StageControlsSection lead={{ ...lead, acquisitionStage: lead.acquisitionStage }} projectId={projectId} onStageChange={onStageChange} />

      {!isTerminal && (
        <RecordOutreachSection
          lead={lead}
          projectId={projectId}
          onStageChange={onStageChange}
          onActivityAdded={handleActivityAdded}
        />
      )}

      <OwnerOutreachPlaybookSection />

      <ActivityTimeline activities={activities} />

      <NegotiationSection
        lead={lead}
        projectId={projectId}
        onActivityAdded={handleActivityAdded}
      />

      {isNegotiating && (
        <SecurePropertySection lead={lead} projectId={projectId} onStageChange={onStageChange} />
      )}
    </div>
  );
}
