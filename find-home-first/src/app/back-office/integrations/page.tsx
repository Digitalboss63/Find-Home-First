/**
 * Legacy redirect — /back-office/integrations → /back-office/site-settings/integrations
 * Canonical route is now under site-settings.
 */
import { redirect } from "next/navigation";

export default function IntegrationsRedirectPage() {
  redirect("/back-office/site-settings/integrations");
}
