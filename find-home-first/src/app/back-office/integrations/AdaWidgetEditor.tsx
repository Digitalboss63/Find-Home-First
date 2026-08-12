"use client";

import { useState, useTransition } from "react";
import { saveAdaWidgetAction } from "./actions";

interface Props {
  initialCode: string;
  initialEnabled: boolean;
  lastUpdated: Date | null;
  lastUpdatedBy: string | null;
}

export default function AdaWidgetEditor({
  initialCode,
  initialEnabled,
  lastUpdated,
  lastUpdatedBy,
}: Props) {
  const [embedCode, setEmbedCode] = useState(initialCode);
  const [enabled, setEnabled] = useState(initialEnabled);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      setStatus("saving");
      setErrorMsg(null);
      const result = await saveAdaWidgetAction(embedCode, enabled);
      if (result.ok) {
        setStatus("saved");
        setTimeout(() => setStatus("idle"), 3000);
      } else {
        setStatus("error");
        setErrorMsg(result.error ?? "Save failed.");
      }
    });
  }

  function handleClear() {
    const confirmed = window.confirm(
      "Clear and disable the ADA widget? This will remove the embed code and stop injection. Continue?"
    );
    if (!confirmed) return;

    setEmbedCode("");
    setEnabled(false);

    startTransition(async () => {
      setStatus("saving");
      const result = await saveAdaWidgetAction("", false);
      if (result.ok) {
        setStatus("saved");
        setTimeout(() => setStatus("idle"), 3000);
      } else {
        setStatus("error");
        setErrorMsg(result.error ?? "Clear failed.");
      }
    });
  }

  const fieldBase: React.CSSProperties = {
    backgroundColor: "#fff",
    border: "1px solid var(--color-border)",
    borderRadius: "0.5rem",
    color: "var(--color-text)",
    padding: "0.5rem 0.75rem",
    fontSize: "0.875rem",
  };

  return (
    <div>
      {/* Status indicator */}
      <div
        className="flex items-center gap-3 mb-5 px-4 py-3 rounded-lg text-sm"
        style={{
          backgroundColor: "var(--color-surface-soft)",
          border: "1px solid var(--color-border)",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            backgroundColor: enabled ? "#22C55E" : "#9CA3AF",
            display: "inline-block",
            flexShrink: 0,
          }}
        />
        <span style={{ color: "var(--color-text)", opacity: 0.8 }}>
          ADA widget is currently{" "}
          <strong>{enabled ? "enabled" : "disabled"}</strong>.
          {embedCode.trim() === "" && " No embed code is set."}
        </span>
      </div>

      {/* Enable/disable toggle */}
      <div className="flex items-center gap-3 mb-5">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="w-4 h-4"
            aria-label="Enable ADA widget"
          />
          <span
            className="text-sm font-semibold"
            style={{ color: "var(--color-primary)" }}
          >
            Enable ADA widget injection
          </span>
        </label>
      </div>

      {/* Embed code textarea */}
      <div className="mb-5">
        <label
          htmlFor="ada-embed-code"
          className="block text-sm font-semibold mb-1.5"
          style={{ color: "var(--color-text)", opacity: 0.8 }}
        >
          Embed code
        </label>
        <p className="text-xs mb-2" style={{ color: "var(--color-text)", opacity: 0.5 }}>
          Paste the third-party ADA widget embed code here. It will be injected
          once near the end of the page body when enabled. The code is not executed
          inside this editor.
        </p>
        <textarea
          id="ada-embed-code"
          rows={8}
          value={embedCode}
          onChange={(e) => setEmbedCode(e.target.value)}
          placeholder="<!-- Paste ADA widget embed code here -->"
          spellCheck={false}
          style={{
            ...fieldBase,
            width: "100%",
            fontFamily: "monospace",
            fontSize: "0.8rem",
            resize: "vertical",
          }}
          aria-describedby="ada-embed-hint"
        />
        <p
          id="ada-embed-hint"
          className="text-xs mt-1"
          style={{ color: "var(--color-text)", opacity: 0.4 }}
        >
          Example provider: ADA Bundle (https://app.adabundle.com/widget)
        </p>
      </div>

      {/* Timestamps */}
      {lastUpdated && (
        <p className="text-xs mb-4" style={{ color: "var(--color-text)", opacity: 0.5 }}>
          Last updated:{" "}
          <time dateTime={lastUpdated.toISOString()}>
            {lastUpdated.toLocaleString()}
          </time>
          {lastUpdatedBy && ` by ${lastUpdatedBy}`}
        </p>
      )}

      {/* Status feedback */}
      {status === "saved" && (
        <p
          className="text-sm mb-3"
          style={{ color: "var(--color-secondary)" }}
          aria-live="polite"
        >
          ✓ ADA widget settings saved.
        </p>
      )}
      {status === "error" && errorMsg && (
        <p
          className="text-sm mb-3"
          style={{ color: "#B91C1C" }}
          role="alert"
        >
          {errorMsg}
        </p>
      )}

      {/* Action row */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          style={{ backgroundColor: "var(--color-action)" }}
        >
          {status === "saving" ? "Saving…" : "Save"}
        </button>

        <button
          type="button"
          onClick={handleClear}
          disabled={isPending || (embedCode.trim() === "" && !enabled)}
          className="text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            border: "1px solid var(--color-border)",
            color: "var(--color-text)",
            backgroundColor: "#fff",
          }}
        >
          Clear &amp; remove
        </button>
      </div>
    </div>
  );
}
