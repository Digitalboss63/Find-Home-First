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
          <ul className="flex items-center gap-6 text-sm font-medium list-none m-0 p-0">
            <li>
              <Link
                href="/accessibility"
                className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
              >
                Accessibility
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
