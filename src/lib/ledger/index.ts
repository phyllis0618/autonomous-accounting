import { PipelineStatus } from "@prisma/client";
import { isDemoStoreEnabled } from "./demo-mode";
import { getMemoryLedger } from "./memory-store";
import { prismaLedger } from "./prisma-ledger";
import type {
  AccountRow,
  PipelineFull,
  RecentPipelineRow,
} from "./types";

export type { PipelineFull, RecentPipelineRow } from "./types";
export { isDemoStoreEnabled } from "./demo-mode";

export type AccountingLedger = {
  createPipeline(input: {
    rawInputType: string;
    rawInputBlob: string;
    status: PipelineStatus;
  }): Promise<{ id: string }>;
  updatePipeline(
    id: string,
    patch: Partial<{ status: PipelineStatus; journalEntryId: string | null }>,
  ): Promise<void>;
  listAccounts(): Promise<AccountRow[]>;
  addStage(
    pipelineId: string,
    data: {
      stageIndex: number;
      name: string;
      output: unknown;
      principlesApplied: string[];
      confidence?: number | null;
      reasoningTrace?: string | null;
      auditorNotes?: string | null;
    },
  ): Promise<void>;
  getPipelineFull(id: string): Promise<PipelineFull | null>;
  listRecentPipelines(limit: number): Promise<RecentPipelineRow[]>;
  commitJournal(params: {
    pipelineId: string;
    description: string;
    sourceRef: string;
    confidence: number;
    lines: {
      accountCode: string;
      debit: string;
      credit: string;
      memo?: string | null;
    }[];
  }): Promise<{ journalEntryId: string }>;
};

const memoryAdapter: AccountingLedger = {
  createPipeline: async (input) => getMemoryLedger().createPipeline(input),
  updatePipeline: async (id, patch) => {
    getMemoryLedger().updatePipeline(id, patch);
  },
  listAccounts: async () => getMemoryLedger().listAccounts(),
  addStage: async (pipelineId, data) => {
    getMemoryLedger().addStage(pipelineId, data);
  },
  getPipelineFull: async (id) => getMemoryLedger().getPipelineFull(id),
  listRecentPipelines: async (limit) =>
    getMemoryLedger().listRecentPipelines(limit),
  commitJournal: async (params) => getMemoryLedger().commitJournal(params),
};

export function getLedger(): AccountingLedger {
  return isDemoStoreEnabled() ? memoryAdapter : prismaLedger;
}
