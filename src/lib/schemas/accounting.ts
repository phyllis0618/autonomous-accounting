import { z } from "zod";

export const IngestSourceTypeSchema = z.enum(["pdf_text", "bank_csv"]);
export type IngestSourceType = z.infer<typeof IngestSourceTypeSchema>;

export const RawIngestionSchema = z.object({
  sourceType: IngestSourceTypeSchema,
  /** Plain text OCR / extracted PDF text, or CSV-as-text */
  rawContent: z.string().min(1),
  /** Optional stable id for idempotency in future */
  externalRef: z.string().optional(),
});

export type RawIngestion = z.infer<typeof RawIngestionSchema>;

export const AtomicEventSchema = z.object({
  who: z.string(),
  what: z.string(),
  amount: z.string().describe("Decimal string, positive for inflows to entity"),
  taxAmount: z.string().optional(),
  currency: z.string().default("USD"),
  occurredAt: z.string().optional(),
  memo: z.string().optional(),
});

export const Stage1ExtractionSchema = z.object({
  events: z.array(AtomicEventSchema),
  extractorNotes: z.string().optional(),
});

export type Stage1Extraction = z.infer<typeof Stage1ExtractionSchema>;

export const JournalLineSchema = z.object({
  accountCode: z.string(),
  debit: z.string(),
  credit: z.string(),
  memo: z.string().optional(),
});

export const Stage2ProposalSchema = z.object({
  description: z.string(),
  lines: z.array(JournalLineSchema),
  principlesApplied: z.array(z.string()),
});

export type Stage2Proposal = z.infer<typeof Stage2ProposalSchema>;

export const Stage3AuditSchema = z.object({
  confidence: z.number().min(0).max(1),
  reasoningTrace: z.string(),
  passed: z.boolean(),
  principleViolations: z.array(z.string()).optional(),
});

export type Stage3Audit = z.infer<typeof Stage3AuditSchema>;
