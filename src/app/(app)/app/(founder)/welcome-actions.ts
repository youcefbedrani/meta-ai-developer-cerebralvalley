"use server";

import { requireFounder } from "@/server/auth/current-user";
import { markWelcomeSeen } from "@/server/data/users";

/** The founder closed the one-time welcome popup; never show it again on any device. */
export async function dismissWelcomeAction(): Promise<void> {
  const user = await requireFounder();
  await markWelcomeSeen(user.id);
}
