/**
 * SkipLink – keyboard shortcut to bypass navigation and jump to main content.
 * Target: <main id="main-content"> in every page layout.
 */
export default function SkipLink() {
  return (
    <a href="#main-content" className="skip-link">
      Skip to main content
    </a>
  );
}
