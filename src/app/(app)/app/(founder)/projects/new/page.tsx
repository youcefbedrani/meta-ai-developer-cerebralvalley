import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { NewProjectForm } from "@/components/projects/new-project-form";
import { VoicePitch } from "@/components/voice/voice-pitch";
import { CREDIT_COSTS } from "@/lib/plans";
import { isVoiceConfigured } from "@/server/ai/voice";
import { requireOnboardedUser } from "@/server/auth/current-user";

export const metadata: Metadata = { title: "New project" };

export default async function NewProjectPage() {
  await requireOnboardedUser();
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="New project" description="Start with whatever you have. You can refine it as you research." />
      {isVoiceConfigured() ? <VoicePitch cost={CREDIT_COSTS.voice_pitch} /> : null}
      <NewProjectForm />
    </div>
  );
}
