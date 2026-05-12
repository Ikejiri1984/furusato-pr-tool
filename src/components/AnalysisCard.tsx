"use client";

import { BrainCircuit } from "lucide-react";

import { CopyButton } from "@/components/CopyButton";
import type { AnalysisResponse } from "@/lib/types";

type AnalysisCardProps = {
  result: AnalysisResponse;
};

export function AnalysisCard({ result }: AnalysisCardProps) {
  const isFallback = result.demo;
  const rows = [
    ["企業特性", result.analysis.companyCharacteristics],
    ["業界課題", result.analysis.industryIssues],
    ["地域接続性", result.analysis.regionalConnectivity],
    ["寄付テーマ仮説", result.analysis.donationThemeHypothesis]
  ];

  return (
    <section
      className={`rounded-lg border p-5 shadow-sm ${
        isFallback
          ? "border-amber-200 bg-amber-50/40"
          : "border-neutral-200 bg-white"
      }`}
    >
      {result.notice ? (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-100/70 px-3 py-2 text-xs leading-5 text-amber-900">
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
        <CopyButton text={result.analysisText} />
      </div>

      <div className="grid gap-3">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className={`rounded-md border px-4 py-3 ${
              isFallback
                ? "border-amber-200 bg-white"
                : "border-neutral-100 bg-neutral-50"
            }`}
          >
            <p className="text-xs font-bold text-neutral-500">{label}</p>
            <p className="mt-1 text-sm leading-6 text-neutral-800">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs text-neutral-500">
        <span
          className={`rounded-full border px-3 py-1 font-bold ${
            isFallback
              ? "border-amber-300 bg-amber-100 text-amber-900"
              : "border-teal-200 bg-teal-50 text-teal-900"
          }`}
        >
          {isFallback ? "ルールベース簡易分析" : "AI分析"}
        </span>
        <span className="rounded-full border border-neutral-200 px-3 py-1">
          Model: {result.model}
        </span>
      </div>
    </section>
  );
}
