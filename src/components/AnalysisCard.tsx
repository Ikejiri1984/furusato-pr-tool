"use client";

import { BrainCircuit } from "lucide-react";

import { CopyButton } from "@/components/CopyButton";
import type { AnalysisResponse } from "@/lib/types";

type AnalysisCardProps = {
  result: AnalysisResponse;
};

export function AnalysisCard({ result }: AnalysisCardProps) {
  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
      {result.notice ? (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
          {result.notice}
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-teal-800">
            <BrainCircuit size={14} />
            Step 1
          </p>
          <h2 className="mt-2 text-lg font-bold text-neutral-950">
            企業分析
          </h2>
        </div>
        <CopyButton text={result.analysis} />
      </div>

      <pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-neutral-700">
        {result.analysis}
      </pre>

      <div className="mt-4 flex flex-wrap gap-2 text-xs text-neutral-500">
        <span className="rounded-full border border-neutral-200 px-3 py-1">
          {result.demo ? "Demo Mode" : "AI Generated"}
        </span>
        <span className="rounded-full border border-neutral-200 px-3 py-1">
          Model: {result.model}
        </span>
      </div>
    </section>
  );
}
