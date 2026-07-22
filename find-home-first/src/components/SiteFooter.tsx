export default function SiteFooter() {
  return (
    <footer
      role="contentinfo"
      className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 mt-auto"
    >
      <div className="mx-auto max-w-5xl px-6 py-6 flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">
        <p>
          &copy; {new Date().getFullYear()} Find Home First. All rights
          reserved.
        </p>
      </div>
    </footer>
  );
}
