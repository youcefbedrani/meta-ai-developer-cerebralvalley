import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { FounderProfileView } from "@/components/profile/founder-profile";
import { requireOnboardedUser } from "@/server/auth/current-user";
import { getFounderData } from "@/server/data/founder-data";

export const metadata: Metadata = { title: "My profile" };

export default async function ProfilePage() {
  const user = await requireOnboardedUser();
  const data = await getFounderData(user.id);
  return (
    <div className="space-y-6">
      <PageHeader title="My profile & data" description="Your answers and your work on Startum, at a glance: who you are as a founder, what that means for how you build, and how far you've come." />
      <FounderProfileView data={data} />
    </div>
  );
}
