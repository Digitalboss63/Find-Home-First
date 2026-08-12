import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("platform-owner Back Office navigation", () => {
  const layout = read("src/app/layout.tsx");
  const shell = read("src/components/AppShell.tsx");
  const backOfficeLayout = read("src/app/back-office/layout.tsx");
  const overview = read("src/app/back-office/page.tsx");

  it("derives platform-owner visibility on the server", () => {
    expect(layout).toContain("isPlatformOwner()");
    expect(layout).toContain("showBackOffice={platformOwner}");
  });

  it("shows the Back Office entry only when the owner flag is true", () => {
    expect(shell).toContain("showBackOffice");
    expect(shell).toContain('href: "/back-office"');
    expect(shell).toContain("const items = showBackOffice");
  });

  it("does not expose the platform-owner environment variable to the client shell", () => {
    expect(shell).not.toContain("PLATFORM_OWNER_CLERK_USER_ID");
    expect(shell).not.toContain("process.env");
  });

  it("provides Back Office navigation on desktop and mobile", () => {
    expect(backOfficeLayout).toContain('aria-label="Back office navigation"');
    expect(backOfficeLayout).toContain('aria-label="Mobile back office navigation"');
  });

  it("uses the dedicated Back Office shell instead of nesting operator navigation", () => {
    expect(shell).toContain('pathname.startsWith("/back-office")');
    expect(shell).toContain("if (inBackOffice) return");
  });

  it("links directly to the canonical ADA widget editor", () => {
    const canonical = "/back-office/site-settings/integrations/ada-widget";
    expect(backOfficeLayout).toContain(canonical);
    expect(overview).toContain(canonical);
  });
});
