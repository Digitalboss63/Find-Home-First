/**
 * /projects/[id]/market-intelligence — permanent redirect to /research
 *
 * The City Demographic & Opportunity Report now lives at /projects/[id]/research.
 * Old bookmarks and links continue to work via this permanent redirect.
 */
import { permanentRedirect } from "next/navigation";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function MarketIntelligenceRedirectPage({ params }: Props) {
  const { id } = await params;
  permanentRedirect(`/projects/${id}/research`);
}
