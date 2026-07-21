import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer
      role="contentinfo"
      className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 mt-auto"
    >
      <div className="mx-auto max-w-5xl px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-gray-500 dark:text-gray-400">
        <p>
          &copy; {new Date().getFullYear()} Find Home First. All rights
          reserved.
        </p>
        <nav aria-label="Footer navigation">
          <ul className="flex gap-4 list-none m-0 p-0">
            <li>
              <Link
                href="/accessibility"
                className="hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
              >
                Accessibility Statement
              </Link>
            </li>
            <li>
              <Link
                href="/accessibility-report"
                className="hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
              >
                Report an Issue
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
