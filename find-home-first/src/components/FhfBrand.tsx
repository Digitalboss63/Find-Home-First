"use client";

import Link from "next/link";

const LOGO_URL = "/images/fhf-logo.svg";

function LogoMark({ className }: { className: string }) {
  return (
    <span
      aria-hidden="true"
      className={className}
      style={{
        backgroundImage: `url(${LOGO_URL})`,
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundSize: "contain",
      }}
    />
  );
}

export default function FhfBrand() {
  return (
    <>
      <div
        className="pointer-events-none fixed left-0 top-0 z-30 hidden h-[122px] w-56 items-center px-5 lg:flex xl:w-60"
        style={{ backgroundColor: "var(--color-primary)" }}
      >
        <Link
          href="/"
          aria-label="Find Home First — go to home workspace"
          className="pointer-events-auto flex items-center gap-3 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <LogoMark className="block h-[62px] w-[76px] shrink-0" />
          <span className="min-w-0">
            <span className="block text-[15px] font-bold leading-tight tracking-tight text-white">
              Find Home First
            </span>
            <span className="mt-1 block text-[9px] font-medium uppercase tracking-[0.16em] text-white/45">
              Housing Workspace
            </span>
          </span>
        </Link>
      </div>

      <div
        className="pointer-events-none fixed left-0 top-0 z-20 flex h-[53px] w-[205px] items-center px-4 lg:hidden"
        style={{ backgroundColor: "var(--color-primary)" }}
      >
        <Link
          href="/"
          aria-label="Find Home First — go to home workspace"
          className="pointer-events-auto flex items-center gap-2 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <LogoMark className="block h-[38px] w-[48px] shrink-0" />
          <span className="text-sm font-bold leading-tight text-white">Find Home First</span>
        </Link>
      </div>
    </>
  );
}
