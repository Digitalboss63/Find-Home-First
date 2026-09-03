import { describe, expect, it } from "vitest";
import { formatUsdFromCents, parseRefundAmountToCents } from "@/lib/refund-utils";

describe("refund amount parsing", () => {
  it("uses the full remaining amount when blank", () => {
    expect(parseRefundAmountToCents("", 4999)).toBe(4999);
    expect(parseRefundAmountToCents(null, 100)).toBe(100);
  });

  it("parses whole-dollar and decimal partial refunds", () => {
    expect(parseRefundAmountToCents("1", 4999)).toBe(100);
    expect(parseRefundAmountToCents("1.5", 4999)).toBe(150);
    expect(parseRefundAmountToCents("1.05", 4999)).toBe(105);
  });

  it("rejects zero, malformed, over-limit, and over-precision values", () => {
    expect(parseRefundAmountToCents("0", 4999)).toBeNull();
    expect(parseRefundAmountToCents("abc", 4999)).toBeNull();
    expect(parseRefundAmountToCents("50", 4999)).toBeNull();
    expect(parseRefundAmountToCents("1.005", 4999)).toBeNull();
  });

  it("rejects a charge with no refundable balance", () => {
    expect(parseRefundAmountToCents("", 0)).toBeNull();
  });
});

describe("refund currency formatting", () => {
  it("formats cents as USD", () => {
    expect(formatUsdFromCents(100)).toBe("$1.00");
    expect(formatUsdFromCents(4999)).toBe("$49.99");
  });
});
