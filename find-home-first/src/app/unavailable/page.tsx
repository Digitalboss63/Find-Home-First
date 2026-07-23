import type { Metadata } from "next";
export const metadata: Metadata = { title: "Service Unavailable" };
export default function UnavailablePage() {
  return (
    <div className="max-w-lg mx-auto px-6 py-20 text-center">
      <h1 className="text-2xl font-bold mb-3" style={{ color: "var(--color-primary)" }}>
        Service Temporarily Unavailable
      </h1>
      <p className="text-sm" style={{ color: "var(--color-text)", opacity: 0.65 }}>
        We&apos;re having trouble connecting. Please try again in a moment.
      </p>
    </div>
  );
}
