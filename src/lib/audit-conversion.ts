import { z } from "zod";

export const conversionResultsSchema = z.array(z.object({
  import_id: z.string(),
  first_name: z.string().nullish(),
  last_name: z.string().nullish(),
  status: z.enum(["converted", "duplicate", "skipped", "failed"]),
  student_id: z.string().optional(),
  in_no_class: z.boolean().optional(),
  source_class_name: z.string().optional(),
  reason: z.string().nullish(),
}));
export type ConversionResult = z.infer<typeof conversionResultsSchema>[number];
export function conversionCounts(results: ConversionResult[]) {
  return {
    converted: results.filter((r) => r.status === "converted").length,
    noClass: results.filter((r) => r.status === "converted" && r.in_no_class).length,
    skipped: results.filter((r) => r.status === "duplicate" || r.status === "skipped").length,
    failed: results.filter((r) => r.status === "failed").length,
  };
}