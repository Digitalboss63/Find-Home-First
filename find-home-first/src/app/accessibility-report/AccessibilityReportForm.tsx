"use client";

/**
 * AccessibilityReportForm
 *
 * Accessible problem-reporting form for accessibility barriers.
 * All fields include proper labels, descriptions, and ARIA attributes.
 * Form submission is a no-op placeholder until a backend endpoint is wired.
 */

import { useState, useRef, type FormEvent } from "react";

type FieldErrors = Record<string, string>;

function FieldError({
  id,
  message,
}: {
  id: string;
  message: string | undefined;
}) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1 text-sm text-red-600 dark:text-red-400">
      {message}
    </p>
  );
}

export default function AccessibilityReportForm() {
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const successRef = useRef<HTMLDivElement>(null);

  function validate(form: HTMLFormElement): FieldErrors {
    const errs: FieldErrors = {};
    const page = (form.elements.namedItem("page") as HTMLInputElement)?.value.trim();
    const description = (form.elements.namedItem("description") as HTMLTextAreaElement)?.value.trim();

    if (!page) errs.page = "Please enter the page or URL where the issue occurred.";
    if (!description) errs.description = "Please describe the accessibility barrier.";

    return errs;
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const errs = validate(form);

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      // Move focus to first error field
      const first = Object.keys(errs)[0];
      (form.elements.namedItem(first) as HTMLElement | null)?.focus();
      return;
    }

    setErrors({});
    setSubmitted(true);

    // TODO: wire to a POST /api/accessibility-report endpoint
    setTimeout(() => {
      successRef.current?.focus();
    }, 50);
  }

  if (submitted) {
    return (
      <div
        ref={successRef}
        tabIndex={-1}
        role="status"
        aria-live="polite"
        className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950 px-6 py-8 text-center focus:outline-none"
      >
        <p className="text-lg font-semibold text-green-800 dark:text-green-300 mb-2">
          Thank you — your report was received.
        </p>
        <p className="text-sm text-green-700 dark:text-green-400">
          We aim to respond within 5 business days.
        </p>
      </div>
    );
  }

  const inputBase =
    "w-full rounded-lg border px-4 py-2.5 text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700 focus:border-[--brand-accent] focus:ring-2 focus:ring-[--brand-accent]/30 transition";

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-label="Accessibility issue report form"
      className="space-y-6"
    >
      {/* Name */}
      <div>
        <label
          htmlFor="name"
          className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-1"
        >
          Your name{" "}
          <span className="text-[--brand-muted] font-normal">(optional)</span>
        </label>
        <input
          type="text"
          id="name"
          name="name"
          autoComplete="name"
          className={inputBase}
          aria-describedby="name-hint"
        />
        <p id="name-hint" className="mt-1 text-xs text-[--brand-muted]">
          Only needed if you would like us to follow up with you directly.
        </p>
      </div>

      {/* Email */}
      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-1"
        >
          Email address{" "}
          <span className="text-[--brand-muted] font-normal">(optional)</span>
        </label>
        <input
          type="email"
          id="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          className={inputBase}
          aria-describedby="email-hint"
        />
        <p id="email-hint" className="mt-1 text-xs text-[--brand-muted]">
          We will only use this to follow up on your report.
        </p>
      </div>

      {/* Page / URL */}
      <div>
        <label
          htmlFor="page"
          className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-1"
        >
          Page or URL where the issue occurred{" "}
          <span aria-hidden="true" className="text-red-500">
            *
          </span>
          <span className="sr-only">(required)</span>
        </label>
        <input
          type="text"
          id="page"
          name="page"
          required
          aria-required="true"
          aria-describedby={errors.page ? "page-error" : "page-hint"}
          aria-invalid={errors.page ? "true" : undefined}
          className={inputBase}
          placeholder="e.g. /accessibility or the page title"
        />
        <p id="page-hint" className="mt-1 text-xs text-[--brand-muted]">
          A URL or description helps us locate the barrier quickly.
        </p>
        <FieldError id="page-error" message={errors.page} />
      </div>

      {/* Description */}
      <div>
        <label
          htmlFor="description"
          className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-1"
        >
          Describe the barrier{" "}
          <span aria-hidden="true" className="text-red-500">
            *
          </span>
          <span className="sr-only">(required)</span>
        </label>
        <textarea
          id="description"
          name="description"
          required
          aria-required="true"
          rows={5}
          aria-describedby={errors.description ? "description-error" : "description-hint"}
          aria-invalid={errors.description ? "true" : undefined}
          className={inputBase}
          placeholder="What were you trying to do? What happened? What assistive technology or browser are you using?"
        />
        <p id="description-hint" className="mt-1 text-xs text-[--brand-muted]">
          The more detail you provide, the faster we can fix it.
        </p>
        <FieldError id="description-error" message={errors.description} />
      </div>

      <button
        type="submit"
        className="w-full sm:w-auto flex items-center justify-center rounded-full bg-[--brand-primary] text-white font-semibold text-sm px-8 py-3 hover:opacity-90 transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[--brand-accent]"
      >
        Submit Report
      </button>
    </form>
  );
}
