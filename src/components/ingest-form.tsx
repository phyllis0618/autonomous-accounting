"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function IngestForm({ disabled = false }: { disabled?: boolean }) {
  const router = useRouter();
  const [sourceType, setSourceType] = useState<"bank_csv" | "pdf_text">(
    "bank_csv",
  );
  const [rawContent, setRawContent] = useState(
    `DATE,DESC,AMOUNT
2026-03-20,"STRIPE *SUBSCRIPTION",-499.00
REF: Invoice SUB-1024 — recurring monthly SaaS`,
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (disabled) return;
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch("/api/pipeline/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceType, rawContent }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        pipelineId?: string;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.pipelineId) {
        const msg = data.error;
        setErr(
          typeof msg === "string" ? msg : JSON.stringify(msg ?? res.statusText),
        );
        return;
      }
      router.push(`/trace/${data.pipelineId}`);
    } catch (x) {
      setErr(x instanceof Error ? x.message : String(x));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-xl border border-white/10 bg-white/[0.03] p-5"
    >
      <div className="flex flex-wrap gap-4">
        <label className="text-sm text-zinc-400">
          <span className="mb-1 block text-xs uppercase tracking-wider">
            Source
          </span>
          <select
            value={sourceType}
            disabled={disabled}
            onChange={(e) =>
              setSourceType(e.target.value as "bank_csv" | "pdf_text")
            }
            className="rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 disabled:opacity-50"
          >
            <option value="bank_csv">Bank CSV</option>
            <option value="pdf_text">PDF text / OCR</option>
          </select>
        </label>
        <div className="text-sm text-zinc-400">
          <span className="mb-1 block text-xs uppercase tracking-wider">
            Demo: force HITL
          </span>
          <button
            type="button"
            disabled={disabled}
            onClick={() =>
              setRawContent(
                (c) =>
                  `${c}\nNote: force-hitl — ambiguous contract modification.`,
              )
            }
            className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200 disabled:opacity-50"
          >
            Append low-confidence hint
          </button>
        </div>
      </div>
      <label className="block text-sm text-zinc-400">
        <span className="mb-1 block text-xs uppercase tracking-wider">
          Raw content
        </span>
        <textarea
          value={rawContent}
          disabled={disabled}
          onChange={(e) => setRawContent(e.target.value)}
          rows={10}
          className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 disabled:opacity-50"
        />
      </label>
      {err && (
        <p className="rounded-lg border border-red-500/30 bg-red-950/40 px-3 py-2 text-sm text-red-200">
          {err}
        </p>
      )}
      <button
        type="submit"
        disabled={busy || disabled}
        className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-950 disabled:opacity-50"
      >
        {disabled
          ? "Fix database setup to run pipeline"
          : busy
            ? "Running pipeline…"
            : "Run multi-stage pipeline"}
      </button>
    </form>
  );
}
