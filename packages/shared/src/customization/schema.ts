import { z } from "zod";

const promptSectionOverrideSchema = z
  .object({
    enabled: z.boolean().optional(),
    replace: z.string().optional(),
  })
  .strict();

const promptAppendEntrySchema = z
  .object({
    id: z.string().min(1).regex(/^[a-z0-9.-]+$/, "id 仅允许小写字母数字点连字符"),
    title: z.string().min(1),
    after: z.string().min(1).optional(),
    text: z.string(),
  })
  .strict();

const hookActionSchema = z
  .object({
    inject: z.string().optional(),
    run: z.string().min(1).optional(),
    timeoutMs: z.number().int().positive().max(120_000).optional(),
  })
  .strict()
  .refine((v) => v.inject !== undefined || v.run !== undefined, "inject 与 run 至少其一");

const hookRuleSchema = hookActionSchema;

const loopParamsSchema = z
  .object({
    maxTurns: z.number().int().positive().max(10_000).optional(),
    maxToolCallsPerTurn: z.number().int().positive().max(100_000).optional(),
  })
  .strict();

const panelsOverrideSchema = z
  .object({
    order: z.array(z.string().min(1)).optional(),
    disabled: z.array(z.string().min(1)).optional(),
  })
  .strict();

export const overridesFileSchema = z
  .object({
    version: z.literal(1),
    promptSections: z.record(z.string(), promptSectionOverrideSchema).optional(),
    promptAppend: z.array(promptAppendEntrySchema).optional(),
    env: z.record(z.string(), z.string().min(1)).optional(),
    loop: loopParamsSchema.optional(),
    hooks: z
      .object({
        beforeModel: z.array(hookRuleSchema).optional(),
        turnEnd: z.array(hookRuleSchema).optional(),
        compact: z.array(hookRuleSchema).optional(),
      })
      .strict()
      .optional(),
    panels: panelsOverrideSchema.optional(),
  })
  .strict();

export type OverridesFileParsed = z.infer<typeof overridesFileSchema>;

export function parseOverridesFile(input: unknown):
  | { ok: true; value: OverridesFileParsed }
  | { ok: false } {
  const result = overridesFileSchema.safeParse(input);
  return result.success ? { ok: true, value: result.data } : { ok: false };
}
