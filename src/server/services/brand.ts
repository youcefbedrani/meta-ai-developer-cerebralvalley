import "server-only";
import { and, eq } from "drizzle-orm";
import { brandKitSchema, contrast, inkOn, parseStoredBrand, suggestSymbol, type StoredBrand } from "@/lib/brand-kit";
import { CREDIT_COSTS } from "@/lib/plans";
import { BRAND_SYSTEM, buildBrandPrompt, mockBrandKit } from "@/server/ai/prompts/brand";
import { runWithCredits } from "@/server/ai/run";
import { getDb, schema } from "@/server/db/client";
import { requireProject } from "@/server/data/projects";
import type { UserId } from "@/server/data/user-id";
import { enforceAiLimits } from "@/server/rate-limit";
import { getProjectContext } from "./project-context";

export async function getBrandKit(userId: UserId, projectId: string): Promise<StoredBrand | null> {
  const project = await requireProject(userId, projectId);
  return parseStoredBrand(project.brand);
}

/** Generates (or regenerates) the project's Brand Kit from its idea and research. */
export async function generateBrandKit(userId: UserId, projectId: string): Promise<StoredBrand> {
  await enforceAiLimits(userId);
  const { project, context } = await getProjectContext(userId, projectId);
  const kit = await runWithCredits({
    userId,
    projectId: project.id,
    operation: "brand_kit",
    tier: "smart",
    credits: CREDIT_COSTS.brand_kit,
    schema: brandKitSchema,
    system: BRAND_SYSTEM,
    prompt: buildBrandPrompt(context),
    mock: () => mockBrandKit(context),
  });
  // The prompt asks for readable colours; enforce it so body text always passes WCAG AA.
  const palette = contrast(kit.palette.text, kit.palette.background) >= 4.5 ? kit.palette : { ...kit.palette, text: inkOn(kit.palette.background) };
  // Older prompts (and some model answers) leave the symbol out; pick one that fits the product.
  const logo = kit.logo.symbol ? kit.logo : { ...kit.logo, symbol: suggestSymbol(`${project.name} ${project.description}`) };
  const stored: StoredBrand = { ...kit, palette, logo, chosen: 0, generatedAt: new Date().toISOString() };
  await getDb().update(schema.projects).set({ brand: stored }).where(and(eq(schema.projects.id, project.id), eq(schema.projects.userId, userId)));
  return stored;
}

/** Picks which name idea the brand uses. */
export async function chooseBrandName(userId: UserId, projectId: string, index: number): Promise<void> {
  const current = await getBrandKit(userId, projectId);
  if (!current || !Number.isInteger(index) || index < 0 || index >= current.names.length) return;
  await getDb().update(schema.projects).set({ brand: { ...current, chosen: index } }).where(and(eq(schema.projects.id, projectId), eq(schema.projects.userId, userId)));
}

/** Picks a logo variant from the free logo studio (shape, symbol or initials). No AI call, no credits. */
export async function chooseBrandLogo(userId: UserId, projectId: string, raw: unknown): Promise<void> {
  const current = await getBrandKit(userId, projectId);
  if (!current) return;
  const logo = brandKitSchema.shape.logo.parse(raw);
  await getDb().update(schema.projects).set({ brand: { ...current, logo } }).where(and(eq(schema.projects.id, projectId), eq(schema.projects.userId, userId)));
}
