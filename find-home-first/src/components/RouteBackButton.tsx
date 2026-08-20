"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

interface BackTarget {
  href: string;
  label: string;
}

export function getBackTarget(pathname: string, projectQuery?: string | null): BackTarget | null {
  if (pathname === "/projects/new") {
    return { href: "/projects", label: "Back to Projects" };
  }

  const projectMatch = pathname.match(/^\/projects\/([^/]+)(?:\/(.+))?$/);
  if (projectMatch) {
    const [, projectId, nestedPath] = projectMatch;
    return nestedPath
      ? { href: `/projects/${projectId}`, label: "Back to Project" }
      : { href: "/projects", label: "Back to Projects" };
  }

  if (pathname === "/housing-search" && projectQuery) {
    return { href: `/projects/${projectQuery}`, label: "Back to Project" };
  }

  if (pathname.startsWith("/back-office/")) {
    return { href: "/back-office", label: "Back to Back Office" };
  }

  return null;
}

export default function RouteBackButton() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const target = getBackTarget(pathname, searchParams.get("project"));

  if (!target) return null;

  return (
    <div
      style={{
        maxWidth: "64rem",
        margin: "0 auto",
        padding: "1.25rem 1.5rem 0",
      }}
    >
      <Link
        href={target.href}
        aria-label={target.label}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.35rem",
          minHeight: "2.25rem",
          padding: "0.35rem 0.6rem",
          marginLeft: "-0.6rem",
          borderRadius: "0.45rem",
          color: "var(--color-action)",
          fontSize: "0.875rem",
          fontWeight: 600,
          textDecoration: "none",
        }}
      >
        <span aria-hidden="true">←</span>
        <span>{target.label.replace(/^Back to /, "Back to ")}</span>
      </Link>
    </div>
  );
}
