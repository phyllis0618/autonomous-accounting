import type { AccountType, PipelineStatus } from "@prisma/client";

export type AccountRow = {
  id: string;
  code: string;
  name: string;
  type: AccountType;
};

export type PipelineStageRow = {
  id: string;
  pipelineId: string;
  stageIndex: number;
  name: string;
  outputJson: unknown;
  principlesApplied: string[];
  confidence: number | null;
  reasoningTrace: string | null;
  auditorNotes: string | null;
  createdAt: Date;
};

export type JournalLineRow = {
  id: string;
  journalEntryId: string;
  accountId: string;
  debit: string;
  credit: string;
  memo: string | null;
  account: AccountRow;
};

export type JournalEntryRow = {
  id: string;
  description: string;
  sourceRef: string | null;
  confidence: number | null;
  committed: boolean;
  hitlRequired: boolean;
  committedAt: Date | null;
  createdAt: Date;
  lines: JournalLineRow[];
};

export type PipelineFull = {
  id: string;
  journalEntryId: string | null;
  rawInputType: string;
  rawInputBlob: string;
  status: PipelineStatus;
  createdAt: Date;
  updatedAt: Date;
  stages: PipelineStageRow[];
  journalEntry: JournalEntryRow | null;
};

export type RecentPipelineRow = {
  id: string;
  status: PipelineStatus;
  createdAt: Date;
  rawInputType: string;
};
