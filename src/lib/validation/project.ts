import { z } from "zod";

export const PROJECT_STAGES = [
  { value: "idea", label: "Idea" },
  { value: "research", label: "Research" },
  { value: "validation", label: "Validation" },
  { value: "planning", label: "Planning" },
  { value: "building", label: "Building" },
  { value: "launched", label: "Launched" },
] as const;

const stageValues = PROJECT_STAGES.map((s) => s.value) as unknown as [
  (typeof PROJECT_STAGES)[number]["value"],
  ...(typeof PROJECT_STAGES)[number]["value"][],
];

export const createProjectSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
  description: z.string().trim().max(2000).default(""),
});

export const updateProjectSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    description: z.string().trim().max(2000),
    stage: z.enum(stageValues),
    nextAction: z.string().trim().max(300).nullable(),
  })
  .partial();

export const projectIdSchema = z.uuid("Invalid project id");

export type CreateProjectInput = z.input<typeof createProjectSchema>;
export type UpdateProjectInput = z.input<typeof updateProjectSchema>;
export type ProjectStage = (typeof PROJECT_STAGES)[number]["value"];
