import { IngestForm } from "@/components/ingest-form";
import { getLedger, isDemoStoreEnabled } from "@/lib/ledger";
import { Prisma, type PipelineStatus } from "@prisma/client";
import Link from "next/link";

export const dynamic = "force-dynamic";

type RecentPipelineRow = {
  id: string;
  status: PipelineStatus;
  createdAt: Date;
  rawInputType: string;
};

export default async function Home() {
  const demo = isDemoStoreEnabled();
  let recent: RecentPipelineRow[] = [];
  let dbSetupError: string | null = null;

  try {
    recent = await getLedger().listRecentPipelines(12);
  } catch (e) {
    if (
      !demo &&
      e instanceof Prisma.PrismaClientKnownRequestError &&
      (e.code === "P2021" || e.code === "P1001" || e.code === "P1017")
    ) {
      dbSetupError =
        e.code === "P2021"
          ? "Database tables are missing. Run migrations against DATABASE_URL (see banner below)."
          : "Cannot reach the database. Check DATABASE_URL and that PostgreSQL is running.";
    } else {
      throw e;
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      {demo && (
        <div
          className="mb-6 rounded-xl border border-cyan-500/35 bg-cyan-950/35 px-4 py-3 text-sm text-cyan-100"
          role="status"
        >
          <p className="font-medium">Live demo · in-memory store</p>
          <p className="mt-1 text-cyan-100/85">
            No database required. Two sample runs are preloaded: one{" "}
            <strong className="font-medium text-cyan-50">auto-committed</strong>{" "}
            to the ledger, one{" "}
            <strong className="font-medium text-cyan-50">
              queued for human review
            </strong>{" "}
            (HITL). Use the form below to execute the full four-stage agent
            pipeline; in-memory state clears when you restart the dev server.
            For Postgres + Prisma, set{" "}
            <code className="rounded bg-black/30 px-1">USE_DATABASE=true</code>{" "}
            and a standard{" "}
            <code className="rounded bg-black/30 px-1">DATABASE_URL</code> in{" "}
            <code className="rounded bg-black/30 px-1">.env</code>.
          </p>
          <p className="mt-3 text-xs text-cyan-200/90">
            Jump to trace:{" "}
            <Link
              href="/trace/demo-pipeline-committed"
              className="font-medium underline decoration-cyan-500/60 underline-offset-2 hover:text-cyan-50"
            >
              Committed run
            </Link>
            <span className="mx-1.5 text-cyan-600">·</span>
            <Link
              href="/trace/demo-pipeline-hitl"
              className="font-medium underline decoration-cyan-500/60 underline-offset-2 hover:text-cyan-50"
            >
              HITL run
            </Link>
          </p>
        </div>
      )}

      {dbSetupError && (
        <div
          className="mb-8 rounded-xl border border-amber-500/40 bg-amber-950/40 px-4 py-3 text-sm text-amber-100"
          role="alert"
        >
          <p className="font-medium">Database not ready</p>
          <p className="mt-2 text-amber-200/90">{dbSetupError}</p>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-black/40 p-3 font-mono text-xs text-zinc-300">
            {`DATABASE_URL="postgresql://USER:PASS@localhost:5432/autonomous_accounting"\nUSE_DATABASE=true\nnpx prisma migrate deploy\nnpm run db:seed`}
          </pre>
        </div>
      )}

      <header className="mb-10">
        <p className="text-xs uppercase tracking-[0.25em] text-zinc-500">
          Autonomous accounting
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-100">
          Multi-stage AI agent pipeline
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">
          Perception → reasoning → principle guardrail → ledger. Zod validates
          each stage; committed journals post only when the auditor clears the
          confidence threshold (or use the in-memory demo without Postgres).
        </p>
      </header>

      <section className="mb-14">
        <h2 className="mb-3 text-sm font-medium text-zinc-300">New run</h2>
        <IngestForm disabled={!!dbSetupError} />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-zinc-300">
          Recent pipelines
        </h2>
        {recent.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No runs yet. In demo mode you should see sample rows — refresh the
            page. With a database, migrate and seed first.
          </p>
        ) : (
          <ul className="divide-y divide-white/10 rounded-xl border border-white/10 bg-white/[0.02]">
            {recent.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/trace/${p.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-white/[0.04]"
                >
                  <span className="font-mono text-xs text-violet-300">
                    {p.id}
                  </span>
                  <span className="text-zinc-500">{p.rawInputType}</span>
                  <span className="text-xs text-zinc-500">{p.status}</span>
                  <span className="text-xs text-zinc-600">
                    {new Date(p.createdAt).toLocaleString()}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
