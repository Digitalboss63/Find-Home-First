export function parseRefundAmountToCents(
  value: string | null | undefined,
  remainingCents: number
): number | null {
  if (!Number.isInteger(remainingCents) || remainingCents <= 0) return null;

  const normalized = value?.trim() ?? "";
  if (!normalized) return remainingCents;
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;

  const [whole, fraction = ""] = normalized.split(".");
  const cents = Number.parseInt(whole, 10) * 100 + Number.parseInt(fraction.padEnd(2, "0") || "0", 10);

  if (!Number.isSafeInteger(cents) || cents <= 0 || cents > remainingCents) {
    return null;
  }

  return cents;
}

export function formatUsdFromCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}
