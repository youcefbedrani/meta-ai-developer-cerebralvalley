import { requireFounder } from "@/server/auth/current-user";

/** Founder-only part of the marketplace; admin accounts work from the admin console. */
export default async function MarketplacePayoutsLayout({ children }: { children: React.ReactNode }) {
  await requireFounder();
  return children;
}
