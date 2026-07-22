/**
 * BlockerAlert — Amber/warning callout for a project blocker.
 *
 * Accessibility: role="alert" + aria-live="polite" so screen readers
 * announce the blocker when it appears. Text + icon — color is not the sole indicator.
 */
interface Props {
  blocker: string;
}

export default function BlockerAlert({ blocker }: Props) {
  return (
    <div
      role="alert"
      aria-live="polite"
      className="flex gap-3 rounded-lg px-4 py-3.5 text-sm leading-6"
      style={{
        backgroundColor: "#FEF3C7",           /* amber-100 */
        borderLeft: "4px solid var(--color-action)",
        color: "var(--color-text)",
      }}
    >
      {/* Warning icon — not solely relied on; text carries the meaning */}
      <span aria-hidden="true" className="shrink-0 text-base" style={{ color: "var(--color-action)" }}>
        ⚠
      </span>
      <div>
        <span className="font-semibold" style={{ color: "var(--color-action)" }}>
          Blocker:{" "}
        </span>
        {blocker}
      </div>
    </div>
  );
}
