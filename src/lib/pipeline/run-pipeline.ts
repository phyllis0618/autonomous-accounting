import { PipelineStatus } from "@prisma/client";
import type { PipelineFull } from "@/lib/ledger";
import { getLedger } from "@/lib/ledger";
import { completeJson } from "@/lib/llm/complete-json";
import { PRINCIPLE_DOCUMENT } from "@/lib/principles/revenue-recognition";
import {
  RawIngestion,
  Stage1ExtractionSchema,
  Stage2ProposalSchema,
  Stage3AuditSchema,
} from "@/lib/schemas/accounting";

function sumMoney(lines: { debit: string; credit: string }[]): {
  debits: number;
  credits: number;
} {
  const debits = lines.reduce((s, l) => s + Number(l.debit), 0);
  const credits = lines.reduce((s, l) => s + Number(l.credit), 0);
  return { debits, credits };
}

function balances(lines: { debit: string; credit: string }[]): boolean {
  const { debits, credits } = sumMoney(lines);
  return Math.abs(debits - credits) < 0.01;
}

async function persistStageRecord(
  pipelineId: string,
  stageIndex: number,
  name: string,
  output: unknown,
  principlesApplied: string[],
  confidence?: number,
  reasoningTrace?: string,
  auditorNotes?: string,
) {
  const ledger = getLedger();
  await ledger.addStage(pipelineId, {
    stageIndex,
    name,
    output,
    principlesApplied,
    confidence: confidence ?? null,
    reasoningTrace: reasoningTrace ?? null,
    auditorNotes: auditorNotes ?? null,
  });
}

async function loadFull(pipelineId: string): Promise<PipelineFull> {
  const ledger = getLedger();
  const full = await ledger.getPipelineFull(pipelineId);
  if (!full) throw new Error(`Pipeline not found: ${pipelineId}`);
  return full;
}

export async function runPipeline(input: RawIngestion): Promise<PipelineFull> {
  const ledger = getLedger();
  const pipeline = await ledger.createPipeline({
    rawInputType: input.sourceType,
    rawInputBlob: input.rawContent.slice(0, 50_000),
    status: PipelineStatus.RUNNING,
  });

  try {
    const stage1 = await completeJson(
      `You are Stage 1 (Event Extractor). Extract atomic accounting events as JSON matching the schema. Stage tag: [[STAGE:extract]]`,
      `[[STAGE:extract]]\nSource type: ${input.sourceType}\nRaw content:\n${input.rawContent}\n\nReturn JSON: { "events": [...], "extractorNotes"?: string }`,
      (raw) => Stage1ExtractionSchema.parse(raw),
    );
    await persistStageRecord(
      pipeline.id,
      1,
      "Event Extractor (Perception)",
      stage1,
      ["Perception: normalize heterogeneous inputs into atomic fiscal facts"],
      undefined,
      stage1.extractorNotes,
    );

    const coa = await ledger.listAccounts();
    const coaText = coa
      .map((a) => `${a.code} ${a.name} (${a.type})`)
      .join("\n");

    const stage2 = await completeJson(
      `You are Stage 2 (Discipline Matcher). Map events to the Chart of Accounts using first principles.
RULE: Every transaction must have debit and credit lines that balance to zero (sum debits = sum credits).
You MUST include principlesApplied citing which rules you used (e.g. Chesterton's Fence, revenue recognition).
Stage tag: [[STAGE:match]]`,
      `[[STAGE:match]]\nChart of Accounts:\n${coaText}\n\nExtracted events JSON:\n${JSON.stringify(stage1.events)}\n\nReturn JSON: { "description", "lines": [{ accountCode, debit, credit, memo? }], "principlesApplied": string[] }`,
      (raw) => Stage2ProposalSchema.parse(raw),
    );

    if (!balances(stage2.lines)) {
      const { debits, credits } = sumMoney(stage2.lines);
      await persistStageRecord(
        pipeline.id,
        2,
        "Discipline Matcher (Reasoning)",
        { ...stage2, balanceError: { debits, credits } },
        stage2.principlesApplied,
      );
      await persistStageRecord(
        pipeline.id,
        3,
        "Principle Validator (Guardrail)",
        {
          skipped: true,
          reason: "Proposal does not balance; auditor not invoked.",
        },
        [],
        0,
        `Debits ${debits} ≠ credits ${credits}`,
      );
      await persistStageRecord(
        pipeline.id,
        4,
        "Persistence (Execution)",
        { committed: false, reason: "Unbalanced proposal" },
        ["Execution gate: no balanced entry to commit"],
      );
      await ledger.updatePipeline(pipeline.id, {
        status: PipelineStatus.FAILED,
      });
      return loadFull(pipeline.id);
    }

    await persistStageRecord(
      pipeline.id,
      2,
      "Discipline Matcher (Reasoning)",
      stage2,
      stage2.principlesApplied,
      undefined,
      `Balanced entry: debits and credits both ${sumMoney(stage2.lines).debits.toFixed(2)}`,
    );

    const stage3 = await completeJson(
      `You are Stage 3 — an independent Auditor LLM. Compare the proposed journal to the Principle Document.
Return JSON ONLY: { "confidence": number 0-1, "reasoningTrace": string, "passed": boolean, "principleViolations"?: string[] }
Stage tag: [[STAGE:audit]]`,
      `[[STAGE:audit]]\nPrinciple Document:\n${PRINCIPLE_DOCUMENT}\n\nProposed journal:\n${JSON.stringify(stage2)}\n\nBe strict: lower confidence on any ambiguity.`,
      (raw) => Stage3AuditSchema.parse(raw),
    );

    await persistStageRecord(
      pipeline.id,
      3,
      "Principle Validator (Guardrail)",
      stage3,
      [
        "Guardrail: independent review against principle document",
        ...(stage3.principleViolations ?? []),
      ],
      stage3.confidence,
      stage3.reasoningTrace,
      stage3.principleViolations?.join("; "),
    );

    const threshold = Number(process.env.AUTO_COMMIT_THRESHOLD ?? "0.9");
    if (stage3.confidence > threshold && stage3.passed) {
      const journal = await ledger.commitJournal({
        pipelineId: pipeline.id,
        description: stage2.description,
        sourceRef: input.externalRef ?? pipeline.id,
        confidence: stage3.confidence,
        lines: stage2.lines,
      });

      await persistStageRecord(
        pipeline.id,
        4,
        "Persistence (Execution)",
        {
          committed: true,
          journalEntryId: journal.journalEntryId,
          threshold,
        },
        [`Auto-committed: confidence ${stage3.confidence} > ${threshold}`],
      );
    } else {
      await ledger.updatePipeline(pipeline.id, {
        status: PipelineStatus.HITL_PENDING,
      });
      await persistStageRecord(
        pipeline.id,
        4,
        "Persistence (Execution)",
        {
          committed: false,
          hitl: true,
          threshold,
          confidence: stage3.confidence,
        },
        ["Human-in-the-loop: confidence below threshold or auditor failed"],
      );
    }

    return loadFull(pipeline.id);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await persistStageRecord(
      pipeline.id,
      5,
      "Pipeline Error",
      { error: message },
      [],
      0,
      message,
    ).catch(() => {
      /* best-effort */
    });
    await ledger.updatePipeline(pipeline.id, { status: PipelineStatus.FAILED });
    throw e;
  }
}
