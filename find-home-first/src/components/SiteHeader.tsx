/**
 * SiteHeader — structural landmark only.
 * Visual design (colors, layout, sidebar, mobile nav) is REPLIT-UI ownership.
 */
import Link from "next/link";

const NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/projects", label: "Projects" },
  { href: "/housing-search", label: "Housing Search" },
  { href: "/people", label: "People & Contacts" },
  { href: "/tasks", label: "Tasks" },
  { href: "/plan", label: "Plan & Billing" },
];

export default function SiteHeader() {
  return (
    <header role="banner">
      <Link href="/" aria-label="Find Home First — home">
        Find Home First
      </Link>
      <nav aria-label="Primary navigation">
        <ul>
          {NAV_ITEMS.map(({ href, label }) => (
            <li key={href}>
              <Link href={href}>{label}</Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
