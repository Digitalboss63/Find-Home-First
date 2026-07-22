/**
 * DemoNotice — Clearly labels demonstration data to the user.
 * Rendered at the top of any page that displays fictional records.
 */
export default function DemoNotice({ message }: { message?: string }) {
  return (
    <p
      className="text-xs font-medium rounded-md px-3 py-2 mb-6 inline-block"
      style={{
        backgroundColor: "var(--color-surface-soft)",
        color: "var(--color-secondary)",
        border: "1px solid var(--color-border)",
      }}
    >
      <span aria-hidden="true">◉ </span>
      {message ?? "Demonstration data — all records are fictional."}
    </p>
  );
}
