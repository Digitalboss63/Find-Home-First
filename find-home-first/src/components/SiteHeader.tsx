import Link from "next/link";

export default function SiteHeader() {
  return (
    <header
      role="banner"
      className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950"
    >
      <div className="mx-auto max-w-5xl flex items-center justify-between px-6 py-4">
        <Link
          href="/"
          className="text-lg font-semibold tracking-tight text-[--brand-primary] dark:text-blue-300"
          aria-label="Find Home First — home"
        >
          Find Home First
        </Link>

        <nav aria-label="Primary navigation">
          {/* Navigation items will be added as platform sections are built */}
        </nav>
      </div>
    </header>
  );
}
