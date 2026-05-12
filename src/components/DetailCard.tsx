"use client";

import { FileText } from "lucide-react";

import { CopyButton } from "@/components/CopyButton";
import type { DetailResponse } from "@/lib/types";

type DetailCardProps = {
  result: DetailResponse;
};

export function DetailCard({ result }: DetailCardProps) {
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
            <FileText size={14} />
            Step 3
          </p>
          <h2 className="mt-2 text-lg font-bold text-neutral-950">
            詳細生成
          </h2>
        </div>
        <CopyButton text={result.detail} />
      </div>

      <pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-neutral-700">
        {result.detail}
      </pre>
    </section>
  );
}
