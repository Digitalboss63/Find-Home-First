"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import type { PlacementWorkspaceView } from "@/lib/repository-placement";
import {
  placementStageTitle,
  residentPropertyFit,
  todayIso,
} from "@/lib/placement-workflow";
import {
  approveResidentMatchAction,
  completePropertyPreparationAction,
  confirmMoveInAction,
  createResidentCandidateAction,
  ensurePreparationChecklistAction,
  scheduleMoveInAction,
  selectResidentCandidateAction,
  updatePreparationTaskAction,
} from "./actions";

const cardStyle: React.CSSProperties = {
  backgroundColor: "#fff",
  border: "1px solid var(--color-border)",
  borderRadius: "0.75rem",
  padding: "1.25rem",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid var(--color-border)",
  borderRadius: "0.5rem",
  padding: "0.6rem 0.7rem",
  backgroundColor: "#fff",
  color: "var(--color-text)",
  fontSize: "0.875rem",
};

function ActionMessage({ message }: { message: { ok: boolean; text: string } | null }) {
  if (!message) return null;
  return (
    <p
      role={message.ok ? "status" : "alert"}
      className="mt-3 rounded-lg px-3 py-2 text-sm font-semibold"
      style={{
        backgroundColor: message.ok ? "#F0FDF4" : "#FEF2F2",
        color: message.ok ? "#166534" : "#991B1B",
        border: `1px solid ${message.ok ? "#BBF7D0" : "#FECACA"}`,
      }}
    >
      {message.text}
    </p>
  );
}

function CheckRow({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex items-start gap-3 rounded-lg px-3 py-2 text-sm" style={{ border: "1px solid var(--color-border)" }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        style={{ marginTop: "0.15rem", width: "1rem", height: "1rem" }}
      />
      <span>{children}</span>
    </label>
  );
}

export default function PlacementWorkspaceClient({
  initialData,
}: {
  initialData: PlacementWorkspaceView;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [showResidentForm, setShowResidentForm] = useState(false);
  const [approvalChecks, setApprovalChecks] = useState([false, false, false, false, false]);
  const [moveInChecks, setMoveInChecks] = useState([false, false, false, false]);
  const [moveInDate, setMoveInDate] = useState(initialData.project.targetMoveIn ?? "");
  const [actualMoveInDate, setActualMoveInDate] = useState(todayIso());
  const [approvalNotes, setApprovalNotes] = useState("");
  const [moveInNotes, setMoveInNotes] = useState("");

  const projectId = initialData.project.id;
  const status = initialData.project.currentStatus;
  const availableResidents = useMemo(
    () =>
      initialData.residents.filter(
        (resident) =>
          ["pending", "active"].includes(resident.placementStatus) ||
          resident.id === initialData.project.residentId,
      ),
    [initialData.project.residentId, initialData.residents],
  );

  function run(action: () => Promise<{ ok: boolean; message?: string; error?: string }>) {
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      setMessage({
        ok: result.ok,
        text: result.ok ? result.message ?? "Saved." : result.error ?? "Action failed.",
      });
      if (result.ok) router.refresh();
    });
  }

  const property = initialData.property;
  const matchedResident = initialData.matchedResident;
  const completedPrep = initialData.preparationTasks.filter(
    (task) => task.status === "completed",
  ).length;
  const allPrepDone =
    initialData.preparationTasks.length > 0 &&
    completedPrep === initialData.preparationTasks.length;

  return (
    <div className="grid gap-5">
      <section aria-labelledby="placement-stage-title" style={{ ...cardStyle, backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" }}>
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#1D4ED8" }}>
          Current placement step
        </p>
        <h2 id="placement-stage-title" className="mt-1 text-xl font-bold" style={{ color: "var(--color-primary)" }}>
          {placementStageTitle(status)}
        </h2>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: "#1E3A8A" }}>
          Complete only the section shown for the current step. Your work is saved to this project and restored when you return.
        </p>
      </section>

      <section aria-labelledby="secured-property-heading" style={cardStyle}>
        <h2 id="secured-property-heading" className="text-base font-bold" style={{ color: "var(--color-primary)" }}>
          Secured Property
        </h2>
        {property ? (
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <p><strong>Address:</strong> {property.address}{property.city ? `, ${property.city}` : ""}{property.state ? `, ${property.state}` : ""}</p>
            <p><strong>Readiness:</strong> {property.readinessStatus === "available" ? "Ready for placement" : property.readinessStatus === "occupied" ? "Occupied" : "Preparation in progress"}</p>
            <p><strong>Space:</strong> {property.bedrooms ?? "Not recorded"} bedroom(s) · {property.bathrooms ?? "—"} bathroom(s)</p>
            <p><strong>Lease:</strong> {property.monthlyRent ? `$${Number(property.monthlyRent).toLocaleString()}/month` : "Amount not recorded"}</p>
          </div>
        ) : (
          <div className="mt-3">
            <p className="text-sm">No secured property is connected to this project yet.</p>
            <Link href={`/housing-search?project=${projectId}`} className="mt-3 inline-flex rounded-lg px-4 py-2 text-sm font-bold text-white" style={{ backgroundColor: "var(--color-action)" }}>
              Return to Find Properties →
            </Link>
          </div>
        )}
      </section>

      {status === "preparing_property" && property && (
        <section aria-labelledby="preparation-heading" style={cardStyle}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="preparation-heading" className="text-base font-bold" style={{ color: "var(--color-primary)" }}>
                Property Preparation Checklist
              </h2>
              <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
                {completedPrep} of {initialData.preparationTasks.length} tasks complete
              </p>
            </div>
          </div>
          {initialData.preparationTasks.length === 0 ? (
            <div className="mt-4 rounded-lg p-4" style={{ backgroundColor: "#FFF7ED", border: "1px solid #FED7AA" }}>
              <p className="text-sm">The checklist is missing for this secured property.</p>
              <button type="button" disabled={pending} onClick={() => run(() => ensurePreparationChecklistAction(projectId))} className="mt-3 rounded-lg px-4 py-2 text-sm font-bold text-white" style={{ backgroundColor: "var(--color-action)", border: 0 }}>
                Create Preparation Checklist
              </button>
            </div>
          ) : (
            <div className="mt-4 grid gap-2">
              {initialData.preparationTasks.map((task) => (
                <CheckRow
                  key={task.id}
                  checked={task.status === "completed"}
                  onChange={(checked) => run(() => updatePreparationTaskAction(projectId, task.id, checked))}
                >
                  {task.title}
                </CheckRow>
              ))}
              <button
                type="button"
                disabled={pending || !allPrepDone}
                onClick={() => run(() => completePropertyPreparationAction(projectId))}
                className="mt-3 rounded-lg px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
                style={{ backgroundColor: "#166534", border: 0 }}
              >
                Mark Property Ready &amp; Continue to Resident Matching
              </button>
              {!allPrepDone && <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Complete every checklist item to continue.</p>}
            </div>
          )}
        </section>
      )}

      {["seeking_referrals", "reviewing_resident"].includes(status) && property && (
        <section aria-labelledby="resident-heading" style={cardStyle}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="resident-heading" className="text-base font-bold" style={{ color: "var(--color-primary)" }}>
                Prospective Residents
              </h2>
              <p className="mt-1 max-w-xl text-sm" style={{ color: "var(--color-text-muted)" }}>
                Add only the minimum information needed to evaluate housing fit. Use a display name or initials until your organization is ready to store identifying information.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={`/projects/${projectId}/referrals`} className="rounded-lg px-3 py-2 text-sm font-bold no-underline" style={{ color: "#166534", border: "1px solid #86EFAC" }}>
                Referral Sources
              </Link>
              <button type="button" onClick={() => setShowResidentForm((value) => !value)} className="rounded-lg px-3 py-2 text-sm font-bold text-white" style={{ backgroundColor: "var(--color-action)", border: 0 }}>
                {showResidentForm ? "Close Form" : "Add Prospective Resident"}
              </button>
            </div>
          </div>

          {showResidentForm && (
            <ResidentForm
              projectId={projectId}
              contacts={initialData.contacts}
              pending={pending}
              onRun={run}
              onSaved={() => setShowResidentForm(false)}
            />
          )}

          <div className="mt-5 grid gap-3">
            {availableResidents.length === 0 ? (
              <div className="rounded-lg p-5 text-center" style={{ backgroundColor: "var(--color-surface-soft)" }}>
                <p className="font-semibold">No prospective residents yet</p>
                <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>Contact a verified referral source, then add the household when a candidate is referred.</p>
              </div>
            ) : (
              availableResidents.map((resident) => {
                const fit = residentPropertyFit({
                  propertyBedrooms: property.bedrooms,
                  bedroomsNeeded: resident.bedroomsNeeded,
                });
                const selected = resident.id === initialData.project.residentId;
                return (
                  <article key={resident.id} className="rounded-xl p-4" style={{ border: selected ? "2px solid var(--color-primary)" : "1px solid var(--color-border)", backgroundColor: selected ? "#EFF6FF" : "#fff" }}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-bold" style={{ color: "var(--color-primary)" }}>{resident.displayName}</h3>
                        <p className="mt-1 text-sm">{resident.householdSize} person household · {resident.bedroomsNeeded} bedroom(s) needed</p>
                        <p className="mt-1 text-xs" style={{ color: resident.referralContactName ? "var(--color-text-muted)" : "#92400E" }}>
                          Referred by: {resident.referralContactName ?? "Not recorded"}
                        </p>
                      </div>
                      <span className="rounded-full px-2.5 py-1 text-xs font-bold" style={{ backgroundColor: fit.compatible ? "#DCFCE7" : "#FEE2E2", color: fit.compatible ? "#166534" : "#991B1B" }}>
                        {fit.compatible ? "Capacity fit" : "Does not fit"}
                      </span>
                    </div>
                    <p className="mt-3 text-xs" style={{ color: "var(--color-text-muted)" }}>{fit.reason}</p>
                    {resident.accessibilityNeeds && <p className="mt-2 text-xs"><strong>Accessibility review:</strong> {resident.accessibilityNeeds}</p>}
                    <button
                      type="button"
                      disabled={pending || !fit.compatible || selected}
                      onClick={() => run(() => selectResidentCandidateAction(projectId, resident.id))}
                      className="mt-3 rounded-lg px-3 py-2 text-sm font-bold text-white disabled:opacity-45"
                      style={{ backgroundColor: selected ? "#166534" : "var(--color-primary)", border: 0 }}
                    >
                      {selected ? "✓ Selected for Review" : "Review This Match"}
                    </button>
                  </article>
                );
              })
            )}
          </div>
        </section>
      )}

      {status === "reviewing_resident" && matchedResident && (
        <section aria-labelledby="match-review-heading" style={{ ...cardStyle, borderColor: "#93C5FD" }}>
          <h2 id="match-review-heading" className="text-base font-bold" style={{ color: "var(--color-primary)" }}>
            Resident Match Review — {matchedResident.displayName}
          </h2>
          <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>These confirmations are operator-entered. The app does not determine resident eligibility or funding.</p>
          <div className="mt-4 grid gap-2">
            {[
              "Program eligibility was confirmed by the responsible program or caseworker.",
              "Funding or payment source was confirmed.",
              "The resident consented to this housing option.",
              "Accessibility needs were reviewed against the actual property.",
              "Household size and bedroom needs fit the property.",
            ].map((label, index) => (
              <CheckRow key={label} checked={approvalChecks[index]} onChange={(checked) => setApprovalChecks((current) => current.map((value, item) => item === index ? checked : value))}>
                {label}
              </CheckRow>
            ))}
          </div>
          <label className="mt-4 block text-sm font-semibold">
            Review notes (optional)
            <textarea value={approvalNotes} onChange={(event) => setApprovalNotes(event.target.value)} rows={3} style={{ ...inputStyle, marginTop: "0.35rem", resize: "vertical" }} />
          </label>
          <button type="button" disabled={pending || !approvalChecks.every(Boolean)} onClick={() => run(() => approveResidentMatchAction({ projectId, eligibilityConfirmed: approvalChecks[0], fundingConfirmed: approvalChecks[1], consentConfirmed: approvalChecks[2], accessibilityReviewed: approvalChecks[3], propertyFitConfirmed: approvalChecks[4], notes: approvalNotes }))} className="mt-4 w-full rounded-lg px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40" style={{ backgroundColor: "#166534", border: 0 }}>
            Approve Resident Match
          </button>
        </section>
      )}

      {status === "placement_approved" && matchedResident && (
        <section aria-labelledby="schedule-heading" style={cardStyle}>
          <h2 id="schedule-heading" className="text-base font-bold" style={{ color: "var(--color-primary)" }}>Schedule Move-In</h2>
          <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>Coordinate the date with the resident, property owner, and referring caseworker before saving it.</p>
          <label className="mt-4 block max-w-sm text-sm font-semibold">
            Planned move-in date
            <input type="date" min={todayIso()} value={moveInDate} onChange={(event) => setMoveInDate(event.target.value)} style={{ ...inputStyle, marginTop: "0.35rem" }} />
          </label>
          <button type="button" disabled={pending || !moveInDate} onClick={() => run(() => scheduleMoveInAction(projectId, moveInDate))} className="mt-4 rounded-lg px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40" style={{ backgroundColor: "var(--color-action)", border: 0 }}>
            Confirm Move-In Schedule
          </button>
        </section>
      )}

      {status === "move_in_scheduled" && matchedResident && (
        <section aria-labelledby="move-in-heading" style={{ ...cardStyle, borderColor: "#F59E0B" }}>
          <h2 id="move-in-heading" className="text-base font-bold" style={{ color: "var(--color-primary)" }}>Confirm Move-In</h2>
          <p className="mt-1 text-sm"><strong>Scheduled:</strong> {initialData.project.targetMoveIn ?? "Date missing"}</p>
          <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>Do not complete this step until the resident has actually taken occupancy.</p>
          <div className="mt-4 grid gap-2">
            {[
              "The resident has taken occupancy.",
              "Keys and access instructions were provided.",
              "The move-in condition inspection was completed.",
              "Emergency and ongoing support contacts were provided.",
            ].map((label, index) => (
              <CheckRow key={label} checked={moveInChecks[index]} onChange={(checked) => setMoveInChecks((current) => current.map((value, item) => item === index ? checked : value))}>
                {label}
              </CheckRow>
            ))}
          </div>
          <label className="mt-4 block max-w-sm text-sm font-semibold">
            Actual move-in date
            <input type="date" max={todayIso()} value={actualMoveInDate} onChange={(event) => setActualMoveInDate(event.target.value)} style={{ ...inputStyle, marginTop: "0.35rem" }} />
          </label>
          <label className="mt-4 block text-sm font-semibold">
            Move-in notes (optional)
            <textarea value={moveInNotes} onChange={(event) => setMoveInNotes(event.target.value)} rows={3} style={{ ...inputStyle, marginTop: "0.35rem", resize: "vertical" }} />
          </label>
          <button type="button" disabled={pending || !actualMoveInDate || !moveInChecks.every(Boolean)} onClick={() => run(() => confirmMoveInAction({ projectId, actualMoveInDate, occupancyConfirmed: moveInChecks[0], keysConfirmed: moveInChecks[1], inspectionConfirmed: moveInChecks[2], contactsConfirmed: moveInChecks[3], notes: moveInNotes }))} className="mt-4 w-full rounded-lg px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40" style={{ backgroundColor: "#166534", border: 0 }}>
            Confirm Move-In &amp; Complete Placement
          </button>
        </section>
      )}

      {status === "moved_in" && (
        <section aria-labelledby="complete-heading" style={{ ...cardStyle, backgroundColor: "#F0FDF4", borderColor: "#86EFAC" }}>
          <h2 id="complete-heading" className="text-xl font-bold" style={{ color: "#166534" }}>✓ Placement Complete</h2>
          <p className="mt-2 text-sm" style={{ color: "#14532D" }}>
            {matchedResident?.displayName ?? "The resident"} is recorded as placed at {property?.address ?? "the secured property"}.
          </p>
          <Link href={`/projects/${projectId}`} className="mt-4 inline-flex rounded-lg px-4 py-2 text-sm font-bold text-white no-underline" style={{ backgroundColor: "#166534" }}>
            Return to Project Summary
          </Link>
        </section>
      )}

      <ActionMessage message={message} />

      {initialData.history.length > 0 && (
        <details style={cardStyle}>
          <summary className="cursor-pointer text-sm font-bold" style={{ color: "var(--color-primary)" }}>Placement history</summary>
          <ol className="mt-4 grid gap-3">
            {initialData.history.map((entry) => (
              <li key={entry.id} className="border-l-2 pl-3 text-xs" style={{ borderColor: "var(--color-border)" }}>
                <p className="font-bold">{entry.newStatus.replaceAll("_", " ")}</p>
                <p style={{ color: "var(--color-text-muted)" }}>{new Date(entry.changedAt).toLocaleString()}</p>
                {entry.reason && <p className="mt-1">{entry.reason}</p>}
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}

function ResidentForm({
  projectId,
  contacts,
  pending,
  onRun,
  onSaved,
}: {
  projectId: string;
  contacts: PlacementWorkspaceView["contacts"];
  pending: boolean;
  onRun: (action: () => Promise<{ ok: boolean; message?: string; error?: string }>) => void;
  onSaved: () => void;
}) {
  const [displayName, setDisplayName] = useState("");
  const [referralContactId, setReferralContactId] = useState("");
  const [householdSize, setHouseholdSize] = useState("1");
  const [bedroomsNeeded, setBedroomsNeeded] = useState("1");
  const [accessibilityNeeds, setAccessibilityNeeds] = useState("");
  const [incomeRange, setIncomeRange] = useState("");
  const [notes, setNotes] = useState("");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    onRun(async () => {
      const result = await createResidentCandidateAction({
        projectId,
        displayName,
        referralContactId: referralContactId || null,
        householdSize: Number.parseInt(householdSize, 10),
        bedroomsNeeded: Number.parseInt(bedroomsNeeded, 10),
        accessibilityNeeds: accessibilityNeeds || null,
        incomeRange: incomeRange || null,
        notes: notes || null,
      });
      if (result.ok) onSaved();
      return result;
    });
  }

  return (
    <form onSubmit={submit} className="mt-5 grid gap-3 rounded-xl p-4 sm:grid-cols-2" style={{ backgroundColor: "var(--color-surface-soft)", border: "1px solid var(--color-border)" }}>
      <label className="text-sm font-semibold sm:col-span-2">Display name or household initials <input required value={displayName} onChange={(event) => setDisplayName(event.target.value)} style={{ ...inputStyle, marginTop: "0.3rem" }} /></label>
      <label className="text-sm font-semibold sm:col-span-2">Referring caseworker or program <select value={referralContactId} onChange={(event) => setReferralContactId(event.target.value)} style={{ ...inputStyle, marginTop: "0.3rem" }}><option value="">Not recorded</option>{contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name}{contact.organizationName ? ` — ${contact.organizationName}` : ""}</option>)}</select></label>
      <label className="text-sm font-semibold">Household size <input type="number" required min={1} max={30} value={householdSize} onChange={(event) => setHouseholdSize(event.target.value)} style={{ ...inputStyle, marginTop: "0.3rem" }} /></label>
      <label className="text-sm font-semibold">Bedrooms needed <input type="number" required min={0} max={20} value={bedroomsNeeded} onChange={(event) => setBedroomsNeeded(event.target.value)} style={{ ...inputStyle, marginTop: "0.3rem" }} /></label>
      <label className="text-sm font-semibold sm:col-span-2">Accessibility needs requiring property review <textarea value={accessibilityNeeds} onChange={(event) => setAccessibilityNeeds(event.target.value)} rows={2} style={{ ...inputStyle, marginTop: "0.3rem", resize: "vertical" }} /></label>
      <label className="text-sm font-semibold">Funding or income range <input value={incomeRange} onChange={(event) => setIncomeRange(event.target.value)} style={{ ...inputStyle, marginTop: "0.3rem" }} /></label>
      <label className="text-sm font-semibold">Notes <input value={notes} onChange={(event) => setNotes(event.target.value)} style={{ ...inputStyle, marginTop: "0.3rem" }} /></label>
      <button type="submit" disabled={pending} className="rounded-lg px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40 sm:col-span-2" style={{ backgroundColor: "var(--color-action)", border: 0 }}>Save Prospective Resident</button>
    </form>
  );
}
