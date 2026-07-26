"use client";

import { useActionState } from "react";
import { createProjectAction, type CreateProjectState } from "./actions";

const fieldStyle: React.CSSProperties = {
  backgroundColor: "#fff",
  border: "1px solid var(--color-border)",
  borderRadius: "0.5rem",
  color: "var(--color-text)",
  padding: "0.5rem 0.75rem",
  fontSize: "0.875rem",
  width: "100%",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.75rem",
  fontWeight: 600,
  marginBottom: "0.375rem",
  color: "var(--color-text)",
  opacity: 0.65,
};

const initialState: CreateProjectState = { error: null };

export default function NewProjectForm() {
  const [state, formAction, isPending] = useActionState(
    createProjectAction,
    initialState
  );

  return (
    <form action={formAction} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Name */}
        <div className="sm:col-span-2">
          <label htmlFor="pn-name" style={labelStyle}>
            Project name *
          </label>
          <input
            type="text"
            id="pn-name"
            name="name"
            required
            placeholder="e.g. Johnson Family Placement"
            style={fieldStyle}
            aria-describedby={state.error ? "form-error" : undefined}
          />
        </div>

        {/* Target City */}
        <div>
          <label htmlFor="pn-city" style={labelStyle}>
            Target city *
          </label>
          <input
            type="text"
            id="pn-city"
            name="targetCity"
            required
            placeholder="e.g. Atlanta"
            style={fieldStyle}
            aria-describedby={state.error ? "form-error" : undefined}
          />
        </div>

        {/* State */}
        <div>
          <label htmlFor="pn-state" style={labelStyle}>
            State *
          </label>
          <input
            type="text"
            id="pn-state"
            name="state"
            required
            maxLength={2}
            placeholder="GA"
            style={fieldStyle}
            onChange={(e) => {
              e.target.value = e.target.value.toUpperCase();
            }}
            aria-describedby={state.error ? "form-error" : undefined}
          />
        </div>

        {/* Service radius */}
        <div>
          <label htmlFor="pn-radius" style={labelStyle}>
            Service radius (miles)
          </label>
          <input
            type="number"
            id="pn-radius"
            name="radiusMiles"
            min={1}
            max={200}
            placeholder="e.g. 10"
            style={fieldStyle}
          />
        </div>

        {/* Target demographic */}
        <div>
          <label htmlFor="pn-demo" style={labelStyle}>
            Target demographic
          </label>
          <input
            type="text"
            id="pn-demo"
            name="demographic"
            placeholder="e.g. Single adults, families"
            style={fieldStyle}
          />
        </div>

        {/* Private space standard */}
        <div className="sm:col-span-2">
          <label htmlFor="pn-pss" style={labelStyle}>
            Private-space standard
          </label>
          <input
            type="text"
            id="pn-pss"
            name="privateSpaceStandard"
            placeholder="e.g. Private bedroom required"
            style={fieldStyle}
          />
        </div>

        {/* Notes */}
        <div className="sm:col-span-2">
          <label htmlFor="pn-notes" style={labelStyle}>
            Notes
          </label>
          <textarea
            id="pn-notes"
            name="notes"
            rows={3}
            style={{ ...fieldStyle, resize: "vertical" }}
            placeholder="Any additional context for this project…"
          />
        </div>
      </div>

      {state.error && (
        <p
          id="form-error"
          className="text-sm rounded-lg px-3 py-2"
          style={{
            backgroundColor: "#FEF2F2",
            color: "#991B1B",
            border: "1px solid #FECACA",
          }}
          role="alert"
          aria-live="assertive"
        >
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          style={{ backgroundColor: "var(--color-action)" }}
        >
          {isPending ? "Creating…" : "Create Placement Project"}
        </button>
      </div>
    </form>
  );
}
