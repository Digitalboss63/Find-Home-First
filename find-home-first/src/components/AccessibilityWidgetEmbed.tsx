"use client";

/**
 * AccessibilityWidgetEmbed
 *
 * Drop-in mount point for a third-party ADA accessibility widget (e.g. UserWay,
 * accessiBe, Equal Web).  Configure via environment variables:
 *
 *   NEXT_PUBLIC_ACCESSIBILITY_WIDGET_ENABLED=true
 *   NEXT_PUBLIC_ACCESSIBILITY_WIDGET_SCRIPT_URL=https://cdn.example.com/widget.js
 *   NEXT_PUBLIC_ACCESSIBILITY_WIDGET_SITE_ID=your-site-id
 *
 * When any required variable is absent the component renders nothing and does
 * NOT inject any script tag.  A guard on window.__fhf_a11y_loaded prevents
 * duplicate injection if React renders this component more than once.
 *
 * Do NOT add custom widget logic here.  This file is the dedicated location
 * for third-party widget integration only.
 */

import { useEffect } from "react";

const ENABLED =
  process.env.NEXT_PUBLIC_ACCESSIBILITY_WIDGET_ENABLED === "true";
const SCRIPT_URL = process.env.NEXT_PUBLIC_ACCESSIBILITY_WIDGET_SCRIPT_URL;
const SITE_ID = process.env.NEXT_PUBLIC_ACCESSIBILITY_WIDGET_SITE_ID;

declare global {
  interface Window {
    __fhf_a11y_loaded?: boolean;
  }
}

export default function AccessibilityWidgetEmbed() {
  useEffect(() => {
    if (!ENABLED || !SCRIPT_URL || !SITE_ID) return;
    if (window.__fhf_a11y_loaded) return;

    window.__fhf_a11y_loaded = true;

    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    if (SITE_ID) script.setAttribute("data-site-id", SITE_ID);
    document.body.appendChild(script);

    return () => {
      // Cleanup on unmount only in dev strict-mode double-invocation
      if (document.body.contains(script)) {
        document.body.removeChild(script);
        window.__fhf_a11y_loaded = false;
      }
    };
  }, []);

  // Renders nothing — widget attaches its own UI to document.body
  return null;
}
