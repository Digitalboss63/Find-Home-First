"use client";

import { useState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { restoreDefaultLogoAction } from "./actions";

interface Props {
  currentLogoSrc: string | null;
}

export default function LogoManagerClient({ currentLogoSrc }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleFileSelect(file: File) {
    setSelectedFile(file);
    setStatus("idle");
    setErrorMsg(null);
    const reader = new FileReader();
    reader.onload = (e) => setPreviewSrc(e.target?.result as string ?? null);
    reader.readAsDataURL(file);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  }

  function handleSave() {
    if (!selectedFile) return;
    startTransition(async () => {
      setStatus("saving");
      setErrorMsg(null);
      try {
        const formData = new FormData();
        formData.append("logo", selectedFile);
        const res = await fetch("/api/back-office/logo", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          setStatus("error");
          setErrorMsg(data.error ?? "Failed to save logo.");
        } else {
          setStatus("saved");
          setSelectedFile(null);
          setPreviewSrc(null);
          if (fileInputRef.current) fileInputRef.current.value = "";
          setTimeout(() => setStatus("idle"), 3000);
          router.refresh();
        }
      } catch {
        setStatus("error");
        setErrorMsg("Network error. Please try again.");
      }
    });
  }

  function handleRestore() {
    startTransition(async () => {
      setStatus("saving");
      setErrorMsg(null);
      const result = await restoreDefaultLogoAction();
      if (result.ok) {
        setStatus("saved");
        setSelectedFile(null);
        setPreviewSrc(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        setTimeout(() => setStatus("idle"), 3000);
        router.refresh();
      } else {
        setStatus("error");
        setErrorMsg(result.error ?? "Could not restore default logo.");
      }
    });
  }

  const displaySrc = previewSrc ?? currentLogoSrc ?? "/images/fhf-logo-default.svg";
  const isDefault = !currentLogoSrc && !previewSrc;

  return (
    <div className="space-y-6">
      {/* Current logo preview */}
      <div
        className="rounded-xl p-5"
        style={{ backgroundColor: "var(--color-primary)", border: "1px solid rgba(255,255,255,0.1)" }}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.5)" }}>
            Current logo
          </span>
          {isDefault && (
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full"
              style={{ backgroundColor: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.6)" }}
            >
              Default
            </span>
          )}
          {previewSrc && (
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full"
              style={{ backgroundColor: "rgba(234,179,8,0.2)", color: "#FCD34D" }}
            >
              Preview — not saved yet
            </span>
          )}
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={displaySrc}
          alt="Current logo"
          className="h-16 w-auto max-w-[200px] object-contain object-left"
        />
      </div>

      {/* Upload zone */}
      <div
        className="rounded-xl p-5"
        style={{ backgroundColor: "#fff", border: "1px solid var(--color-border)" }}
      >
        <p className="text-sm font-semibold mb-3" style={{ color: "var(--color-primary)" }}>
          Upload new logo
        </p>

        {/* Drag-drop zone */}
        <label
          htmlFor="logo-file-input"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className="flex flex-col items-center justify-center gap-2 rounded-lg cursor-pointer transition-colors"
          style={{
            border: `2px dashed ${isDragging ? "var(--color-action)" : "var(--color-border)"}`,
            backgroundColor: isDragging ? "rgba(99,102,241,0.04)" : "var(--color-surface-soft, #f9fafb)",
            padding: "2rem 1rem",
          }}
        >
          <svg
            aria-hidden="true"
            className="w-8 h-8"
            style={{ color: "var(--color-text)", opacity: 0.3 }}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <span className="text-sm font-medium" style={{ color: "var(--color-text)", opacity: 0.7 }}>
            {selectedFile ? selectedFile.name : "Drag & drop or click to select"}
          </span>
          <span className="text-xs" style={{ color: "var(--color-text)", opacity: 0.45 }}>
            PNG, JPEG, SVG, WebP — max 2 MB
          </span>
          <input
            id="logo-file-input"
            ref={fileInputRef}
            type="file"
            accept=".png,.jpg,.jpeg,.svg,.webp"
            onChange={handleInputChange}
            className="sr-only"
          />
        </label>
      </div>

      {/* Status messages */}
      {status === "saved" && (
        <p className="text-sm font-medium" style={{ color: "#15803D" }} aria-live="polite">
          ✓ Logo updated successfully.
        </p>
      )}
      {status === "error" && errorMsg && (
        <p className="text-sm font-medium" style={{ color: "#B91C1C" }} role="alert">
          {errorMsg}
        </p>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={!selectedFile || isPending}
          className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
          style={{ backgroundColor: "var(--color-action)" }}
        >
          {status === "saving" && !selectedFile ? "Working…" : isPending && selectedFile ? "Saving…" : "Save Logo"}
        </button>

        <button
          type="button"
          onClick={handleRestore}
          disabled={isPending || isDefault}
          className="text-sm font-medium px-4 py-2.5 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
          style={{
            border: "1px solid var(--color-border)",
            color: "var(--color-text)",
            backgroundColor: "#fff",
          }}
        >
          {isPending && !selectedFile ? "Restoring…" : "Restore Default"}
        </button>
      </div>
    </div>
  );
}
