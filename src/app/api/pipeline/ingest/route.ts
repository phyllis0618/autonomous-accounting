import { runPipeline } from "@/lib/pipeline/run-pipeline";
import { RawIngestionSchema } from "@/lib/schemas/accounting";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = unknownToRecord(await req.json());
    const input = RawIngestionSchema.parse(body);
    const pipeline = await runPipeline(input);
    return NextResponse.json({
      ok: true,
      pipelineId: pipeline.id,
      status: pipeline.status,
    });
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json(
        { ok: false, error: e.flatten() },
        { status: 400 },
      );
    }
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

function unknownToRecord(x: unknown): Record<string, unknown> {
  if (typeof x === "object" && x !== null && !Array.isArray(x)) {
    return x as Record<string, unknown>;
  }
  throw new Error("Expected JSON object body");
}
