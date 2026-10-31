import { z } from "zod";

/*
 * The generated codebase's data model: the entities the screens show and create, with seed rows so the app
 * looks alive on first run. Keys are sanitised in code (normalizeDataModel), not trusted from the model.
 */

export const FIELD_TYPES = ["text", "longtext", "number", "money", "date", "boolean", "email", "select"] as const;

export const codebaseDataSchema = z.object({
  entities: z
    .array(
      z.object({
        key: z.string().max(40),
        label: z.string().max(60),
        fields: z.array(z.object({ key: z.string().max(40), label: z.string().max(60), type: z.enum(FIELD_TYPES), options: z.array(z.string().max(60)).max(8) })).min(1).max(10),
        seed: z.array(z.object({ values: z.array(z.object({ field: z.string().max(40), value: z.string().max(300) })).max(10) })).max(6),
      }),
    )
    .min(1)
    .max(6),
});
export type CodebaseData = z.output<typeof codebaseDataSchema>;

export type Entity = { key: string; label: string; fields: { key: string; label: string; type: (typeof FIELD_TYPES)[number]; options: string[] }[] };
export type SeedRow = Record<string, string | number | boolean> & { id: string; createdAt: string };

const entityKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/^(\d)/, "_$1").slice(0, 40) || "items";
const fieldKey = (s: string) => {
  const parts = s.replace(/[^a-zA-Z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean);
  const key = parts.map((p, i) => (i ? p[0].toUpperCase() + p.slice(1) : p[0].toLowerCase() + p.slice(1))).join("");
  return /^[a-zA-Z]/.test(key) ? key.slice(0, 40) : `f${key}`.slice(0, 40);
};

/** Safe, unique keys and typed seed rows (numbers as numbers, booleans as booleans), dated a day apart. */
export function normalizeDataModel(data: CodebaseData, now = new Date()): { entities: Entity[]; seed: Record<string, SeedRow[]> } {
  const entities: Entity[] = [];
  const seed: Record<string, SeedRow[]> = {};
  for (const e of data.entities) {
    const key = entityKey(e.key || e.label);
    if (entities.some((x) => x.key === key)) continue;
    const fields: Entity["fields"] = [];
    for (const f of e.fields) {
      const k = fieldKey(f.key || f.label);
      if (k === "id" || k === "createdAt" || fields.some((x) => x.key === k)) continue;
      fields.push({ key: k, label: f.label || k, type: f.type, options: f.type === "select" ? f.options : [] });
    }
    if (!fields.length) continue;
    entities.push({ key, label: e.label || key, fields });
    seed[key] = e.seed.map((row, i) => {
      const out: SeedRow = { id: `${key}_${i + 1}`, createdAt: new Date(now.getTime() - (i + 1) * 86_400_000).toISOString() };
      for (const v of row.values) {
        const field = fields.find((f) => f.key === fieldKey(v.field));
        if (!field) continue;
        out[field.key] = field.type === "number" || field.type === "money" ? Number(v.value.replace(/[^0-9.-]/g, "")) || 0 : field.type === "boolean" ? /^(true|yes|1)$/i.test(v.value.trim()) : v.value;
      }
      return out;
    });
  }
  return { entities, seed };
}
