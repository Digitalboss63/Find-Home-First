import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const component = readFileSync(
  join(root, "src/components/StageJourney.tsx"),
  "utf8",
);
const globalStyles = readFileSync(join(root, "src/app/globals.css"), "utf8");

function tokenHex(token: string): string {
  const match = globalStyles.match(
    new RegExp(`--${token}:\\s*(#[0-9A-Fa-f]{6})`),
  );
  if (!match) throw new Error(`Missing CSS token: ${token}`);
  return match[1];
}

function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map((offset) =>
    Number.parseInt(hex.slice(offset, offset + 2), 16) / 255,
  );
  const linear = channels.map((value) =>
    value <= 0.04045
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrastRatio(foreground: string, background: string): number {
  const first = relativeLuminance(foreground);
  const second = relativeLuminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

describe("StageJourney upcoming-stage readability", () => {
  it("uses the readable muted-text token instead of the decorative border token", () => {
    expect(component).toContain(
      'done || active ? "#fff" : "var(--color-text-muted)"',
    );
    expect(component).toContain(': "var(--color-text-muted)"');
    expect(component).not.toContain(
      'done || active ? "var(--color-text)" : "var(--color-border)"',
    );
  });

  it("meets WCAG AA normal-text contrast on the journey panel", () => {
    const ratio = contrastRatio(
      tokenHex("color-text-muted"),
      tokenHex("color-surface-soft"),
    );
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
});
