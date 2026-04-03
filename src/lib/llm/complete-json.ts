import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

export type JsonParseFn<T> = (raw: unknown) => T;

function stripJsonFence(text: string): string {
  const t = text.trim();
  if (t.startsWith("```")) {
    return t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  }
  return t;
}

function safeJsonParse(text: string): unknown {
  return JSON.parse(stripJsonFence(text));
}

async function openaiJson(
  system: string,
  user: string,
): Promise<string> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const res = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
  });
  const content = res.choices[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned empty content");
  return content;
}

async function anthropicJson(
  system: string,
  user: string,
): Promise<string> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const model =
    process.env.ANTHROPIC_MODEL ?? "claude-3-5-sonnet-20241022";
  const msg = await client.messages.create({
    model,
    max_tokens: 4096,
    system,
    messages: [{ role: "user", content: user }],
  });
  const block = msg.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    throw new Error("Anthropic returned no text block");
  }
  return block.text;
}

export async function completeJson<T>(
  system: string,
  user: string,
  parse: JsonParseFn<T>,
): Promise<T> {
  const useMock = process.env.LLM_MOCK === "1";
  let rawText: string;

  if (useMock) {
    rawText = await mockResponse(system, user);
  } else if (process.env.OPENAI_API_KEY) {
    rawText = await openaiJson(system, user);
  } else if (process.env.ANTHROPIC_API_KEY) {
    rawText = await anthropicJson(system, user);
  } else {
    rawText = await mockResponse(system, user);
  }

  const parsed = parse(safeJsonParse(rawText));
  return parsed;
}

/** Heuristic mock: stage tags + hints from raw content for demos without API keys. */
async function mockResponse(system: string, user: string): Promise<string> {
  const u = user.toLowerCase();
  if (user.includes("[[STAGE:extract]]")) {
    const isSubscription =
      u.includes("stripe") || u.includes("subscription") || u.includes("recurring");
    return JSON.stringify({
      events: [
        {
          who: isSubscription ? "Stripe Payments" : "Counterparty",
          what: isSubscription
            ? "B2B SaaS subscription charge"
            : "Operating deposit / receipt",
          amount: u.includes("499") ? "499.00" : "1250.00",
          taxAmount: u.includes("no tax") ? "0" : "42.33",
          currency: "USD",
          occurredAt: new Date().toISOString().slice(0, 10),
          memo: isSubscription
            ? "Inv #SUB-1024 — recurring monthly plan"
            : "Bank feed line",
        },
      ],
      extractorNotes:
        "Mock extractor: normalized currency and inferred tax from jurisdiction default.",
    });
  }

  if (user.includes("[[STAGE:match]]")) {
    const amount = u.includes("499") ? "499.00" : "1250.00";
    const tax = u.includes("no tax") ? "0" : "42.33";
    const total = (Number(amount) + Number(tax)).toFixed(2);
    return JSON.stringify({
      description: "Recognize subscription revenue and sales tax liability",
      principlesApplied: [
        "Applied Principle: Double-entry balance (debits = credits)",
        "Applied Principle: Chesterton's Fence for old recurring entries — preserved recurring SaaS pattern pending contra documentation",
        "Applied Principle: Revenue recognition at performance obligation satisfaction (monthly access)",
      ],
      lines: [
        {
          accountCode: "1010",
          debit: total,
          credit: "0",
          memo: "Cash received via processor",
        },
        {
          accountCode: "4000",
          debit: "0",
          credit: amount,
          memo: "Subscription revenue",
        },
        {
          accountCode: "2100",
          debit: "0",
          credit: tax,
          memo: "Sales tax payable",
        },
      ],
    });
  }

  if (user.includes("[[STAGE:audit]]")) {
    const low =
      u.includes("force-hitl") || u.includes("low confidence") || u.includes("haircut");
    return JSON.stringify({
      confidence: low ? 0.62 : 0.94,
      passed: !low,
      reasoningTrace: low
        ? "Mock auditor: ambiguous performance obligation timing vs. contract start date; request human confirmation of ASC 606 treatment for modified arrangements."
        : "Mock auditor: entry balances, tax isolated to 2100, revenue to 4000 consistent with principle document §2 and §4. No Chesterton violation detected for recurring SaaS pattern.",
      principleViolations: low
        ? ["Revenue recognition — modification not fully evidenced in source packet"]
        : [],
    });
  }

  return JSON.stringify({
    error: "mock_fallback",
    system: system.slice(0, 80),
  });
}
