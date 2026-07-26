import type { Metadata } from "next";
import { requireOrganization } from "@/lib/auth";
import NewProjectForm from "./NewProjectForm";

export const metadata: Metadata = {
  title: "New Placement Project",
  description: "Create a new housing placement project.",
};

export default async function NewProjectPage() {
  await requireOrganization();

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 lg:px-10">
      <div className="mb-8">
        <p
          className="text-xs mb-1"
          style={{ color: "var(--color-text)", opacity: 0.5 }}
        >
          Projects /
        </p>
        <h1
          className="text-2xl font-bold"
          style={{ color: "var(--color-primary)" }}
        >
          New Placement Project
        </h1>
        <p
          className="mt-1 text-sm"
          style={{ color: "var(--color-text)", opacity: 0.6 }}
        >
          Create a project to track a resident&rsquo;s housing placement from
          start to move-in.
        </p>
      </div>

      <div
        className="rounded-xl p-6"
        style={{
          backgroundColor: "#fff",
          border: "1px solid var(--color-border)",
        }}
      >
        <NewProjectForm />
      </div>
    </div>
  );
}
