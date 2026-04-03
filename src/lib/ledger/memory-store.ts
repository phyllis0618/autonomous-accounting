import { AccountType, PipelineStatus } from "@prisma/client";
import type {
  AccountRow,
  JournalEntryRow,
  JournalLineRow,
  PipelineFull,
  PipelineStageRow,
  RecentPipelineRow,
} from "./types";

function rid() {
  return `demo_${Math.random().toString(36).slice(2, 12)}_${Date.now().toString(36)}`;
}

const accountSeed: Omit<AccountRow, "id">[] = [
  { code: "1000", name: "Cash", type: AccountType.ASSET },
  { code: "1010", name: "Bank — Operating", type: AccountType.ASSET },
  { code: "1200", name: "Accounts Receivable", type: AccountType.ASSET },
  { code: "2000", name: "Accounts Payable", type: AccountType.LIABILITY },
  { code: "2100", name: "Sales Tax Payable", type: AccountType.LIABILITY },
  { code: "3000", name: "Retained Earnings", type: AccountType.EQUITY },
  { code: "4000", name: "Subscription Revenue", type: AccountType.REVENUE },
  { code: "4100", name: "Services Revenue", type: AccountType.REVENUE },
  { code: "5000", name: "Software & SaaS Expense", type: AccountType.EXPENSE },
  { code: "5100", name: "Bank Fees", type: AccountType.EXPENSE },
];

class MemoryLedger {
  private accounts = new Map<string, AccountRow>();
  private accountsByCode = new Map<string, AccountRow>();
  private pipelines = new Map<string, PipelineFull>();

  constructor() {
    for (const a of accountSeed) {
      const row: AccountRow = { ...a, id: `acc_${a.code}` };
      this.accounts.set(row.id, row);
      this.accountsByCode.set(row.code, row);
    }
    this.seedStaticDemos();
  }

  private seedStaticDemos() {
    const committedId = "demo-pipeline-committed";
    const hitlId = "demo-pipeline-hitl";
    if (this.pipelines.has(committedId)) return;

    const now = new Date();
    const dayAgo = new Date(now.getTime() - 86400000);

    const entryId = "demo-je-001";
    const committed: PipelineFull = {
      id: committedId,
      journalEntryId: entryId,
      rawInputType: "bank_csv",
      rawInputBlob:
        'DATE,DESC,AMOUNT\n2026-03-20,"STRIPE SUBSCRIPTION",-499.00',
      status: PipelineStatus.COMMITTED,
      createdAt: dayAgo,
      updatedAt: now,
      stages: [
        {
          id: `${committedId}-s1`,
          pipelineId: committedId,
          stageIndex: 1,
          name: "Event Extractor (Perception)",
          outputJson: {
            events: [
              {
                who: "Stripe Payments",
                what: "B2B SaaS subscription charge",
                amount: "499.00",
                taxAmount: "42.33",
                currency: "USD",
                memo: "Inv #SUB-1024",
              },
            ],
            extractorNotes: "Demo: OCR/CSV normalized to single atomic event.",
          },
          principlesApplied: [
            "Perception: normalize heterogeneous inputs into atomic fiscal facts",
          ],
          confidence: null,
          reasoningTrace: "Demo: OCR/CSV normalized to single atomic event.",
          auditorNotes: null,
          createdAt: dayAgo,
        },
        {
          id: `${committedId}-s2`,
          pipelineId: committedId,
          stageIndex: 2,
          name: "Discipline Matcher (Reasoning)",
          outputJson: {
            description: "Subscription revenue + sales tax",
            principlesApplied: [
              "Applied Principle: Double-entry balance (debits = credits)",
              "Applied Principle: Chesterton's Fence for old recurring entries",
              "Applied Principle: Revenue recognition at obligation satisfaction",
            ],
            lines: [
              {
                accountCode: "1010",
                debit: "541.33",
                credit: "0",
                memo: "Cash in",
              },
              { accountCode: "4000", debit: "0", credit: "499", memo: "Revenue" },
              {
                accountCode: "2100",
                debit: "0",
                credit: "42.33",
                memo: "Sales tax payable",
              },
            ],
          },
          principlesApplied: [
            "Applied Principle: Double-entry balance (debits = credits)",
            "Applied Principle: Chesterton's Fence for old recurring entries",
            "Applied Principle: Revenue recognition at obligation satisfaction",
          ],
          confidence: null,
          reasoningTrace: "Balanced entry: debits and credits both 541.33",
          auditorNotes: null,
          createdAt: dayAgo,
        },
        {
          id: `${committedId}-s3`,
          pipelineId: committedId,
          stageIndex: 3,
          name: "Principle Validator (Guardrail)",
          outputJson: {
            confidence: 0.94,
            passed: true,
            reasoningTrace:
              "Demo auditor: entry balances; tax in 2100; revenue in 4000 per policy.",
            principleViolations: [],
          },
          principlesApplied: [
            "Guardrail: independent review against principle document",
          ],
          confidence: 0.94,
          reasoningTrace:
            "Demo auditor: entry balances; tax in 2100; revenue in 4000 per policy.",
          auditorNotes: null,
          createdAt: dayAgo,
        },
        {
          id: `${committedId}-s4`,
          pipelineId: committedId,
          stageIndex: 4,
          name: "Persistence (Execution)",
          outputJson: {
            committed: true,
            journalEntryId: entryId,
            threshold: 0.9,
          },
          principlesApplied: ["Auto-committed: confidence 0.94 > 0.9"],
          confidence: null,
          reasoningTrace: null,
          auditorNotes: null,
          createdAt: dayAgo,
        },
      ],
      journalEntry: {
        id: entryId,
        description: "Subscription revenue + sales tax",
        sourceRef: committedId,
        confidence: 0.94,
        committed: true,
        hitlRequired: false,
        committedAt: now,
        createdAt: dayAgo,
        lines: [
          {
            id: `${entryId}-l1`,
            journalEntryId: entryId,
            accountId: "acc_1010",
            debit: "541.33",
            credit: "0",
            memo: "Cash in",
            account: this.accountsByCode.get("1010")!,
          },
          {
            id: `${entryId}-l2`,
            journalEntryId: entryId,
            accountId: "acc_4000",
            debit: "0",
            credit: "499",
            memo: "Revenue",
            account: this.accountsByCode.get("4000")!,
          },
          {
            id: `${entryId}-l3`,
            journalEntryId: entryId,
            accountId: "acc_2100",
            debit: "0",
            credit: "42.33",
            memo: "Sales tax payable",
            account: this.accountsByCode.get("2100")!,
          },
        ],
      },
    };

    const hitl: PipelineFull = {
      id: hitlId,
      journalEntryId: null,
      rawInputType: "pdf_text",
      rawInputBlob:
        "Invoice total EUR 12,400 — modification to contract term not on file.",
      status: PipelineStatus.HITL_PENDING,
      createdAt: now,
      updatedAt: now,
      stages: [
        {
          id: `${hitlId}-s1`,
          pipelineId: hitlId,
          stageIndex: 1,
          name: "Event Extractor (Perception)",
          outputJson: {
            events: [
              {
                who: "Vendor AG",
                what: "Professional services + term amendment",
                amount: "12400.00",
                currency: "EUR",
              },
            ],
          },
          principlesApplied: [
            "Perception: normalize heterogeneous inputs into atomic fiscal facts",
          ],
          confidence: null,
          reasoningTrace: "Demo: ambiguous performance period on amendment.",
          auditorNotes: null,
          createdAt: now,
        },
        {
          id: `${hitlId}-s2`,
          pipelineId: hitlId,
          stageIndex: 2,
          name: "Discipline Matcher (Reasoning)",
          outputJson: {
            description: "Expense accrual vs deferral (preliminary)",
            principlesApplied: [
              "Applied Principle: Double-entry balance (debits = credits)",
              "Applied Principle: Chesterton's Fence — retained prior expense class pending review",
            ],
            lines: [
              {
                accountCode: "5000",
                debit: "12400",
                credit: "0",
                memo: "Services expense",
              },
              {
                accountCode: "2000",
                debit: "0",
                credit: "12400",
                memo: "AP",
              },
            ],
          },
          principlesApplied: [
            "Applied Principle: Double-entry balance (debits = credits)",
            "Applied Principle: Chesterton's Fence — retained prior expense class pending review",
          ],
          confidence: null,
          reasoningTrace: "Balanced entry: debits and credits both 12400.00",
          auditorNotes: null,
          createdAt: now,
        },
        {
          id: `${hitlId}-s3`,
          pipelineId: hitlId,
          stageIndex: 3,
          name: "Principle Validator (Guardrail)",
          outputJson: {
            confidence: 0.58,
            passed: false,
            reasoningTrace:
              "Demo: revenue/expense timing unclear vs amendment docs; human review required.",
            principleViolations: [
              "Revenue recognition — modification evidence incomplete",
            ],
          },
          principlesApplied: [
            "Guardrail: independent review against principle document",
            "Revenue recognition — modification evidence incomplete",
          ],
          confidence: 0.58,
          reasoningTrace:
            "Demo: revenue/expense timing unclear vs amendment docs; human review required.",
          auditorNotes: "Revenue recognition — modification evidence incomplete",
          createdAt: now,
        },
        {
          id: `${hitlId}-s4`,
          pipelineId: hitlId,
          stageIndex: 4,
          name: "Persistence (Execution)",
          outputJson: {
            committed: false,
            hitl: true,
            threshold: 0.9,
            confidence: 0.58,
          },
          principlesApplied: [
            "Human-in-the-loop: confidence below threshold or auditor failed",
          ],
          confidence: null,
          reasoningTrace: null,
          auditorNotes: null,
          createdAt: now,
        },
      ],
      journalEntry: null,
    };

    this.pipelines.set(committedId, committed);
    this.pipelines.set(hitlId, hitl);
  }

  listAccounts(): AccountRow[] {
    return [...this.accounts.values()].sort((a, b) =>
      a.code.localeCompare(b.code),
    );
  }

  createPipeline(input: {
    rawInputType: string;
    rawInputBlob: string;
    status: PipelineStatus;
  }): { id: string } {
    const id = rid();
    const now = new Date();
    const row: PipelineFull = {
      id,
      journalEntryId: null,
      rawInputType: input.rawInputType,
      rawInputBlob: input.rawInputBlob,
      status: input.status,
      createdAt: now,
      updatedAt: now,
      stages: [],
      journalEntry: null,
    };
    this.pipelines.set(id, row);
    return { id };
  }

  updatePipeline(
    id: string,
    patch: Partial<{ status: PipelineStatus; journalEntryId: string | null }>,
  ) {
    const p = this.pipelines.get(id);
    if (!p) throw new Error(`Unknown pipeline ${id}`);
    if (patch.status !== undefined) p.status = patch.status;
    if (patch.journalEntryId !== undefined)
      p.journalEntryId = patch.journalEntryId;
    p.updatedAt = new Date();
  }

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
  ) {
    const p = this.pipelines.get(pipelineId);
    if (!p) throw new Error(`Unknown pipeline ${pipelineId}`);
    const stage: PipelineStageRow = {
      id: `${pipelineId}-s${data.stageIndex}-${rid()}`,
      pipelineId,
      stageIndex: data.stageIndex,
      name: data.name,
      outputJson: JSON.parse(JSON.stringify(data.output)),
      principlesApplied: data.principlesApplied,
      confidence: data.confidence ?? null,
      reasoningTrace: data.reasoningTrace ?? null,
      auditorNotes: data.auditorNotes ?? null,
      createdAt: new Date(),
    };
    p.stages.push(stage);
    p.stages.sort((a, b) => a.stageIndex - b.stageIndex);
    p.updatedAt = new Date();
  }

  getPipelineFull(id: string): PipelineFull | null {
    const p = this.pipelines.get(id);
    return p ? structuredClone(p) : null;
  }

  listRecentPipelines(limit: number): RecentPipelineRow[] {
    return [...this.pipelines.values()]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit)
      .map((p) => ({
        id: p.id,
        status: p.status,
        createdAt: p.createdAt,
        rawInputType: p.rawInputType,
      }));
  }

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
  }): { journalEntryId: string } {
    const pipeline = this.pipelines.get(params.pipelineId);
    if (!pipeline) throw new Error(`Unknown pipeline ${params.pipelineId}`);
    const entryId = rid();
    const now = new Date();
    const lines: JournalLineRow[] = [];

    for (const ln of params.lines) {
      const acc = this.accountsByCode.get(ln.accountCode);
      if (!acc) throw new Error(`Unknown account code: ${ln.accountCode}`);
      lines.push({
        id: rid(),
        journalEntryId: entryId,
        accountId: acc.id,
        debit: ln.debit,
        credit: ln.credit,
        memo: ln.memo ?? null,
        account: { ...acc },
      });
    }

    const journal: JournalEntryRow = {
      id: entryId,
      description: params.description,
      sourceRef: params.sourceRef,
      confidence: params.confidence,
      committed: true,
      hitlRequired: false,
      committedAt: now,
      createdAt: now,
      lines,
    };

    pipeline.journalEntry = journal;
    pipeline.journalEntryId = entryId;
    pipeline.status = PipelineStatus.COMMITTED;
    pipeline.updatedAt = now;

    return { journalEntryId: entryId };
  }
}

const g = globalThis as unknown as { __memLedger?: MemoryLedger };

export function getMemoryLedger(): MemoryLedger {
  if (!g.__memLedger) g.__memLedger = new MemoryLedger();
  return g.__memLedger;
}