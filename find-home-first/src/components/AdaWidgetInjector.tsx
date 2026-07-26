/**
 * AdaWidgetInjector — renders the platform owner's ADA widget embed code.
 *
 * RULES:
 * - Rendered only when the platform owner has enabled a non-empty embed code.
 * - Uses dangerouslySetInnerHTML to preserve script tags exactly as provided.
 * - suppressHydrationWarning prevents hydration mismatch for script elements.
 * - Isolated in its own component; no business logic here.
 * - Never displayed in the Back Office editor; this is strictly the injection point.
 * - The embed code is NOT shown to operators — they never see this component.
 *
 * Preventing duplicate injection during Next.js navigation:
 * Script tags rendered inside the DOM by dangerouslySetInnerHTML are static
 * string content that Next.js manages as part of server rendering.
 * For SPA navigation (React transitions), the component stays mounted and
 * does not re-render because `code` does not change between route transitions.
 * This prevents duplicate widget injection.
 */

interface Props {
  code: string;
}

export default function AdaWidgetInjector({ code }: Props) {
  return (
    <div
      id="ada-widget-container"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: code }}
      suppressHydrationWarning
    />
  );
}
