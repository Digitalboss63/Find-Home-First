"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  buildGuideSpotlightInstruction,
  GUIDE_SPOTLIGHT_STORAGE_KEY,
  guideSpotlightCandidates,
  isInternalGuideHref,
  spotlightInstructionIsFresh,
  type GuideSpotlightInstruction,
} from "@/lib/guide-show-me";

function isVisible(element: Element): element is HTMLElement {
  if (!(element instanceof HTMLElement)) return false;
  const style = window.getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden" && element.getClientRects().length > 0;
}

function findSpotlightTarget(instruction: GuideSpotlightInstruction): HTMLElement | null {
  for (const selector of guideSpotlightCandidates(instruction.href)) {
    const candidates = Array.from(document.querySelectorAll(selector));
    const visible = candidates.find(isVisible);
    if (visible) return visible;
  }
  return null;
}

function readPendingInstruction(): GuideSpotlightInstruction | null {
  try {
    const raw = window.sessionStorage.getItem(GUIDE_SPOTLIGHT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GuideSpotlightInstruction;
    if (!parsed?.href || !parsed?.label || !spotlightInstructionIsFresh(parsed)) {
      window.sessionStorage.removeItem(GUIDE_SPOTLIGHT_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    window.sessionStorage.removeItem(GUIDE_SPOTLIGHT_STORAGE_KEY);
    return null;
  }
}

export default function GuideSpotlight() {
  const pathname = usePathname();
  const [active, setActive] = useState<GuideSpotlightInstruction | null>(null);
  const activeElementRef = useRef<HTMLElement | null>(null);
  const dismissTimerRef = useRef<number | null>(null);

  const clearSpotlight = () => {
    if (dismissTimerRef.current !== null) {
      window.clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    if (activeElementRef.current) {
      activeElementRef.current.removeAttribute("data-fhf-guide-spotlight");
      activeElementRef.current = null;
    }
    window.sessionStorage.removeItem(GUIDE_SPOTLIGHT_STORAGE_KEY);
    setActive(null);
  };

  const applySpotlight = (instruction: GuideSpotlightInstruction, attempt = 0) => {
    const target = findSpotlightTarget(instruction);
    if (!target) {
      if (attempt < 12) {
        window.setTimeout(() => applySpotlight(instruction, attempt + 1), 100);
      } else {
        window.sessionStorage.removeItem(GUIDE_SPOTLIGHT_STORAGE_KEY);
      }
      return;
    }

    if (activeElementRef.current && activeElementRef.current !== target) {
      activeElementRef.current.removeAttribute("data-fhf-guide-spotlight");
    }

    target.setAttribute("data-fhf-guide-spotlight", "true");
    activeElementRef.current = target;
    setActive(instruction);
    target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });

    if (dismissTimerRef.current !== null) window.clearTimeout(dismissTimerRef.current);
    dismissTimerRef.current = window.setTimeout(() => clearSpotlight(), 15_000);
  };

  useEffect(() => {
    const pending = readPendingInstruction();
    if (!pending) return;
    const timer = window.setTimeout(() => applySpotlight(pending), 120);
    return () => window.clearTimeout(timer);
    // pathname intentionally retriggers after Next.js navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    const handleGuideLinkClick = (event: MouseEvent) => {
      const origin = event.target;
      if (!(origin instanceof Element)) return;

      const link = origin.closest<HTMLAnchorElement>('section[aria-labelledby="fhf-guide-title"] a[href]');
      if (!link) return;

      const href = link.getAttribute("href");
      if (!isInternalGuideHref(href)) return;

      const label = (link.textContent || "Continue here").replace(/\s+/g, " ").trim();
      const instruction = buildGuideSpotlightInstruction(href!, label);
      window.sessionStorage.setItem(GUIDE_SPOTLIGHT_STORAGE_KEY, JSON.stringify(instruction));

      const targetPath = new URL(href!, window.location.origin).pathname;
      if (targetPath === window.location.pathname) {
        window.setTimeout(() => applySpotlight(instruction), 160);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && activeElementRef.current) clearSpotlight();
    };

    document.addEventListener("click", handleGuideLinkClick, true);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("click", handleGuideLinkClick, true);
      document.removeEventListener("keydown", handleEscape);
      if (dismissTimerRef.current !== null) window.clearTimeout(dismissTimerRef.current);
      if (activeElementRef.current) {
        activeElementRef.current.removeAttribute("data-fhf-guide-spotlight");
      }
    };
    // Event delegation is intentionally installed once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <style>{`
        [data-fhf-guide-spotlight="true"] {
          position: relative !important;
          z-index: 35 !important;
          outline: 4px solid #f59e0b !important;
          outline-offset: 6px !important;
          border-radius: 12px !important;
          box-shadow: 0 0 0 8px rgba(245, 158, 11, 0.18), 0 0 0 9999px rgba(15, 23, 42, 0.28) !important;
          transition: outline-color 160ms ease, box-shadow 160ms ease !important;
        }
      `}</style>

      {active && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 left-1/2 z-[70] w-[min(92vw,520px)] -translate-x-1/2 rounded-2xl border border-amber-200 bg-white px-4 py-3 shadow-2xl"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700">FHF Guide · Show Me</p>
              <p className="mt-1 text-sm font-semibold text-slate-950">This is where to continue.</p>
              <p className="mt-1 text-sm leading-5 text-slate-600">{active.label}</p>
            </div>
            <button
              type="button"
              onClick={clearSpotlight}
              className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
