"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  getContextHelpTopics,
  HELP_TOPICS,
  searchHelpTopics,
  type HelpTopic,
} from "@/lib/help-knowledge";

function QuestionIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M9.8 9a2.35 2.35 0 014.55.75c0 1.75-2.35 2-2.35 3.75" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function TopicDetail({ topic, onClose }: { topic: HelpTopic; onClose: () => void }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-primary)" }}>
          {topic.category}
        </p>
        <h3 className="mt-1 text-lg font-semibold text-slate-950">{topic.title}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">{topic.shortDescription}</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Why it matters</p>
        <p className="mt-1 text-sm leading-5 text-slate-700">{topic.whyItMatters}</p>
      </div>

      <div>
        <p className="text-sm font-semibold text-slate-900">How to use it</p>
        <ol className="mt-2 space-y-2 text-sm leading-5 text-slate-700">
          {topic.steps.map((step, index) => (
            <li key={step} className="flex gap-2">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600">
                {index + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>

      {topic.commonMistakes && topic.commonMistakes.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-slate-900">Watch for</p>
          <ul className="mt-2 space-y-1.5 text-sm leading-5 text-slate-700">
            {topic.commonMistakes.map((mistake) => (
              <li key={mistake} className="flex gap-2">
                <span aria-hidden="true" className="text-amber-600">•</span>
                <span>{mistake}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-xl border p-3" style={{ borderColor: "var(--color-border)" }}>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Next action</p>
        <p className="mt-1 text-sm font-medium text-slate-900">{topic.nextAction}</p>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4">
        {topic.route && topic.routeLabel && (
          <Link
            href={topic.route}
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--color-primary)" }}
          >
            {topic.routeLabel}
          </Link>
        )}
        {topic.videoUrl ? (
          <a
            href={topic.videoUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Watch video
          </a>
        ) : (
          <span className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-500">
            Video coming soon
          </span>
        )}
      </div>
    </div>
  );
}

export default function FhfGuide() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedTopic, setSelectedTopic] = useState<HelpTopic | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);

  const contextualTopics = useMemo(() => getContextHelpTopics(pathname), [pathname]);
  const results = useMemo(() => {
    if (!query.trim()) return contextualTopics;
    return searchHelpTopics(query).slice(0, 7);
  }, [contextualTopics, query]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setSelectedTopic(null);
        setTimeout(() => launcherRef.current?.focus(), 0);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  useEffect(() => {
    setSelectedTopic(null);
    setQuery("");
  }, [pathname]);

  const close = () => {
    setOpen(false);
    setSelectedTopic(null);
    setTimeout(() => launcherRef.current?.focus(), 0);
  };

  const openGuide = () => {
    setOpen(true);
    setTimeout(() => closeButtonRef.current?.focus(), 0);
  };

  return (
    <>
      <button
        ref={launcherRef}
        type="button"
        onClick={openGuide}
        className="fixed bottom-5 right-5 z-30 flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold text-white shadow-xl transition hover:-translate-y-0.5 hover:shadow-2xl focus:outline-none focus:ring-2 focus:ring-offset-2"
        style={{ backgroundColor: "var(--color-primary)" }}
        aria-label="Open FHF Guide"
      >
        <QuestionIcon className="h-5 w-5" />
        <span className="hidden sm:inline">FHF Guide</span>
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default bg-black/35"
            aria-label="Close FHF Guide"
            onClick={close}
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="fhf-guide-title"
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-2xl"
          >
            <header className="border-b border-slate-200 px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-primary)" }}>
                    Find Home First
                  </p>
                  <h2 id="fhf-guide-title" className="mt-1 text-xl font-bold text-slate-950">
                    FHF Guide
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Ask about this page or search any feature.
                  </p>
                </div>
                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={close}
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                  aria-label="Close FHF Guide"
                >
                  <CloseIcon className="h-5 w-5" />
                </button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto px-5 py-5">
              {selectedTopic ? (
                <TopicDetail topic={selectedTopic} onClose={close} />
              ) : (
                <div className="space-y-5">
                  <div>
                    <label htmlFor="fhf-guide-search" className="sr-only">Search help</label>
                    <input
                      id="fhf-guide-search"
                      type="search"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Try: What do I do next?"
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                    />
                  </div>

                  {!query.trim() && (
                    <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Help for this page</p>
                      <p className="mt-1 text-sm text-blue-950">
                        I found {contextualTopics.length} topic{contextualTopics.length === 1 ? "" : "s"} related to where you are now.
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    {results.length > 0 ? (
                      results.map((topic) => (
                        <button
                          key={topic.id}
                          type="button"
                          onClick={() => setSelectedTopic(topic)}
                          className="w-full rounded-xl border border-slate-200 p-4 text-left transition hover:border-slate-300 hover:bg-slate-50"
                        >
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{topic.category}</span>
                          <span className="mt-1 block text-sm font-semibold text-slate-950">{topic.title}</span>
                          <span className="mt-1 block text-sm leading-5 text-slate-600">{topic.shortDescription}</span>
                        </button>
                      ))
                    ) : (
                      <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600">
                        I do not have a matching article yet. Try a feature name such as “FMR,” “property economics,” “referral contact,” or “next action.”
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <footer className="border-t border-slate-200 px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                {selectedTopic ? (
                  <button
                    type="button"
                    onClick={() => setSelectedTopic(null)}
                    className="text-sm font-semibold text-slate-700 hover:text-slate-950"
                  >
                    ← Back to topics
                  </button>
                ) : (
                  <span className="text-xs text-slate-500">{HELP_TOPICS.length} help topics available</span>
                )}
                <Link href="/help" onClick={close} className="text-sm font-semibold" style={{ color: "var(--color-primary)" }}>
                  Open Help Center
                </Link>
              </div>
            </footer>
          </section>
        </>
      )}
    </>
  );
}
