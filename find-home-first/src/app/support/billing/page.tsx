import { redirect } from "next/navigation";

interface LegacySupportBillingPageProps {
  searchParams: Promise<{ org?: string; result?: string }>;
}

export default async function LegacySupportBillingPage({
  searchParams,
}: LegacySupportBillingPageProps) {
  const params = await searchParams;
  const query = new URLSearchParams();

  if (params.org) query.set("org", params.org);
  if (params.result) query.set("result", params.result);

  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  redirect(`/back-office/billing${suffix}`);
}
