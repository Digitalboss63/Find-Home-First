/**
 * StageJourney — Five-stage placement progress stepper.
 * Visual centerpiece of the project workspace and home page summary.
 *
 * Accessibility:
 * - aria-current="step" on the active stage
 * - State conveyed via text labels, not color alone
 */
import { STAGES, type StageKey } from "@/lib/stages";

interface Props {
  currentStage: StageKey;
  /** When true, renders a more compact version for the home page summary */
  compact?: boolean;
}

export default function StageJourney({ currentStage, compact = false }: Props) {
  const currentIndex =
    currentStage === "complete"
      ? STAGES.length
      : STAGES.findIndex((s) => s.key === currentStage);

  return (
    <div aria-label="Placement journey stages" className="w-full">
      {/* ── Circles + connector lines row ─────────────────────────── */}
      <div
        role="list"
        className="grid"
        style={{ gridTemplateColumns: `repeat(${STAGES.length}, 1fr)` }}
      >
        {STAGES.map((stage, i) => {
          const done = i < currentIndex;
          const active = i === currentIndex;

          // Connector line color: filled up to and including the active step
          const leftLineColor =
            done || active ? "var(--color-secondary)" : "var(--color-border)";
          const rightLineColor = done
            ? "var(--color-secondary)"
            : "var(--color-border)";

          // Circle styles
          const circleBg = done
            ? "var(--color-secondary)"
            : active
            ? "var(--color-action)"
            : "transparent";
          const circleBorder = done
            ? "var(--color-secondary)"
            : active
            ? "var(--color-action)"
            : "var(--color-border)";
          // Upcoming steps must remain readable. The border token is intentionally
          // light and only suitable for decoration; using it for text produced a
          // contrast ratio of roughly 1.3:1 on the journey panel.
          const circleColor =
            done || active ? "#fff" : "var(--color-text-muted)";

          return (
            <div
              key={stage.key}
              role="listitem"
              aria-current={active ? "step" : undefined}
              className="flex flex-col items-center relative"
            >
              {/* Left half connector */}
              {i > 0 && (
                <div
                  className="absolute left-0 right-1/2 h-0.5"
                  style={{
                    top: "16px",
                    transform: "translateY(-50%)",
                    backgroundColor: leftLineColor,
                  }}
                  aria-hidden="true"
                />
              )}
              {/* Right half connector */}
              {i < STAGES.length - 1 && (
                <div
                  className="absolute left-1/2 right-0 h-0.5"
                  style={{
                    top: "16px",
                    transform: "translateY(-50%)",
                    backgroundColor: rightLineColor,
                  }}
                  aria-hidden="true"
                />
              )}

              {/* Step circle */}
              <div
                className="relative z-10 w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold shrink-0"
                style={{
                  backgroundColor: circleBg,
                  borderColor: circleBorder,
                  color: circleColor,
                  boxShadow: active
                    ? `0 0 0 3px var(--color-background), 0 0 0 5px var(--color-action)`
                    : "none",
                }}
              >
                {done ? (
                  <span aria-label="completed">✓</span>
                ) : (
                  <span aria-hidden="true">{i + 1}</span>
                )}
              </div>

              {/* Stage label */}
              {!compact && (
                <span
                  className="mt-2 text-[11px] text-center leading-tight px-0.5 font-medium"
                  style={{
                    color:
                      done || active
                        ? "var(--color-text)"
                        : "var(--color-text-muted)",
                  }}
                >
                  {stage.label}
                  <span className="sr-only">
                    {done
                      ? " — completed"
                      : active
                      ? " — current step"
                      : " — upcoming"}
                  </span>
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Compact mode: show current stage name below */}
      {compact && (
        <p
          className="mt-3 text-sm font-medium text-center"
          style={{ color: "var(--color-text)" }}
        >
          {currentStage === "complete" ? (
            <span style={{ color: "#166534" }}>✓ Placement complete</span>
          ) : (
            <>
              Current stage:{" "}
              <span style={{ color: "var(--color-action)" }}>
                {STAGES[currentIndex]?.label}
              </span>
            </>
          )}
        </p>
      )}
    </div>
  );
}
