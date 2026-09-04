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
import type { GuideProjectContext } from "@/lib/project-guidance";

const LAST_PROJECT_STORAGE_KEY = "find-home-first:last-project-id";

type ProjectQuestion = "overview" | "next" | "blocker" | "missing";
type ContextState = "idle" | "loading" | "ready" | "error";

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

function classifyProjectQuestion(query: string): ProjectQuestion | null {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return null;

  if (
    normalized.includes("what do i do") ||
    normalized.includes("do next") ||
    normalized.includes("next step") ||
    normalized.includes("next action") ||
    normalized === "next"
  ) {
    return "next";
  }

  if (normalized.includes("block") || normalized.includes("stuck")) {
    return "blocker";
  }

  if (
    normalized.includes("missing") ||
    normalized.includes("incomplete") ||
    normalized.includes("what do i need") ||
    normalized.includes("still need")
  ) {
    return "missing";
  }

  if (
    normalized.includes("where am i") ||
    normalized.includes("project status") ||
    normalized.includes("current stage")
  ) {
    return "overview";
  }

  return null;
}

function ProjectAnswer({
  context,
  mode,
  onClose,
}: {
  context: GuideProjectContext;
  mode: ProjectQuestion;
  onClose: () => void;
}) {
  if (mode === "next") {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">What to do now</p>
        <h3 className="mt-1 text-base font-semibold text-emerald-950">{context.nextAction.label}</h3>
        <p className="mt-2 text-sm leading-5 text-emerald-900">{context.nextAction.reason}</p>
        <Link
          href={context.nextAction.href}
          onClick={onClose}
          className="mt-3 inline-flex rounded-lg px-3 py-2 text-sm font-semibold text-white"
          style={{ backgroundColor: "var(--color-primary)" }}
        >
          Go there →
        </Link>
      </div>
    );
  }

  if (mode === "blocker") {
    return context.blocker ? (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Project blocker</p>
        <h3 className="mt-1 text-base font-semibold text-amber-950">{context.blocker.title}</h3>
        {context.blocker.reason && (
          <p className="mt-2 text-sm leading-5 text-amber-900">{context.blocker.reason}</p>
        )}
        <p className="mt-3 text-sm font-medium text-amber-950">
          Recommended action: {context.nextAction.label}
        </p>
      </div>
    ) : (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-5 text-emerald-950">
        I do not see a recorded blocker on the active project. The current next action is <strong>{context.nextAction.label}</strong>.
      </div>
    );
  }

  if (mode === "missing") {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">What is still missing</p>
        {context.missingItems.length > 0 ? (
          <ul className="mt-2 space-y-2 text-sm text-slate-800">
            {context.missingItems.map((item) => (
              <li key={item} className="flex gap-2">
                <span aria-hidden="true" className="text-amber-600">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm leading-5 text-slate-700">
            I do not see a required item missing for the project&apos;s current status. Continue with <strong>{context.nextAction.label}</strong>.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Active project</p>
      <h3 className="mt-1 text-base font-semibold text-blue-950">
        {context.project?.name ?? "No active project"}
      </h3>
      <p className="mt-2 text-sm leading-5 text-blue-950">{context.summary}</p>
      {context.project && (
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {context.stageLabel && (
            <span className="rounded-full bg-white px-2.5 py-1 font-medium text-blue-900">Stage: {context.stageLabel}</span>
          )}
          <span className="rounded-full bg-white px-2.5 py-1 font-medium text-blue-900">
            Saved properties: {context.savedPropertyCount}
          </span>
          <span className="rounded-full bg-white px-2.5 py-1 font-medium text-blue-900">
            Open tasks: {context.openTasks.length}
          </span>
        </div>
      )}
    </div>
  );
}

export default function FhfGuide() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedTopic, setSelectedTopic] = useState<HelpTopic | null>(null);
  const [projectContext, setProjectContext] = useState<GuideProjectContext | null>(null);
  const [contextState, setContextState] = useState<ContextState>("idle");
  const [projectQuestion, setProjectQuestion] = useState<ProjectQuestion>("overview");
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);

  const contextualTopics = useMemo(() => getContextHelpTopics(pathname), [pathname]);
  const detectedProjectQuestion = useMemo(() => classifyProjectQuestion(query), [query]);
  const results = useMemo(() => {
    if (!query.trim() || detectedProjectQuestion) return contextualTopics;
    return searchHelpTopics(query).slice(0, 7);
  }, [contextualTopics, detectedProjectQuestion, query]);

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

  const resolveProjectId = () => {
    const pathProjectId = pathname.match(/^\/projects\/([^/]+)/)?.[1] ?? null;
    if (pathProjectId && pathProjectId !== "new") return pathProjectId;

    if (pathname.startsWith("/housing-search")) {
      const queryProjectId = new URLSearchParams(window.location.search).get("project");
      if (queryProjectId) return queryProjectId;
    }

    return window.sessionStorage.getItem(LAST_PROJECT_STORAGE_KEY);
  };

  const loadProjectContext = async () => {
    setContextState("loading");
    try {
      const projectId = resolveProjectId();
      const endpoint = projectId
        ? `/api/guide-context?project=${encodeURIComponent(projectId)}`
        : "/api/guide-context";
      const response = await fetch(endpoint, { cache: "no-store" });
      if (!response.ok) throw new Error(`Guide context failed with ${response.status}`);
      const context = (await response.json()) as GuideProjectContext;
      setProjectContext(context);
      setContextState("ready");
    } catch (error) {
      console.warn(
        "[fhf-guide] project context unavailable",
        error instanceof Error ? error.message : String(error)
      );
      setProjectContext(null);
      setContextState("error");
    }
  };

  const close = () => {
    setOpen(false);
    setSelectedTopic(null);
    setTimeout(() => launcherRef.current?.focus(), 0);
  };

  const openGuide = () => {
    setSelectedTopic(null);
    setQuery("");
    setProjectQuestion("overview");
    setOpen(true);
    void loadProjectContext();
    setTimeout(() => closeButtonRef.current?.focus(), 0);
  };

  const chooseProjectQuestion = (question: ProjectQuestion) => {
    setSelectedTopic(null);
    setQuery("");
    setProjectQuestion(question);
  };

  const activeQuestion = detectedProjectQuestion ?? projectQuestion;

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
                    Ask what to do next, what is blocking you, or how a feature works.
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
                    <label htmlFor="fhf-guide-search" className="sr-only">Ask FHF Guide or search help</label>
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
                    <div className="flex flex-wrap gap-2" aria-label="Project guidance questions">
                      <button
                        type="button"
                        onClick={() => chooseProjectQuestion("next")}
                        className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        What do I do now?
                      </button>
                      <button
                        type="button"
                        onClick={() => chooseProjectQuestion("blocker")}
                        className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        What&apos;s blocking me?
                      </button>
                      <button
                        type="button"
                        onClick={() => chooseProjectQuestion("missing")}
                        className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        What&apos;s missing?
                      </button>
                    </div>
                  )}

                  {contextState === "loading" && (
                    <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4 text-sm text-blue-950">
                      Reading your active project…
                    </div>
                  )}

                  {contextState === "ready" && projectContext && (
                    <ProjectAnswer context={projectContext} mode={activeQuestion} onClose={close} />
                  )}

                  {contextState === "error" && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-5 text-amber-950">
                      I can still explain Find Home First features, but I could not read the active project right now.
                    </div>
                  )}

                  {!query.trim() && activeQuestion === "overview" && (
                    <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Help for this page</p>
                      <p className="mt-1 text-sm text-blue-950">
                        I found {contextualTopics.length} topic{contextualTopics.length === 1 ? "" : "s"} related to where you are now.
                      </p>
                    </div>
                  )}

                  {!detectedProjectQuestion && (
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
                          I do not have a matching article yet. Try “what do I do next,” “what&apos;s missing,” “FMR,” “property economics,” or “referral contact.”
                        </div>
                      )}
                    </div>
                  )}
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
                  <button
                    type="button"
                    onClick={() => chooseProjectQuestion("overview")}
                    className="text-xs font-semibold text-slate-600 hover:text-slate-950"
                  >
                    Active project overview
                  </button>
                )}
                <Link href="/help" onClick={close} className="text-sm font-semibold" style={{ color: "var(--color-primary)" }}>
                  Open Help Center
                </Link>
              </div>
              <p className="mt-2 text-[11px] text-slate-400">{HELP_TOPICS.length} help topics available</p>
            </footer>
          </section>
        </>
      )}
    </>
  );
}
