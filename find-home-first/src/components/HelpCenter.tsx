"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  HELP_CATEGORIES,
  HELP_TOPICS,
  searchHelpTopics,
  type HelpCategory,
  type HelpTopic,
} from "@/lib/help-knowledge";
import {
  applyTrainingVideoUrls,
  type TrainingVideoMap,
} from "@/lib/training-videos";

function TopicCard({ topic }: { topic: HelpTopic }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-primary)" }}>
            {topic.category}
          </p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">{topic.title}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{topic.shortDescription}</p>
        </div>
        <span className="rounded-full border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-500">
          {topic.videoUrl ? "Video available" : "Video coming soon"}
        </span>
      </div>

      <details className="group mt-4 border-t border-slate-100 pt-4">
        <summary className="cursor-pointer list-none text-sm font-semibold text-slate-800 marker:hidden">
          <span className="group-open:hidden">How to use this feature ↓</span>
          <span className="hidden group-open:inline">Hide instructions ↑</span>
        </summary>
        <div className="mt-4 space-y-4 text-sm leading-6 text-slate-700">
          <div>
            <p className="font-semibold text-slate-900">Why it matters</p>
            <p className="mt-1">{topic.whyItMatters}</p>
          </div>
          <div>
            <p className="font-semibold text-slate-900">When to use it</p>
            <p className="mt-1">{topic.whenToUse}</p>
          </div>
          <div>
            <p className="font-semibold text-slate-900">Steps</p>
            <ol className="mt-2 space-y-2">
              {topic.steps.map((step, index) => (
                <li key={step} className="flex gap-2">
                  <span className="font-semibold text-slate-500">{index + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
          {topic.requiredInfo && topic.requiredInfo.length > 0 && (
            <div>
              <p className="font-semibold text-slate-900">What you need</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {topic.requiredInfo.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          )}
          {topic.commonMistakes && topic.commonMistakes.length > 0 && (
            <div>
              <p className="font-semibold text-slate-900">Common mistakes</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {topic.commonMistakes.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          )}
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Next action</p>
            <p className="mt-1 font-medium text-slate-900">{topic.nextAction}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {topic.route && topic.routeLabel && (
              <Link
                href={topic.route}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-white"
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
                Video slot ready
              </span>
            )}
          </div>
        </div>
      </details>
    </article>
  );
}

export default function HelpCenter({ videoUrls }: { videoUrls: TrainingVideoMap }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<HelpCategory | "All">("All");

  const results = useMemo(() => {
    const searched = query.trim() ? searchHelpTopics(query) : HELP_TOPICS;
    const withVideos = applyTrainingVideoUrls(searched, videoUrls);
    return category === "All"
      ? withVideos
      : withVideos.filter((topic) => topic.category === category);
  }, [query, category, videoUrls]);

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-6 lg:px-8 lg:py-10">
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--color-primary)" }}>
          Find Home First Knowledge Center
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Help Center</h1>
        <p className="mt-3 text-base leading-7 text-slate-600">
          Learn what each feature does, why it matters, and exactly how to use it. The same knowledge powers FHF Guide throughout the app.
        </p>
      </header>

      <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" aria-label="Search help articles">
        <label htmlFor="help-search" className="text-sm font-semibold text-slate-900">What do you need help with?</label>
        <input
          id="help-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Try: property economics, FMR, landlord, what do I do next..."
          className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-950 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
        />
        <div className="mt-4 flex flex-wrap gap-2" aria-label="Filter by category">
          <button
            type="button"
            onClick={() => setCategory("All")}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${category === "All" ? "text-white" : "border border-slate-200 bg-white text-slate-700"}`}
            style={category === "All" ? { backgroundColor: "var(--color-primary)" } : undefined}
          >
            All
          </button>
          {HELP_CATEGORIES.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setCategory(item)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ${category === item ? "text-white" : "border border-slate-200 bg-white text-slate-700"}`}
              style={category === item ? { backgroundColor: "var(--color-primary)" } : undefined}
            >
              {item}
            </button>
          ))}
        </div>
      </section>

      <div className="mt-6 flex items-center justify-between gap-4">
        <p className="text-sm text-slate-600">
          {results.length} article{results.length === 1 ? "" : "s"}
        </p>
        <p className="text-xs text-slate-500">Training links are managed from Back Office and update topic-by-topic.</p>
      </div>

      {results.length > 0 ? (
        <section className="mt-4 grid gap-4 lg:grid-cols-2" aria-label="Help articles">
          {results.map((topic) => <TopicCard key={topic.id} topic={topic} />)}
        </section>
      ) : (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <h2 className="text-lg font-semibold text-slate-950">No matching help article yet</h2>
          <p className="mt-2 text-sm text-slate-600">Try a feature name or broader term. FHF Guide uses the same knowledge set.</p>
        </div>
      )}
    </div>
  );
}
