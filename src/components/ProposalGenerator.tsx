"use client";

import { AlertCircle, FileText, Sparkles } from "lucide-react";
import { useState } from "react";

import { AnalysisCard } from "@/components/AnalysisCard";
import { CompanyForm } from "@/components/CompanyForm";
import { DetailCard } from "@/components/DetailCard";
import { LoadingState } from "@/components/LoadingState";
import { ProposalReport } from "@/components/ProposalReport";
import { formatProposalForCopy } from "@/lib/format";
import { emptyCompanyInput, sampleCompanyInput } from "@/lib/sample";
import type {
  AnalysisResponse,
  CompanyInput,
  DetailResponse,
  GenerateResponse
} from "@/lib/types";

type GenerateApiPayload = Partial<
  GenerateResponse & AnalysisResponse & DetailResponse
> & {
  error?: string;
};

function parseGeneratePayload(raw: string): GenerateApiPayload {
  try {
    return raw ? (JSON.parse(raw) as GenerateApiPayload) : {};
  } catch {
    return {
      error: raw || "APIから不正なレスポンスが返されました。"
    };
  }
}

export function ProposalGenerator() {
  const [input, setInput] = useState<CompanyInput>(sampleCompanyInput);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResponse | null>(
    null
  );
  const [proposalResult, setProposalResult] = useState<GenerateResponse | null>(
    null
  );
  const [detailResult, setDetailResult] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState<
    "analysis" | "proposal" | "detail" | null
  >(null);
  const [error, setError] = useState("");

  function updateInput(key: keyof CompanyInput, value: string) {
    setInput((current) => ({
      ...current,
      [key]: value
    }));
    setAnalysisResult(null);
    setProposalResult(null);
    setDetailResult(null);
  }

  async function handleAnalysis() {
    setLoading("analysis");
    setError("");
    setProposalResult(null);
    setDetailResult(null);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ...input,
          mode: "analysis"
        })
      });

      const raw = await response.text();
      const data = parseGeneratePayload(raw);

      if (!response.ok) {
        throw new Error(data.error || "企業分析に失敗しました。");
      }

      if (
        !data.analysis ||
        !data.analysisText ||
        typeof data.demo !== "boolean" ||
        !data.model
      ) {
        throw new Error(data.error || "企業分析データの形式が正しくありません。");
      }

      setAnalysisResult(data as AnalysisResponse);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "企業分析に失敗しました。時間をおいて再実行してください。"
      );
    } finally {
      setLoading(null);
    }
  }

  async function handleProposal() {
    if (!analysisResult) {
      setError("先に企業分析を生成してください。");
      return;
    }

    setLoading("proposal");
    setError("");
    setDetailResult(null);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ...input,
          mode: "proposal",
          analysis: analysisResult.analysis
        })
      });

      const raw = await response.text();
      const data = parseGeneratePayload(raw);

      if (!response.ok) {
        throw new Error(data.error || "提案生成に失敗しました。");
      }

      if (!data.proposal || typeof data.demo !== "boolean" || !data.model) {
        throw new Error(data.error || "提案データの形式が正しくありません。");
      }

      setProposalResult(data as GenerateResponse);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "提案生成に失敗しました。時間をおいて再実行してください。"
      );
    } finally {
      setLoading(null);
    }
  }

  async function handleDetail() {
    if (!analysisResult || !proposalResult) {
      setError("先に企業分析と提案を生成してください。");
      return;
    }

    setLoading("detail");
    setError("");

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ...input,
          mode: "detail",
          analysis: analysisResult.analysis,
          proposalText: formatProposalForCopy(proposalResult.proposal)
        })
      });

      const raw = await response.text();
      const data = parseGeneratePayload(raw);

      if (!response.ok) {
        throw new Error(data.error || "詳細生成に失敗しました。");
      }

      if (!data.detail || typeof data.demo !== "boolean" || !data.model) {
        throw new Error(data.error || "詳細データの形式が正しくありません。");
      }

      setDetailResult(data as DetailResponse);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "詳細生成に失敗しました。時間をおいて再実行してください。"
      );
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-[1500px] gap-6 px-4 py-6 md:px-6 lg:grid-cols-[430px_minmax(0,1fr)]">
      <aside className="no-print lg:sticky lg:top-6 lg:self-start">
        <CompanyForm
          value={input}
          loading={loading === "analysis"}
          onChange={updateInput}
          onSubmit={handleAnalysis}
          onSample={() => {
            setInput(sampleCompanyInput);
            setAnalysisResult(null);
            setProposalResult(null);
            setDetailResult(null);
            setError("");
          }}
          onReset={() => {
            setInput(emptyCompanyInput);
            setAnalysisResult(null);
            setProposalResult(null);
            setDetailResult(null);
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

        {loading === "analysis" ? (
          <LoadingState
            title="分析中"
            description="企業特性、業界課題、地域接続性、寄付テーマ仮説だけを高速生成しています。"
          />
        ) : null}

        {!analysisResult && loading !== "analysis" ? (
          <section className="rounded-lg border border-dashed border-neutral-300 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-neutral-950 text-white">
              <FileText size={24} />
            </div>
            <p className="mt-5 text-base font-bold text-neutral-950">
              企業分析カード
            </p>
            <p className="mt-2 text-sm leading-6 text-neutral-500">
              まず企業特性、業界課題、地域接続性、寄付テーマ仮説を生成します。
            </p>
          </section>
        ) : null}

        {analysisResult ? (
          <AnalysisCard result={analysisResult} />
        ) : null}

        <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal-800">
                Step 2
              </p>
              <h2 className="mt-2 text-lg font-bold text-neutral-950">
                提案カード
              </h2>
            </div>
            <button
              type="button"
              onClick={handleProposal}
              disabled={!analysisResult || loading === "proposal"}
              className="inline-flex h-11 items-center gap-2 rounded-md bg-neutral-950 px-5 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-400"
            >
              <Sparkles size={17} />
              {loading === "proposal" ? "提案生成中" : "提案を生成"}
            </button>
          </div>
          <p className="mt-3 text-sm leading-6 text-neutral-500">
            STEP1のJSON分析結果からAIが戦略変数だけを抽出し、提案本文は業種別テンプレートで高速構築します。
          </p>
        </section>

        {loading === "proposal" ? (
          <LoadingState
            title="戦略変数を生成中"
            description="AIは短いJSON変数だけを返し、自治体候補やPR施策はテンプレートで組み立てています。"
          />
        ) : null}

        {!proposalResult && loading !== "proposal" ? (
          <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-10 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-neutral-950 text-white">
              <FileText size={24} />
            </div>
            <p className="mt-5 text-base font-bold text-neutral-950">
              提案プレビュー
            </p>
            <p className="mt-2 text-sm leading-6 text-neutral-500">
              企業分析を生成すると、分析結果を使った提案生成に進めます。
            </p>
          </div>
        ) : null}

        {proposalResult && loading !== "proposal" ? (
          <ProposalReport
            proposal={proposalResult.proposal}
            demo={proposalResult.demo}
            model={proposalResult.model}
            notice={proposalResult.notice}
          />
        ) : null}

        <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal-800">
                Step 3
              </p>
              <h2 className="mt-2 text-lg font-bold text-neutral-950">
                追加生成カード
              </h2>
            </div>
            <button
              type="button"
              onClick={handleDetail}
              disabled={!proposalResult || loading === "detail"}
              className="inline-flex h-11 items-center gap-2 rounded-md border border-neutral-200 px-5 text-sm font-bold text-neutral-800 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:text-neutral-400"
            >
              <Sparkles size={17} />
              {loading === "detail" ? "詳細生成中" : "詳細を生成"}
            </button>
          </div>
          <p className="mt-3 text-sm leading-6 text-neutral-500">
            必要に応じて、KPI、営業メール、PDF用詳細、役員説明を追加生成します。
          </p>
        </section>

        {loading === "detail" ? (
          <LoadingState
            title="詳細生成中"
            description="KPI、営業メール、PDF用詳細、役員説明を追加生成しています。"
          />
        ) : null}

        {detailResult && loading !== "detail" ? (
          <DetailCard result={detailResult} />
        ) : null}
      </section>
    </div>
  );
}
