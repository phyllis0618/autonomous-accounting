import { getLedger } from "@/lib/ledger";
import Link from "next/link";
import { notFound } from "next/navigation";

const STAGE_LABELS: Record<number, string> = {
  1: "Stage 1 — Event Extractor (Perception)",
  2: "Stage 2 — Discipline Matcher (Reasoning)",
  3: "Stage 3 — Principle Validator (Guardrail)",
  4: "Stage 4 — Persistence (Execution)",
};

export default async function TracePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const pipeline = await getLedger().getPipelineFull(id);
  if (!pipeline) notFound();

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <nav className="mb-8 text-sm text-zinc-500">
        <Link href="/" className="hover:text-zinc-300">
          ← Pipelines
        </Link>
      </nav>

      <header className="mb-10 border-b border-white/10 pb-8">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
          Trace view
        </p>
        <h1 className="mt-1 font-mono text-lg text-zinc-100">{pipeline.id}</h1>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <StatusPill status={pipeline.status} />
          <span className="rounded-md border border-white/10 px-2 py-1 text-zinc-400">
            source: {pipeline.rawInputType}
          </span>
          <span className="rounded-md border border-white/10 px-2 py-1 text-zinc-400">
            {new Date(pipeline.createdAt).toLocaleString()}
          </span>
        </div>
      </header>

      <ol className="relative space-y-8 border-l border-white/10 pl-8">
        {pipeline.stages
          .filter((s) => s.stageIndex >= 1 && s.stageIndex <= 4)
          .map((stage) => (
            <li key={stage.id} className="relative">
              <span className="absolute -left-[34px] top-1 flex size-3 rounded-full border-2 border-violet-400 bg-zinc-950" />
              <article className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
                <h2 className="text-sm font-medium text-zinc-100">
                  {STAGE_LABELS[stage.stageIndex] ?? stage.name}
                </h2>
                <p className="mt-1 text-xs text-zinc-500">{stage.name}</p>

                {stage.confidence != null && (
                  <p className="mt-3 font-mono text-xs text-zinc-400">
                    Confidence:{" "}
                    <span className="text-violet-300">
                      {(stage.confidence * 100).toFixed(1)}%
                    </span>
                  </p>
                )}

                {stage.principlesApplied.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs uppercase tracking-wider text-zinc-500">
                      Principles applied
                    </p>
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {stage.principlesApplied.map((p) => (
                        <li
                          key={p}
                          className={
                            p.startsWith("Applied Principle:")
                              ? "rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-200"
                              : "rounded-md border border-white/10 px-2 py-1 text-xs text-zinc-300"
                          }
                        >
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {stage.reasoningTrace && (
                  <div className="mt-4 rounded-lg border border-white/5 bg-zinc-950/80 p-3">
                    <p className="text-xs uppercase tracking-wider text-zinc-500">
                      Reasoning trace
                    </p>
                    <pre className="mt-2 whitespace-pre-wrap font-mono text-xs leading-relaxed text-zinc-400">
                      {stage.reasoningTrace}
                    </pre>
                  </div>
                )}

                <StageJson output={stage.outputJson} index={stage.stageIndex} />
              </article>
            </li>
          ))}
      </ol>

      {pipeline.stages
        .filter((s) => s.stageIndex === 5)
        .map((stage) => (
          <div
            key={stage.id}
            className="mt-8 rounded-xl border border-red-500/30 bg-red-950/20 p-4 text-sm text-red-200"
          >
            <p className="font-medium">{stage.name}</p>
            {stage.reasoningTrace && (
              <pre className="mt-2 whitespace-pre-wrap font-mono text-xs text-red-300/90">
                {stage.reasoningTrace}
              </pre>
            )}
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-red-300/70">
                Details
              </summary>
              <pre className="mt-2 overflow-auto rounded-lg bg-black/30 p-3 font-mono text-[11px]">
                {JSON.stringify(stage.outputJson, null, 2)}
              </pre>
            </details>
          </div>
        ))}

      {pipeline.journalEntry && (
        <section className="mt-10 rounded-xl border border-white/10 bg-white/[0.03] p-5">
          Committed journal{" "}
          <span className="font-mono text-violet-300">
            {pipeline.journalEntry.id}
          </span>
          <p className="mt-2 text-sm text-zinc-400">
            {pipeline.journalEntry.description}
          </p>
          <table className="mt-4 w-full text-left text-sm">
            <thead>
              <tr className="text-xs text-zinc-500">
                <th className="pb-2">Account</th>
                <th className="pb-2">Debit</th>
                <th className="pb-2">Credit</th>
              </tr>
            </thead>
            <tbody className="font-mono text-zinc-300">
              {pipeline.journalEntry.lines.map((line) => (
                <tr key={line.id} className="border-t border-white/5">
                  <td className="py-2">
                    {line.account.code} — {line.account.name}
                  </td>
                  <td>{String(line.debit)}</td>
                  <td>{String(line.credit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    COMMITTED: "border-emerald-500/40 bg-emerald-500/15 text-emerald-200",
    HITL_PENDING: "border-amber-500/40 bg-amber-500/15 text-amber-200",
    FAILED: "border-red-500/40 bg-red-500/15 text-red-200",
    RUNNING: "border-zinc-500/40 bg-zinc-500/15 text-zinc-200",
  };
  return (
    <span
      className={`rounded-md border px-2 py-1 text-xs ${styles[status] ?? styles.RUNNING}`}
    >
      {status}
    </span>
  );
}

function StageJson({
  output,
  index,
}: {
  output: unknown;
  index: number;
}) {
  if (index === 3) {
    return (
      <details className="mt-4">
        <summary className="cursor-pointer text-xs text-zinc-500">
          Auditor payload
        </summary>
        <pre className="mt-2 max-h-56 overflow-auto rounded-lg bg-zinc-950 p-3 font-mono text-[11px] text-zinc-500">
          {JSON.stringify(output, null, 2)}
        </pre>
      </details>
    );
  }
  return (
    <details className="mt-4">
      <summary className="cursor-pointer text-xs text-zinc-500">
        Structured output
      </summary>
      <pre className="mt-2 max-h-56 overflow-auto rounded-lg bg-zinc-950 p-3 font-mono text-[11px] text-zinc-500">
        {JSON.stringify(output, null, 2)}
      </pre>
    </details>
  );
}
