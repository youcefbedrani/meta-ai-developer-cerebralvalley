import { notFound } from "next/navigation";
import { requireOnboardedUser } from "@/server/auth/current-user";
import { isAdmin } from "@/server/marketplace/config";

/** The whole admin console 404s for anyone who isn't a platform admin. */
export default async function AdminLayout({ children }: LayoutProps<"/app/admin">) {
  const user = await requireOnboardedUser();
  if (!isAdmin(user)) notFound();
  // Navigation lives in the sidebar (components/app/nav.ts ADMIN_NAV_ITEMS).
  return children;
}
