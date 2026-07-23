"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function OnboardingForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="org-name" className="block text-sm font-semibold mb-2" style={{ color: "var(--color-text)" }}>
        Organization name
      </label>
      <input
        id="org-name"
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Metro Housing Alliance"
        required
        maxLength={120}
        className="w-full rounded-lg px-4 py-2.5 text-sm outline-none mb-4"
        style={{ border: "1px solid var(--color-border)", backgroundColor: "var(--color-surface-soft)", color: "var(--color-text)" }}
      />
      {error && <p className="text-sm mb-4" style={{ color: "#DC2626" }}>{error}</p>}
      <button
        type="submit"
        disabled={loading || !name.trim()}
        className="w-full rounded-lg px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        style={{ backgroundColor: "var(--color-action)" }}
      >
        {loading ? "Creating…" : "Create Organization"}
      </button>
    </form>
  );
}
