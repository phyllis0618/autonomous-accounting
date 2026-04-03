import { db } from "@/lib/db";
import { PipelineStatus } from "@prisma/client";
import type {
  AccountRow,
  PipelineFull,
  RecentPipelineRow,
} from "./types";

const includeFull = {
  stages: { orderBy: { stageIndex: "asc" as const } },
  journalEntry: {
    include: {
      lines: { include: { account: true }, orderBy: { id: "asc" as const } },
    },
  },
};

export const prismaLedger = {
  async createPipeline(input: {
    rawInputType: string;
    rawInputBlob: string;
    status: PipelineStatus;
  }) {
    const row = await db.transactionPipeline.create({
      data: {
        rawInputType: input.rawInputType,
        rawInputBlob: input.rawInputBlob,
        status: input.status,
      },
    });
    return { id: row.id };
  },

  async updatePipeline(
    id: string,
    patch: Partial<{ status: PipelineStatus; journalEntryId: string | null }>,
  ) {
    await db.transactionPipeline.update({ where: { id }, data: patch });
  },

  async listAccounts(): Promise<AccountRow[]> {
    const rows = await db.account.findMany({ orderBy: { code: "asc" } });
    return rows.map((a) => ({
      id: a.id,
      code: a.code,
      name: a.name,
      type: a.type,
    }));
  },

  async addStage(
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
  ) {
    await db.pipelineStage.create({
      data: {
        pipelineId,
        stageIndex: data.stageIndex,
        name: data.name,
        outputJson: JSON.parse(JSON.stringify(data.output)),
        principlesApplied: data.principlesApplied,
        confidence: data.confidence ?? null,
        reasoningTrace: data.reasoningTrace ?? null,
        auditorNotes: data.auditorNotes ?? null,
      },
    });
  },

  async getPipelineFull(id: string): Promise<PipelineFull | null> {
    const p = await db.transactionPipeline.findUnique({
      where: { id },
      include: includeFull,
    });
    if (!p) return null;
    return {
      id: p.id,
      journalEntryId: p.journalEntryId,
      rawInputType: p.rawInputType,
      rawInputBlob: p.rawInputBlob,
      status: p.status,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      stages: p.stages.map((s) => ({
        id: s.id,
        pipelineId: s.pipelineId,
        stageIndex: s.stageIndex,
        name: s.name,
        outputJson: s.outputJson,
        principlesApplied: s.principlesApplied,
        confidence: s.confidence,
        reasoningTrace: s.reasoningTrace,
        auditorNotes: s.auditorNotes,
        createdAt: s.createdAt,
      })),
      journalEntry: p.journalEntry
        ? {
            id: p.journalEntry.id,
            description: p.journalEntry.description,
            sourceRef: p.journalEntry.sourceRef,
            confidence: p.journalEntry.confidence,
            committed: p.journalEntry.committed,
            hitlRequired: p.journalEntry.hitlRequired,
            committedAt: p.journalEntry.committedAt,
            createdAt: p.journalEntry.createdAt,
            lines: p.journalEntry.lines.map((l) => ({
              id: l.id,
              journalEntryId: l.journalEntryId,
              accountId: l.accountId,
              debit: l.debit.toString(),
              credit: l.credit.toString(),
              memo: l.memo,
              account: {
                id: l.account.id,
                code: l.account.code,
                name: l.account.name,
                type: l.account.type,
              },
            })),
          }
        : null,
    };
  },

  async listRecentPipelines(limit: number): Promise<RecentPipelineRow[]> {
    return db.transactionPipeline.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        status: true,
        createdAt: true,
        rawInputType: true,
      },
    });
  },

  async commitJournal(params: {
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
  }) {
    return db.$transaction(async (tx) => {
      const entry = await tx.journalEntry.create({
        data: {
          description: params.description,
          sourceRef: params.sourceRef,
          confidence: params.confidence,
          committed: true,
          hitlRequired: false,
          committedAt: new Date(),
        },
      });

      for (const line of params.lines) {
        const account = await tx.account.findUnique({
          where: { code: line.accountCode },
        });
        if (!account) {
          throw new Error(`Unknown account code: ${line.accountCode}`);
        }
        await tx.journalLine.create({
          data: {
            journalEntryId: entry.id,
            accountId: account.id,
            debit: line.debit,
            credit: line.credit,
            memo: line.memo ?? null,
          },
        });
      }

      await tx.transactionPipeline.update({
        where: { id: params.pipelineId },
        data: {
          status: PipelineStatus.COMMITTED,
          journalEntryId: entry.id,
        },
      });

      return { journalEntryId: entry.id };
    });
  },
};
