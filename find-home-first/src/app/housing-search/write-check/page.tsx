import { redirect } from "next/navigation";

interface PageProps {
  searchParams: Promise<{ project?: string }>;
}

/**
 * Temporary write diagnostic retired after production verification.
 * Keep the route as a safe redirect so stale browser history/bookmarks cannot
 * strand an operator on a diagnostic screen.
 */
export default async function PropertyDraftWriteCheckPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const projectId = (params.project ?? "").trim();

  if (projectId) {
    redirect(`/housing-search?project=${encodeURIComponent(projectId)}`);
  }

  redirect("/housing-search/resume");
}
