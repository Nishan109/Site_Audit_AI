import { z } from "zod";
import { evidenceCatalog, type PageEvidence } from "./evidence";
import {
  categorySchema,
  strategySchema,
  issueSchema,
  quickWinSchema,
} from "./schemas";
import { AuditError } from "./errors";

export function groundedReviewSchemas(pages: PageEvidence[]) {
  const catalog = evidenceCatalog(pages);
  if (!catalog.length)
    throw new AuditError(
      "No page citations were available for the audit.",
      422,
      "INSUFFICIENT_EVIDENCE",
    );
  const byId = new Map(catalog.map((source) => [source.id, source]));
  // The model selects a known citation, not an independently typed URL and
  // quotation which can disagree. Source identity is resolved by the server.
  const evidence = z.enum(
    catalog.map((source) => source.id) as [string, ...string[]],
  );
  const issue = issueSchema.omit({ pageUrl: true }).extend({ evidence });
  const quickWin = quickWinSchema.omit({ pageUrl: true }).extend({ evidence });
  return {
    categorySchema: categorySchema.extend({
      issues: z.array(issue).max(6),
      quickWins: z.array(quickWin).max(2),
    }),
    strategySchema: strategySchema.extend({
      aeoAnalysis: strategySchema.shape.aeoAnalysis.extend({
        issues: z.array(issue).max(6),
      }),
    }),
    resolve<T extends { evidence: string }>(items: T[]) {
      return items.map((item) => {
        const source = byId.get(item.evidence);
        if (!source)
          throw new AuditError(
            "An AI finding selected a citation that was not collected.",
            502,
            "UNSUPPORTED_FINDING",
          );
        return { ...item, pageUrl: source.pageUrl, evidence: source.quote };
      });
    },
  };
}
