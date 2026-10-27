import { notFound } from "next/navigation";
import { isModuleOn } from "@/lib/platform-settings";
import { getPlatformSettings } from "@/server/platform/settings";

/** The public marketplace disappears while an admin has turned the module off. */
export default async function PublicMarketplaceLayout({ children }: { children: React.ReactNode }) {
  if (!isModuleOn(await getPlatformSettings(), "marketplace")) notFound();
  return children;
}
