import Link from "next/link";
import { HELP_TOPICS } from "@/lib/help-knowledge";
import { getTrainingVideoCatalog } from "@/lib/training-videos";

export default function TrainingVideoLibrary() {
  const { available, planned } = getTrainingVideoCatalog(HELP_TOPICS);

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-6 lg:px-8 lg:py-10">
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--color-primary)" }}>
          Find Home First Training
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Training Videos</h1>
        <p className="mt-3 text-base leading-7 text-slate-600">
          Short, task-focused videos for the same features documented in the Help Center. Videos appear here automatically when a help topic receives a video link.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 font-medium text-emerald-800">
            {available.length} available
          </span>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-600">
            {planned.length} planned
          </span>
        </div>
      </header>

      <div className="mt-6">
        <Link href="/help" className="text-sm font-semibold" style={{ color: "var(--color-primary)" }}>
          ← Back to Help Center
        </Link>
      </div>

      <section className="mt-8" aria-labelledby="available-videos-heading">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Published</p>
            <h2 id="available-videos-heading" className="mt-1 text-2xl font-bold text-slate-950">Available videos</h2>
          </div>
        </div>

        {available.length > 0 ? (
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {available.map((topic) => (
              <article key={topic.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-primary)" }}>
                  {topic.category}
                </p>
                <h3 className="mt-1 text-lg font-semibold text-slate-950">{topic.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{topic.shortDescription}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <a
                    href={topic.videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg px-3 py-2 text-sm font-semibold text-white"
                    style={{ backgroundColor: "var(--color-primary)" }}
                  >
                    Watch video →
                  </a>
                  {topic.route && topic.routeLabel && (
                    <Link href={topic.route} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                      Open feature
                    </Link>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-6">
            <p className="text-sm font-semibold text-slate-900">No training videos are published yet.</p>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              The library is ready. Add a video URL to a help topic and it will appear here and in that topic&apos;s help controls.
            </p>
          </div>
        )}
      </section>

      <section className="mt-10" aria-labelledby="planned-videos-heading">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recording checklist</p>
        <h2 id="planned-videos-heading" className="mt-1 text-2xl font-bold text-slate-950">Planned videos</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Keep these short and task-specific. Once a topic has a video URL, it automatically moves into the published section above.
        </p>

        {planned.length > 0 ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {planned.map((topic, index) => (
              <article key={topic.id} className="flex gap-4 rounded-xl border border-slate-200 bg-white p-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{topic.category}</p>
                  <h3 className="mt-0.5 text-sm font-semibold text-slate-950">{topic.title}</h3>
                  <p className="mt-1 text-sm leading-5 text-slate-600">{topic.whenToUse}</p>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            Every current help topic has a training video.
          </div>
        )}
      </section>
    </div>
  );
}
