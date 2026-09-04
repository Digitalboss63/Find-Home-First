"use client";

import { useMemo, useState, useTransition } from "react";
import { HELP_TOPICS } from "@/lib/help-knowledge";
import type { TrainingVideoMap } from "@/lib/training-videos";
import { saveTrainingVideosAction } from "./actions";

interface Props {
  initialVideos: TrainingVideoMap;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

export default function TrainingVideoManager({ initialVideos }: Props) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const topic of HELP_TOPICS) initial[topic.id] = initialVideos[topic.id] ?? "";
    return initial;
  });
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const publishedCount = useMemo(
    () => Object.values(values).filter((value) => value.trim()).length,
    [values]
  );

  function updateTopic(topicId: string, value: string) {
    setValues((current) => ({ ...current, [topicId]: value }));
    if (status !== "idle") {
      setStatus("idle");
      setMessage(null);
    }
  }

  function save() {
    startTransition(async () => {
      setStatus("saving");
      setMessage(null);
      const result = await saveTrainingVideosAction(values);
      if (result.ok) {
        setStatus("saved");
        setMessage(`${result.count ?? publishedCount} training video link(s) published.`);
        setTimeout(() => {
          setStatus("idle");
          setMessage(null);
        }, 3500);
      } else {
        setStatus("error");
        setMessage(result.error ?? "Save failed.");
      }
    });
  }

  function clearAll() {
    if (!window.confirm("Remove every published training video link? The help topics will remain, but all videos will return to Planned.")) {
      return;
    }

    const cleared: Record<string, string> = {};
    for (const topic of HELP_TOPICS) cleared[topic.id] = "";
    setValues(cleared);

    startTransition(async () => {
      setStatus("saving");
      setMessage(null);
      const result = await saveTrainingVideosAction(cleared);
      if (result.ok) {
        setStatus("saved");
        setMessage("All training video links removed.");
      } else {
        setStatus("error");
        setMessage(result.error ?? "Clear failed.");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-950">Publishing status</p>
            <p className="mt-1 text-sm text-slate-600">
              {publishedCount} of {HELP_TOPICS.length} help topics currently have a video link.
            </p>
          </div>
          <a
            href="/help/videos"
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Preview Training Library ↗
          </a>
        </div>
      </div>

      <div className="space-y-3">
        {HELP_TOPICS.map((topic) => {
          const value = values[topic.id] ?? "";
          return (
            <section key={topic.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{topic.category}</p>
                  <h2 className="mt-1 text-sm font-semibold text-slate-950">{topic.title}</h2>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${value.trim() ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                  {value.trim() ? "Published" : "Planned"}
                </span>
              </div>

              <label htmlFor={`video-${topic.id}`} className="mt-3 block text-xs font-semibold text-slate-700">
                Video URL
              </label>
              <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
                <input
                  id={`video-${topic.id}`}
                  type="url"
                  inputMode="url"
                  value={value}
                  onChange={(event) => updateTopic(topic.id, event.target.value)}
                  placeholder="https://youtube.com/... or https://loom.com/..."
                  className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-950 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                />
                {value.trim() && (
                  <a
                    href={value}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Test link ↗
                  </a>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <div className="sticky bottom-4 rounded-xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur">
        {message && (
          <p
            className={`mb-3 text-sm ${status === "error" ? "text-red-700" : "text-emerald-700"}`}
            role={status === "error" ? "alert" : undefined}
            aria-live="polite"
          >
            {message}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={isPending}
            className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: "var(--color-action)" }}
          >
            {status === "saving" ? "Saving…" : "Save Training Videos"}
          </button>
          <button
            type="button"
            onClick={clearAll}
            disabled={isPending || publishedCount === 0}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Clear all
          </button>
          <span className="text-xs text-slate-500">Changes are audited and apply platform-wide.</span>
        </div>
      </div>
    </div>
  );
}
