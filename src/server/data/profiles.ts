import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/server/db/client";
import { onboardingSchema, type OnboardingAnswers, type OnboardingInput } from "@/lib/validation/onboarding";
import type { UserId } from "./user-id";

export async function getProfile(userId: UserId): Promise<OnboardingAnswers | null> {
  const [row] = await getDb()
    .select({ answers: schema.profiles.answers })
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, userId))
    .limit(1);
  if (!row) return null;
  const parsed = onboardingSchema.safeParse(row.answers);
  return parsed.success ? parsed.data : null;
}

/** Validates and saves onboarding answers, and marks the user as onboarded. */
export async function saveOnboarding(userId: UserId, input: OnboardingInput): Promise<OnboardingAnswers> {
  const answers = onboardingSchema.parse(input);
  await getDb().transaction(async (tx) => {
    await tx
      .insert(schema.profiles)
      .values({ userId, answers })
      .onConflictDoUpdate({ target: schema.profiles.userId, set: { answers } });
    await tx.update(schema.users).set({ onboardedAt: new Date() }).where(eq(schema.users.id, userId));
  });
  return answers;
}
