"use client";

import { useActionState, useTransition, useState, useCallback, useEffect, useRef } from "react";
import { checkApprovalRequirements, REQUIRED_FIELDS, OR_GROUPS } from "@/lib/market-research-validation";
import type { ProjectView, MarketResearchView } from "@/lib/repository";
import {
  saveResearchDraftAction,
  approveMarketAction,
  holdResearchAction,
  rejectMarketAction,
  testPropertySearchAction,
  type ResearchActionState,
} from "./actions";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  project: ProjectView;
  research: MarketResearchView | null;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  backgroundColor: "#fff",
  border: "1px solid var(--color-border)",
  borderRadius: "0.75rem",
  padding: "1.5rem",
  marginBottom: "1.25rem",
};

const sectionHeadingStyle: React.CSSProperties = {
  fontSize: "0.9rem",
  fontWeight: 700,
  color: "var(--color-primary)",
  marginBottom: "1rem",
  paddingBottom: "0.5rem",
  borderBottom: "1px solid var(--color-border)",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.75rem",
  fontWeight: 600,
  marginBottom: "0.3rem",
  color: "var(--color-text)",
  opacity: 0.65,
};

const inputStyle: React.CSSProperties = {
  backgroundColor: "#fff",
  border: "1px solid var(--color-border)",
  borderRadius: "0.5rem",
  color: "var(--color-text)",
  padding: "0.5rem 0.75rem",
  fontSize: "0.875rem",
  width: "100%",
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  resize: "vertical" as const,
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: "1rem",
};

// ─── Field helpers ────────────────────────────────────────────────────────────

function Field({
  label,
  name,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={inputStyle}
      />
    </div>
  );
}

function TextArea({
  label,
  name,
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <textarea
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        style={textareaStyle}
      />
    </div>
  );
}

function RiskCheckbox({
  label,
  name,
  checked,
  onChange,
}: {
  label: string;
  name: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", cursor: "pointer" }}>
      <input
        type="checkbox"
        name={name}
        checked={checked}
        value="true"
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

// ─── Margin calculation ───────────────────────────────────────────────────────
// Formula:
//   occupiedResidents = privateRoomCapacity × (occupancyPercent / 100)
//   revenue           = paymentPerResident × occupiedResidents
//   margin            = revenue − monthlyLease − utilities − otherMonthlyCosts

export interface MarginBreakdown {
  occupiedResidents: number;
  revenue: number;
  margin: number;
}

export function calculateMonthlyMargin(
  paymentPerResident: string,
  privateRoomCapacity: string,
  occupancyPercent: string,
  monthlyLease: string,
  utilities: string,
  otherMonthlyCosts: string
): MarginBreakdown | null {
  const payment = parseFloat(paymentPerResident);
  const capacity = parseFloat(privateRoomCapacity);
  const pct = parseFloat(occupancyPercent);
  const lease = parseFloat(monthlyLease);
  const util = isNaN(parseFloat(utilities)) ? 0 : parseFloat(utilities);
  const other = isNaN(parseFloat(otherMonthlyCosts)) ? 0 : parseFloat(otherMonthlyCosts);

  if (isNaN(payment) || isNaN(capacity) || isNaN(pct) || isNaN(lease)) return null;

  const occupiedResidents = capacity * (pct / 100);
  const revenue = payment * occupiedResidents;
  const margin = revenue - lease - util - other;

  return { occupiedResidents, revenue, margin };
}



// ─── Initial state builder ────────────────────────────────────────────────────

function initField(research: MarketResearchView | null, key: keyof MarketResearchView): string {
  const val = research?.[key];
  if (val === null || val === undefined) return "";
  if (typeof val === "boolean") return val ? "true" : "false";
  return String(val);
}

function initBool(research: MarketResearchView | null, key: keyof MarketResearchView): boolean {
  return research?.[key] === true;
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function ResearchWorkspace({ project, research }: Props) {
  // ── State for all fields ──────────────────────────────────────────────────
  const [targetPopulationSize, setTargetPopulationSize] = useState(initField(research, "targetPopulationSize"));
  const [referralOrgs, setReferralOrgs] = useState(initField(research, "referralOrgs"));
  const [expectedResidentsPerMonth, setExpectedResidentsPerMonth] = useState(initField(research, "expectedResidentsPerMonth"));
  const [demandEvidenceNotes, setDemandEvidenceNotes] = useState(initField(research, "demandEvidenceNotes"));
  const [demandRating, setDemandRating] = useState(initField(research, "demandRating"));
  const [fundingSource, setFundingSource] = useState(initField(research, "fundingSource"));
  const [expectedPaymentPerResident, setExpectedPaymentPerResident] = useState(initField(research, "expectedPaymentPerResident"));
  const [expectedResidentContribution, setExpectedResidentContribution] = useState(initField(research, "expectedResidentContribution"));
  const [expectedOccupancy, setExpectedOccupancy] = useState(initField(research, "expectedOccupancy"));
  const [estimatedMonthlyRevenue, setEstimatedMonthlyRevenue] = useState(initField(research, "estimatedMonthlyRevenue"));
  const [fundingNotes, setFundingNotes] = useState(initField(research, "fundingNotes"));
  const [targetPropertyType, setTargetPropertyType] = useState(initField(research, "targetPropertyType"));
  const [minimumBedrooms, setMinimumBedrooms] = useState(initField(research, "minimumBedrooms"));
  const [maxAcceptableLease, setMaxAcceptableLease] = useState(initField(research, "maxAcceptableLease"));
  const [estimatedUtilities, setEstimatedUtilities] = useState(initField(research, "estimatedUtilities"));
  const [estimatedFurnishingCost, setEstimatedFurnishingCost] = useState(initField(research, "estimatedFurnishingCost"));
  const [expectedPrivateRoomCapacity, setExpectedPrivateRoomCapacity] = useState(initField(research, "expectedPrivateRoomCapacity"));
  const [otherMonthlyCosts, setOtherMonthlyCosts] = useState(initField(research, "otherMonthlyCosts"));
  const [estimatedRentalInventory, setEstimatedRentalInventory] = useState(initField(research, "estimatedRentalInventory"));
  const [typicalLocalRent, setTypicalLocalRent] = useState(initField(research, "typicalLocalRent"));
  const [avgDaysListed, setAvgDaysListed] = useState(initField(research, "avgDaysListed"));
  const [tiredOwnerIndicators, setTiredOwnerIndicators] = useState(initField(research, "tiredOwnerIndicators"));
  const [landlordOutreachNotes, setLandlordOutreachNotes] = useState(initField(research, "landlordOutreachNotes"));
  const [supplySourceLinks, setSupplySourceLinks] = useState(initField(research, "supplySourceLinks"));
  const [transportationAccess, setTransportationAccess] = useState(initField(research, "transportationAccess"));
  const [vaMedicalServices, setVaMedicalServices] = useState(initField(research, "vaMedicalServices"));
  const [groceryEssentialServices, setGroceryEssentialServices] = useState(initField(research, "groceryEssentialServices"));
  const [referralPartnerProximity, setReferralPartnerProximity] = useState(initField(research, "referralPartnerProximity"));
  const [zoningConcerns, setZoningConcerns] = useState(initField(research, "zoningConcerns"));
  const [neighborhoodConcerns, setNeighborhoodConcerns] = useState(initField(research, "neighborhoodConcerns"));
  const [locationNotes, setLocationNotes] = useState(initField(research, "locationNotes"));
  const [riskFundingUncertainty, setRiskFundingUncertainty] = useState(initBool(research, "riskFundingUncertainty"));
  const [riskInsufficientSupply, setRiskInsufficientSupply] = useState(initBool(research, "riskInsufficientSupply"));
  const [riskRentTooHigh, setRiskRentTooHigh] = useState(initBool(research, "riskRentTooHigh"));
  const [riskRegulatoryIssue, setRiskRegulatoryIssue] = useState(initBool(research, "riskRegulatoryIssue"));
  const [riskWeakReferralPipeline, setRiskWeakReferralPipeline] = useState(initBool(research, "riskWeakReferralPipeline"));
  const [riskOther, setRiskOther] = useState(initBool(research, "riskOther"));
  const [riskMitigationNotes, setRiskMitigationNotes] = useState(initField(research, "riskMitigationNotes"));
  const [holdReason, setHoldReason] = useState(initField(research, "holdReason"));

  // ── Auto-save state ────────────────────────────────────────────────────────
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(
    research?.updatedAt?.toISOString() ?? null
  );

  // ── Hold form state ────────────────────────────────────────────────────────
  const [showHoldForm, setShowHoldForm] = useState(false);

  // ── Search state ───────────────────────────────────────────────────────────
  const [searchResults, setSearchResults] = useState<import("@/lib/rentcast").RentCastListing[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchTotal, setSearchTotal] = useState<number | null>(null);
  const [searchPending, startSearchTransition] = useTransition();

  // ── Save action state ──────────────────────────────────────────────────────
  const initialActionState: ResearchActionState = { error: null, savedAt: research?.updatedAt?.toISOString() ?? null };
  const [saveState, saveFormAction, isSaving] = useActionState(saveResearchDraftAction, initialActionState);
  const [decisionPending, startDecisionTransition] = useTransition();
  const [decisionError, setDecisionError] = useState<string | null>(null);

  // ── Build FormData from current state ─────────────────────────────────────
  const buildFormData = useCallback(() => {
    const fd = new FormData();
    fd.append("projectId", project.id);
    fd.append("targetPopulationSize", targetPopulationSize);
    fd.append("referralOrgs", referralOrgs);
    fd.append("expectedResidentsPerMonth", expectedResidentsPerMonth);
    fd.append("demandEvidenceNotes", demandEvidenceNotes);
    fd.append("demandRating", demandRating);
    fd.append("fundingSource", fundingSource);
    fd.append("expectedPaymentPerResident", expectedPaymentPerResident);
    fd.append("expectedResidentContribution", expectedResidentContribution);
    fd.append("expectedOccupancy", expectedOccupancy);
    fd.append("estimatedMonthlyRevenue", estimatedMonthlyRevenue);
    fd.append("fundingNotes", fundingNotes);
    fd.append("targetPropertyType", targetPropertyType);
    fd.append("minimumBedrooms", minimumBedrooms);
    fd.append("maxAcceptableLease", maxAcceptableLease);
    fd.append("estimatedUtilities", estimatedUtilities);
    fd.append("estimatedFurnishingCost", estimatedFurnishingCost);
    fd.append("expectedPrivateRoomCapacity", expectedPrivateRoomCapacity);
    fd.append("otherMonthlyCosts", otherMonthlyCosts);
    fd.append("estimatedRentalInventory", estimatedRentalInventory);
    fd.append("typicalLocalRent", typicalLocalRent);
    fd.append("avgDaysListed", avgDaysListed);
    fd.append("tiredOwnerIndicators", tiredOwnerIndicators);
    fd.append("landlordOutreachNotes", landlordOutreachNotes);
    fd.append("supplySourceLinks", supplySourceLinks);
    fd.append("transportationAccess", transportationAccess);
    fd.append("vaMedicalServices", vaMedicalServices);
    fd.append("groceryEssentialServices", groceryEssentialServices);
    fd.append("referralPartnerProximity", referralPartnerProximity);
    fd.append("zoningConcerns", zoningConcerns);
    fd.append("neighborhoodConcerns", neighborhoodConcerns);
    fd.append("locationNotes", locationNotes);
    if (riskFundingUncertainty) fd.append("riskFundingUncertainty", "true");
    if (riskInsufficientSupply) fd.append("riskInsufficientSupply", "true");
    if (riskRentTooHigh) fd.append("riskRentTooHigh", "true");
    if (riskRegulatoryIssue) fd.append("riskRegulatoryIssue", "true");
    if (riskWeakReferralPipeline) fd.append("riskWeakReferralPipeline", "true");
    if (riskOther) fd.append("riskOther", "true");
    fd.append("riskMitigationNotes", riskMitigationNotes);
    fd.append("holdReason", holdReason);
    return fd;
  }, [
    project.id, targetPopulationSize, referralOrgs, expectedResidentsPerMonth,
    demandEvidenceNotes, demandRating, fundingSource, expectedPaymentPerResident,
    expectedResidentContribution, expectedOccupancy, estimatedMonthlyRevenue,
    fundingNotes, targetPropertyType, minimumBedrooms, maxAcceptableLease,
    estimatedUtilities, estimatedFurnishingCost, expectedPrivateRoomCapacity,
    otherMonthlyCosts,
    estimatedRentalInventory, typicalLocalRent, avgDaysListed, tiredOwnerIndicators,
    landlordOutreachNotes, supplySourceLinks, transportationAccess, vaMedicalServices,
    groceryEssentialServices, referralPartnerProximity, zoningConcerns, neighborhoodConcerns,
    locationNotes, riskFundingUncertainty, riskInsufficientSupply, riskRentTooHigh,
    riskRegulatoryIssue, riskWeakReferralPipeline, riskOther, riskMitigationNotes,
    holdReason,
  ]);

  // ── Auto-save: debounce 800 ms after any field change ─────────────────────
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      setAutoSaveStatus("saving");
      try {
        const result = await saveResearchDraftAction(
          { error: null, savedAt: null },
          buildFormData()
        );
        if (result.error) {
          setAutoSaveStatus("failed");
        } else {
          setAutoSaveStatus("saved");
          if (result.savedAt) setLastSavedAt(result.savedAt);
        }
      } catch {
        setAutoSaveStatus("failed");
      }
    }, 800);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [buildFormData]);

  // ── Margin calculation ─────────────────────────────────────────────────────
  const marginBreakdown = calculateMonthlyMargin(
    expectedPaymentPerResident,
    expectedPrivateRoomCapacity,
    expectedOccupancy,   // this is occupancy % (e.g. "85")
    maxAcceptableLease,
    estimatedUtilities,
    otherMonthlyCosts
  );

  // ── Completion tracking (uses shared validation module) ───────────────────
  const approvalFieldValues: Record<string, string> = {
    demandRating,
    demandEvidenceNotes,
    fundingSource,
    expectedPaymentPerResident,
    expectedOccupancy,
    expectedPrivateRoomCapacity,
    maxAcceptableLease,
    estimatedRentalInventory,
    supplySourceLinks,
    transportationAccess,
    locationNotes,
  };
  const anyRiskChecked = riskFundingUncertainty || riskInsufficientSupply || riskRentTooHigh ||
    riskRegulatoryIssue || riskWeakReferralPipeline || riskOther;
  const approvalCheck = checkApprovalRequirements(approvalFieldValues, anyRiskChecked, riskMitigationNotes);
  const totalSlots = REQUIRED_FIELDS.length + OR_GROUPS.length; // 9
  const completionPct = Math.round(
    ((totalSlots - approvalCheck.missing.length) / totalSlots) * 100
  );

  // ── Unified save status (manual + auto-save) ──────────────────────────────
  let displaySaveStatus = "";
  let displaySaveColor = "#166534";
  if (isSaving || autoSaveStatus === "saving") {
    displaySaveStatus = "Saving…";
    displaySaveColor = "var(--color-text)";
  } else if (autoSaveStatus === "failed" || saveState.error) {
    displaySaveStatus = "Save failed";
    displaySaveColor = "#991B1B";
  } else if (autoSaveStatus === "saved") {
    displaySaveStatus = "Saved";
    displaySaveColor = "#166534";
  } else if (saveState.savedAt) {
    const d = new Date(saveState.savedAt);
    displaySaveStatus = `Saved ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    displaySaveColor = "#166534";
  }

  // ── Decision handlers ──────────────────────────────────────────────────────
  function handleApprove() {
    setDecisionError(null);
    startDecisionTransition(async () => {
      const result = await approveMarketAction({ error: null, savedAt: null }, buildFormData());
      if (result.error) setDecisionError(result.error);
    });
  }

  function handleHold() {
    if (!showHoldForm) {
      setShowHoldForm(true);
      return;
    }
    if (!holdReason.trim()) {
      setDecisionError("A hold reason is required.");
      return;
    }
    setDecisionError(null);
    startDecisionTransition(async () => {
      const result = await holdResearchAction({ error: null, savedAt: null }, buildFormData());
      if (result.error) setDecisionError(result.error);
      else setShowHoldForm(false);
    });
  }

  function handleReject() {
    setDecisionError(null);
    if (!window.confirm("Reject this market? The project will be closed.")) return;
    startDecisionTransition(async () => {
      const result = await rejectMarketAction({ error: null, savedAt: null }, buildFormData());
      if (result.error) setDecisionError(result.error);
    });
  }

  // ── Test property search ───────────────────────────────────────────────────
  function handleTestSearch() {
    setSearchError(null);
    setSearchResults([]);
    setSearchTotal(null);
    const parts = project.community.split(",").map((s) => s.trim());
    const city = parts[0] ?? "";
    const state = parts[1] ?? "";
    startSearchTransition(async () => {
      const result = await testPropertySearchAction(
        project.id,
        city,
        state,
        minimumBedrooms,
        maxAcceptableLease
      );
      setSearchResults(result.listings);
      setSearchError(result.error);
      setSearchTotal(result.totalFound);
    });
  }

  const effectiveSavedAt = saveState.savedAt ?? lastSavedAt;
  const lastSaved = effectiveSavedAt
    ? new Date(effectiveSavedAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" })
    : null;

  return (
    <div>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--color-primary)", margin: 0 }}>
          Market Research
        </h1>
        <p style={{ fontSize: "0.875rem", color: "var(--color-text)", opacity: 0.6, marginTop: "0.25rem" }}>
          {project.name} · {project.community}
        </p>
      </div>

      {/* ── Project Summary ─────────────────────────────────────────────── */}
      <div style={cardStyle}>
        <p style={sectionHeadingStyle}>Project Summary</p>
        <div style={gridStyle}>
          <div>
            <p style={{ ...labelStyle, marginBottom: "0.1rem" }}>Project</p>
            <p style={{ fontSize: "0.875rem", color: "var(--color-text)", margin: 0 }}>{project.name}</p>
          </div>
          <div>
            <p style={{ ...labelStyle, marginBottom: "0.1rem" }}>Target Market</p>
            <p style={{ fontSize: "0.875rem", color: "var(--color-text)", margin: 0 }}>{project.community}</p>
          </div>
          <div>
            <p style={{ ...labelStyle, marginBottom: "0.1rem" }}>Status</p>
            <p style={{ fontSize: "0.875rem", color: "var(--color-text)", margin: 0 }}>{project.currentStatus.replace(/_/g, " ")}</p>
          </div>
          {lastSaved && (
            <div>
              <p style={{ ...labelStyle, marginBottom: "0.1rem" }}>Last Saved</p>
              <p style={{ fontSize: "0.875rem", color: "var(--color-text)", margin: 0 }}>{lastSaved}</p>
            </div>
          )}
        </div>

        {/* Completion progress */}
        <div style={{ marginTop: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", marginBottom: "0.25rem" }}>
            <span style={{ color: "var(--color-text)", opacity: 0.6 }}>Approval readiness</span>
            <span style={{ fontWeight: 600, color: completionPct === 100 ? "#166534" : "var(--color-text)" }}>
              {completionPct}%
            </span>
          </div>
          <div style={{ height: "6px", borderRadius: "3px", backgroundColor: "var(--color-border)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${completionPct}%`, backgroundColor: completionPct === 100 ? "#16a34a" : "var(--color-action)", transition: "width 0.3s ease" }} />
          </div>
          {approvalCheck.missing.length > 0 && (
            <p style={{ fontSize: "0.75rem", color: "#991B1B", marginTop: "0.375rem" }}>
              Missing: {approvalCheck.missing.map((m) => m.label).join(", ")}
            </p>
          )}
        </div>
      </div>

      {/* ── Main form ───────────────────────────────────────────────────── */}
      <form action={saveFormAction}>
        <input type="hidden" name="projectId" value={project.id} />

        {/* Section 2: Housing Demand */}
        <div style={cardStyle}>
          <p style={sectionHeadingStyle}>Housing Demand</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
            <div style={gridStyle}>
              <Field label="Target Population Size" name="targetPopulationSize" value={targetPopulationSize} onChange={setTargetPopulationSize} placeholder="e.g. 500 veterans in the area" />
              <Field label="Expected Residents / Month" name="expectedResidentsPerMonth" value={expectedResidentsPerMonth} onChange={setExpectedResidentsPerMonth} placeholder="e.g. 3-5" />
            </div>
            <TextArea label="Referral Organizations & Caseworkers" name="referralOrgs" value={referralOrgs} onChange={setReferralOrgs} placeholder="List referral organizations and key contacts…" rows={3} />
            <TextArea label="Evidence / Source Notes" name="demandEvidenceNotes" value={demandEvidenceNotes} onChange={setDemandEvidenceNotes} placeholder="Where is demand data coming from?" rows={2} />
            <div>
              <label style={labelStyle}>Demand Rating *</label>
              <select
                name="demandRating"
                value={demandRating}
                onChange={(e) => setDemandRating(e.target.value)}
                style={inputStyle}
              >
                <option value="">— Select —</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 3: Funding & Revenue */}
        <div style={cardStyle}>
          <p style={sectionHeadingStyle}>Funding & Revenue</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
            <Field label="Primary Funding / Program Source *" name="fundingSource" value={fundingSource} onChange={setFundingSource} placeholder="e.g. HUD VASH, TBRA, Medicaid waiver" />
            <div style={gridStyle}>
              <Field label="Expected Payment / Resident ($)" name="expectedPaymentPerResident" value={expectedPaymentPerResident} onChange={setExpectedPaymentPerResident} placeholder="e.g. 1200" />
              <Field label="Expected Resident Contribution ($)" name="expectedResidentContribution" value={expectedResidentContribution} onChange={setExpectedResidentContribution} placeholder="e.g. 150" />
              <Field label="Occupancy Rate (%)" name="expectedOccupancy" value={expectedOccupancy} onChange={setExpectedOccupancy} placeholder="e.g. 85" />
              <Field label="Estimated Monthly Revenue ($)" name="estimatedMonthlyRevenue" value={estimatedMonthlyRevenue} onChange={setEstimatedMonthlyRevenue} placeholder="Auto or manual" />
            </div>
            <TextArea label="Deposit, Payment Timing & Funding Requirements" name="fundingNotes" value={fundingNotes} onChange={setFundingNotes} placeholder="Notes about deposits, payment schedule, eligibility requirements…" rows={2} />
          </div>
        </div>

        {/* Section 4: Property Economics */}
        <div style={cardStyle}>
          <p style={sectionHeadingStyle}>Property Economics</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
            <div style={gridStyle}>
              <Field label="Target Property Type" name="targetPropertyType" value={targetPropertyType} onChange={setTargetPropertyType} placeholder="e.g. Single family, multi-family" />
              <Field label="Minimum Bedrooms" name="minimumBedrooms" value={minimumBedrooms} onChange={setMinimumBedrooms} placeholder="e.g. 4" />
              <Field label="Max Acceptable Monthly Lease ($) *" name="maxAcceptableLease" value={maxAcceptableLease} onChange={setMaxAcceptableLease} placeholder="e.g. 2800" />
              <Field label="Estimated Monthly Utilities ($)" name="estimatedUtilities" value={estimatedUtilities} onChange={setEstimatedUtilities} placeholder="e.g. 350" />
              <Field label="Estimated Prep / Furnishing Cost ($)" name="estimatedFurnishingCost" value={estimatedFurnishingCost} onChange={setEstimatedFurnishingCost} placeholder="e.g. 5000" />
              <Field label="Expected Private Room Capacity" name="expectedPrivateRoomCapacity" value={expectedPrivateRoomCapacity} onChange={setExpectedPrivateRoomCapacity} placeholder="e.g. 4 rooms" />
              <Field label="Other Monthly Costs ($)" name="otherMonthlyCosts" value={otherMonthlyCosts} onChange={setOtherMonthlyCosts} placeholder="e.g. 200 (insurance, misc)" />
            </div>
            {marginBreakdown !== null && (
              <div style={{ backgroundColor: marginBreakdown.margin >= 0 ? "#f0fdf4" : "#fef2f2", border: `1px solid ${marginBreakdown.margin >= 0 ? "#bbf7d0" : "#fecaca"}`, borderRadius: "0.5rem", padding: "0.75rem 1rem" }}>
                <p style={{ fontSize: "0.8rem", fontWeight: 700, color: marginBreakdown.margin >= 0 ? "#166534" : "#991B1B", margin: "0 0 0.5rem" }}>
                  Estimated Monthly Margin: {marginBreakdown.margin >= 0 ? "+" : ""}${marginBreakdown.margin.toFixed(0)}
                </p>
                <div style={{ fontSize: "0.72rem", color: "var(--color-text)", opacity: 0.65, lineHeight: 1.7 }}>
                  <div>{expectedPrivateRoomCapacity} rooms × {expectedOccupancy}% occupancy = <strong>{marginBreakdown.occupiedResidents.toFixed(1)} occupied residents</strong></div>
                  <div>${expectedPaymentPerResident}/resident × {marginBreakdown.occupiedResidents.toFixed(1)} = <strong>${marginBreakdown.revenue.toFixed(0)} revenue</strong></div>
                  <div>${marginBreakdown.revenue.toFixed(0)} − ${maxAcceptableLease} lease − ${estimatedUtilities || "0"} utilities − ${otherMonthlyCosts || "0"} other = <strong>${marginBreakdown.margin.toFixed(0)} margin</strong></div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Section 5: Property Supply */}
        <div style={cardStyle}>
          <p style={sectionHeadingStyle}>Property Supply</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
            <div style={gridStyle}>
              <Field label="Estimated Suitable Rental Inventory" name="estimatedRentalInventory" value={estimatedRentalInventory} onChange={setEstimatedRentalInventory} placeholder="e.g. 50 listings" />
              <Field label="Typical Local Rent ($)" name="typicalLocalRent" value={typicalLocalRent} onChange={setTypicalLocalRent} placeholder="e.g. 1800" />
              <Field label="Average Days Listed" name="avgDaysListed" value={avgDaysListed} onChange={setAvgDaysListed} placeholder="e.g. 45" />
            </div>
            <TextArea label="Tired-Owner Opportunity Indicators" name="tiredOwnerIndicators" value={tiredOwnerIndicators} onChange={setTiredOwnerIndicators} placeholder="e.g. Extended listing age, non-owner-occupied properties, older housing stock…" rows={2} />
            <TextArea label="Landlord / Owner Outreach Notes" name="landlordOutreachNotes" value={landlordOutreachNotes} onChange={setLandlordOutreachNotes} placeholder="Outreach strategy, initial contacts made…" rows={2} />
            <TextArea label="Source / Evidence Links (one per line)" name="supplySourceLinks" value={supplySourceLinks} onChange={setSupplySourceLinks} placeholder="https://..." rows={2} />

            {/* Test Property Search */}
            <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: "0.875rem", marginTop: "0.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem", marginBottom: "0.875rem" }}>
                <div>
                  <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--color-primary)", margin: 0 }}>Test Property Search</p>
                  <p style={{ fontSize: "0.75rem", color: "var(--color-text)", opacity: 0.6, margin: "0.2rem 0 0" }}>
                    Preview RentCast listings for {project.community} using your criteria above. Does not create leads or advance project status.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleTestSearch}
                  disabled={searchPending}
                  style={{
                    backgroundColor: "var(--color-surface-soft)",
                    color: "var(--color-primary)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "0.5rem",
                    padding: "0.5rem 1rem",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    cursor: searchPending ? "not-allowed" : "pointer",
                    opacity: searchPending ? 0.6 : 1,
                    whiteSpace: "nowrap",
                  }}
                >
                  {searchPending ? "Searching…" : "Test Property Search"}
                </button>
              </div>

              {searchError && (
                <p role="alert" style={{ fontSize: "0.8rem", color: "#991B1B", margin: "0 0 0.5rem" }}>
                  {searchError}
                </p>
              )}

              {searchTotal !== null && !searchError && (
                <p style={{ fontSize: "0.75rem", color: "var(--color-text)", opacity: 0.6, margin: "0 0 0.75rem" }}>
                  Showing {searchResults.length} of {searchTotal} results (preview only)
                </p>
              )}

              {searchResults.length > 0 && (
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.625rem" }}>
                  {searchResults.map((listing) => (
                    <li key={listing.id} style={{ fontSize: "0.8rem", padding: "0.625rem 0.75rem", backgroundColor: "var(--color-surface-soft)", borderRadius: "0.5rem", border: "1px solid var(--color-border)" }}>
                      <div style={{ fontWeight: 600, color: "var(--color-primary)", marginBottom: "0.2rem" }}>{listing.formattedAddress}</div>
                      <div style={{ color: "var(--color-text)", opacity: 0.75 }}>
                        {listing.propertyType} · {listing.bedrooms ?? "?"} bed · {listing.bathrooms ?? "?"} bath
                        {listing.price ? ` · $${listing.price.toLocaleString()}/mo` : ""}
                        {listing.daysOnMarket != null ? ` · ${listing.daysOnMarket}d listed` : ""}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Section 6: Location Suitability */}
        <div style={cardStyle}>
          <p style={sectionHeadingStyle}>Location Suitability</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
            <div style={gridStyle}>
              <Field label="Transportation Access" name="transportationAccess" value={transportationAccess} onChange={setTransportationAccess} placeholder="e.g. Bus routes, metro access" />
              <Field label="VA / Medical Services" name="vaMedicalServices" value={vaMedicalServices} onChange={setVaMedicalServices} placeholder="e.g. VA clinic 2 miles" />
              <Field label="Grocery & Essential Services" name="groceryEssentialServices" value={groceryEssentialServices} onChange={setGroceryEssentialServices} placeholder="e.g. Grocery within 0.5mi" />
              <Field label="Referral-Partner Proximity" name="referralPartnerProximity" value={referralPartnerProximity} onChange={setReferralPartnerProximity} placeholder="e.g. Social services office 1 mile" />
            </div>
            <TextArea label="Zoning / Licensing Concerns" name="zoningConcerns" value={zoningConcerns} onChange={setZoningConcerns} placeholder="Any zoning or licensing issues for group housing?" rows={2} />
            <TextArea label="Neighborhood / Safety Concerns" name="neighborhoodConcerns" value={neighborhoodConcerns} onChange={setNeighborhoodConcerns} placeholder="Concerns about safety, neighborhood suitability…" rows={2} />
            <TextArea label="Notes" name="locationNotes" value={locationNotes} onChange={setLocationNotes} placeholder="Additional location context…" rows={2} />
          </div>
        </div>

        {/* Section 7: Risks & Blockers */}
        <div style={cardStyle}>
          <p style={sectionHeadingStyle}>Risks & Blockers</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem", marginBottom: "1rem" }}>
            <RiskCheckbox label="Funding uncertainty" name="riskFundingUncertainty" checked={riskFundingUncertainty} onChange={setRiskFundingUncertainty} />
            <RiskCheckbox label="Insufficient property supply" name="riskInsufficientSupply" checked={riskInsufficientSupply} onChange={setRiskInsufficientSupply} />
            <RiskCheckbox label="Rent too high" name="riskRentTooHigh" checked={riskRentTooHigh} onChange={setRiskRentTooHigh} />
            <RiskCheckbox label="Regulatory issue" name="riskRegulatoryIssue" checked={riskRegulatoryIssue} onChange={setRiskRegulatoryIssue} />
            <RiskCheckbox label="Weak referral pipeline" name="riskWeakReferralPipeline" checked={riskWeakReferralPipeline} onChange={setRiskWeakReferralPipeline} />
            <RiskCheckbox label="Other blocker" name="riskOther" checked={riskOther} onChange={setRiskOther} />
          </div>
          <TextArea label="Mitigation Notes" name="riskMitigationNotes" value={riskMitigationNotes} onChange={setRiskMitigationNotes} placeholder="How will these risks be mitigated?" rows={3} />
        </div>

        {/* Save row */}
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem" }}>
          <button
            type="submit"
            disabled={isSaving}
            style={{
              backgroundColor: "var(--color-action)",
              color: "#fff",
              border: "none",
              borderRadius: "0.5rem",
              padding: "0.625rem 1.25rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: isSaving ? "not-allowed" : "pointer",
              opacity: isSaving ? 0.6 : 1,
            }}
          >
            {isSaving ? "Saving…" : "Save Progress"}
          </button>
          {displaySaveStatus && (
            <span
              style={{ fontSize: "0.8rem", color: displaySaveColor }}
              role={autoSaveStatus === "failed" || saveState.error ? "alert" : undefined}
              aria-live="polite"
            >
              {displaySaveStatus}
            </span>
          )}
        </div>
      </form>

      {/* ── Market Decision ──────────────────────────────────────────────── */}
      <div style={{ ...cardStyle, borderColor: "var(--color-primary)" }}>
        <p style={sectionHeadingStyle}>Market Decision</p>
        <p style={{ fontSize: "0.875rem", color: "var(--color-text)", opacity: 0.7, marginBottom: "1rem" }}>
          Save your research before making a decision. Approval requires all key fields to be completed.
        </p>

        {(saveState.error || decisionError) && (
          <div
            role="alert"
            style={{
              backgroundColor: "#FEF2F2",
              border: "1px solid #FECACA",
              borderRadius: "0.5rem",
              padding: "0.75rem 1rem",
              marginBottom: "1rem",
              fontSize: "0.875rem",
              color: "#991B1B",
            }}
          >
            {saveState.error || decisionError}
          </div>
        )}

        {showHoldForm && (
          <div style={{ marginBottom: "1rem" }}>
            <label style={labelStyle}>Hold Reason (required)</label>
            <textarea
              name="holdReason"
              value={holdReason}
              onChange={(e) => setHoldReason(e.target.value)}
              rows={2}
              placeholder="Why is research being paused? What needs to happen before resuming?"
              style={textareaStyle}
            />
          </div>
        )}

        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={handleApprove}
            disabled={decisionPending || !approvalCheck.canApprove}
            title={!approvalCheck.canApprove ? `Missing: ${approvalCheck.missing.map((m) => m.label).join(", ")}` : "Approve this market"}
            style={{
              backgroundColor: approvalCheck.canApprove ? "#16a34a" : "#9ca3af",
              color: "#fff",
              border: "none",
              borderRadius: "0.5rem",
              padding: "0.625rem 1.25rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: decisionPending || !approvalCheck.canApprove ? "not-allowed" : "pointer",
              opacity: decisionPending ? 0.6 : 1,
            }}
          >
            {decisionPending ? "Processing…" : "✓ Approve Market"}
          </button>

          <button
            type="button"
            onClick={handleHold}
            disabled={decisionPending}
            style={{
              backgroundColor: "#fff",
              color: "#854D0E",
              border: "1px solid #FCD34D",
              borderRadius: "0.5rem",
              padding: "0.625rem 1.25rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: decisionPending ? "not-allowed" : "pointer",
              opacity: decisionPending ? 0.6 : 1,
            }}
          >
            {showHoldForm ? "Confirm Hold" : "Pause Research"}
          </button>

          {showHoldForm && (
            <button
              type="button"
              onClick={() => { setShowHoldForm(false); setDecisionError(null); }}
              style={{
                backgroundColor: "#fff",
                color: "var(--color-text)",
                border: "1px solid var(--color-border)",
                borderRadius: "0.5rem",
                padding: "0.625rem 1rem",
                fontSize: "0.875rem",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          )}

          <button
            type="button"
            onClick={handleReject}
            disabled={decisionPending}
            style={{
              backgroundColor: "#fff",
              color: "#991B1B",
              border: "1px solid #FECACA",
              borderRadius: "0.5rem",
              padding: "0.625rem 1.25rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: decisionPending ? "not-allowed" : "pointer",
              opacity: decisionPending ? 0.6 : 1,
            }}
          >
            Reject Market
          </button>
        </div>
      </div>
    </div>
  );
}
