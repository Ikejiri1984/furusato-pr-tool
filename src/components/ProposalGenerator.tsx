"use client";

import { AlertCircle, FileText, Sparkles } from "lucide-react";
import { useState } from "react";

import { CompanyForm } from "@/components/CompanyForm";
import { LoadingState } from "@/components/LoadingState";
import { ProposalReport } from "@/components/ProposalReport";
import { emptyCompanyInput, sampleCompanyInput } from "@/lib/sample";
import type { CompanyInput, GenerateResponse } from "@/lib/types";

export function ProposalGenerator() {
  const [input, setInput] = useState<CompanyInput>(sampleCompanyInput);
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function updateInput(key: keyof CompanyInput, value: string) {
    setInput((current) => ({
      ...current,
      [key]: value
    }));
  }

  async function handleSubmit() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(input)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "提案生成に失敗しました。");
      }

      setResult(data as GenerateResponse);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "提案生成に失敗しました。時間をおいて再実行してください。"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-[1500px] gap-6 px-4 py-6 md:px-6 lg:grid-cols-[430px_minmax(0,1fr)]">
      <aside className="no-print lg:sticky lg:top-6 lg:self-start">
        <CompanyForm
          value={input}
          loading={loading}
          onChange={updateInput}
          onSubmit={handleSubmit}
          onSample={() => setInput(sampleCompanyInput)}
          onReset={() => {
            setInput(emptyCompanyInput);
            setResult(null);
            setError("");
          }}
        />
      </aside>

      <section className="min-w-0 space-y-4">
        {error ? (
          <div className="no-print flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-900">
            <AlertCircle className="mt-0.5 shrink-0" size={18} />
            <span>{error}</span>
          </div>
        ) : null}

        {loading ? <LoadingState /> : null}

        {!loading && result ? (
          <ProposalReport
            proposal={result.proposal}
            demo={result.demo}
            model={result.model}
            notice={result.notice}
          />
        ) : null}

        {!loading && !result ? (
          <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-10 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-neutral-950 text-white">
              <FileText size={24} />
            </div>
            <p className="mt-5 text-base font-bold text-neutral-950">
              提案書プレビュー
            </p>
            <p className="mt-2 text-sm leading-6 text-neutral-500">
              企業情報から、自治体候補、PR戦略、TV/TVer/SNS施策、営業メールまで生成します。
            </p>
            <button
              type="button"
              onClick={handleSubmit}
              className="mt-6 inline-flex h-11 items-center gap-2 rounded-md bg-neutral-950 px-5 text-sm font-bold text-white transition hover:bg-neutral-800"
            >
              <Sparkles size={17} />
              提案を生成する
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
