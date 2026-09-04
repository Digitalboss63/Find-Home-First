export const GUIDE_SPOTLIGHT_STORAGE_KEY = "find-home-first:guide-spotlight";

export interface GuideSpotlightInstruction {
  href: string;
  label: string;
  createdAt: number;
}

export function isInternalGuideHref(href: string | null | undefined): boolean {
  if (!href) return false;
  return href.startsWith("/") && !href.startsWith("//");
}

export function guideSpotlightCandidates(href: string): string[] {
  let pathname = "/";
  try {
    pathname = new URL(href, "https://findhomefirst.local").pathname;
  } catch {
    return ["#main-content"];
  }

  if (pathname === "/projects/new") {
    return [
      '#main-content [data-fhf-guide-target="new-placement"]',
      "#main-content form",
      "#main-content",
    ];
  }

  if (/^\/projects\/[^/]+\/placement\/?$/.test(pathname)) {
    return [
      '#main-content [data-fhf-guide-target="placement"]',
      "#main-content form",
      "#main-content section",
      "#main-content",
    ];
  }

  if (/^\/projects\/[^/]+/.test(pathname)) {
    return [
      '#main-content [data-fhf-guide-target="project-workspace"]',
      "#main-content section",
      "#main-content",
    ];
  }

  if (pathname.startsWith("/housing-search")) {
    return [
      '#main-content [data-fhf-guide-target="housing-search"]',
      "#main-content form",
      "#main-content",
    ];
  }

  if (pathname.startsWith("/people")) {
    return [
      '#main-content [data-fhf-guide-target="people"]',
      '#main-content [role="tablist"]',
      "#main-content section",
      "#main-content",
    ];
  }

  if (pathname.startsWith("/tasks")) {
    return [
      '#main-content [data-fhf-guide-target="tasks"]',
      "#main-content section",
      "#main-content",
    ];
  }

  if (pathname.startsWith("/help")) {
    return [
      '#main-content [data-fhf-guide-target="help-search"]',
      '#main-content input[type="search"]',
      "#main-content",
    ];
  }

  if (pathname.startsWith("/plan")) {
    return [
      '#main-content [data-fhf-guide-target="plan"]',
      "#main-content section",
      "#main-content",
    ];
  }

  if (pathname === "/projects" || pathname.startsWith("/projects?")) {
    return [
      '#main-content [data-fhf-guide-target="projects"]',
      "#main-content section",
      "#main-content",
    ];
  }

  return ["#main-content"];
}

export function buildGuideSpotlightInstruction(
  href: string,
  label: string,
  createdAt = Date.now()
): GuideSpotlightInstruction {
  return {
    href,
    label: label.trim() || "Continue here",
    createdAt,
  };
}

export function spotlightInstructionIsFresh(
  instruction: GuideSpotlightInstruction,
  now = Date.now(),
  maxAgeMs = 30_000
): boolean {
  return now - instruction.createdAt >= 0 && now - instruction.createdAt <= maxAgeMs;
}
