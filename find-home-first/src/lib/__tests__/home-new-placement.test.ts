import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const homePage = readFileSync(resolve(process.cwd(), "src/app/page.tsx"), "utf8");

describe("Home page new-placement entry points", () => {
  it("keeps the no-project primary action pointed at project creation", () => {
    expect(homePage).toContain('label: "Start New Placement", href: "/projects/new"');
  });

  it("shows a persistent Start New Placement action when a project is active", () => {
    expect(homePage).toContain("+ Start New Placement");
    expect(homePage).toMatch(/primaryProject && \([\s\S]*?href="\/projects\/new"[\s\S]*?\+ Start New Placement/);
  });

  it("shows a second New Placement action beside Active Projects", () => {
    expect(homePage).toMatch(/Active Projects[\s\S]*?href="\/projects\/new"[\s\S]*?\+ New Placement/);
  });

  it("contains three project-creation references covering empty and active states", () => {
    expect(homePage.match(/\/projects\/new/g)?.length).toBe(3);
  });
});

