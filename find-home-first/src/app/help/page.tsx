import type { Metadata } from "next";
import HelpCenter from "@/components/HelpCenter";

export const metadata: Metadata = {
  title: "Help Center",
  description: "Find Home First feature guidance, instructions, and workflow help.",
};

export default function HelpPage() {
  return <HelpCenter />;
}
