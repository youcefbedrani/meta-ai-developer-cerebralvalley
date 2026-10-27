"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { onboardingSchema } from "@/lib/validation/onboarding";
import { requireUser } from "@/server/auth/current-user";
import { saveOnboarding } from "@/server/data/profiles";

export type OnboardingState = { fieldErrors?: Record<string, string[] | undefined>; ok?: boolean };

/** Receives a plain object from the client form; re-validated here, never trusted. */
export async function saveOnboardingAction(input: unknown): Promise<OnboardingState> {
  const user = await requireUser();
  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[] | undefined> };
  }
  await saveOnboarding(user.id, parsed.data);
  revalidatePath("/app", "layout");
  return { ok: true };
}
