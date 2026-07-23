import type { Metadata } from "next";
export const metadata: Metadata = { title: "Access Denied" };
export default function AccessDeniedPage() {
  return (
    <div className="max-w-lg mx-auto px-6 py-20 text-center">
      <h1 className="text-2xl font-bold mb-3" style={{ color: "var(--color-primary)" }}>
        Access Denied
      </h1>
      <p className="text-sm" style={{ color: "var(--color-text)", opacity: 0.65 }}>
        You don&apos;t have permission to perform this action.
      </p>
    </div>
  );
}
