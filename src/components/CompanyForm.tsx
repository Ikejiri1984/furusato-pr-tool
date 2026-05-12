"use client";

import {
  Building2,
  Database,
  Link,
  RefreshCcw,
  Sparkles
} from "lucide-react";

import type { CompanyInput } from "@/lib/types";

const fields: Array<{
  key: keyof CompanyInput;
  label: string;
  placeholder: string;
  type: "input" | "textarea";
  rows?: number;
}> = [
  {
    key: "companyName",
    label: "企業名",
    placeholder: "例: 東都精機株式会社",
    type: "input"
  },
  {
    key: "industry",
    label: "業種",
    placeholder: "例: 産業用ロボット・精密部品メーカー",
    type: "input"
  },
  {
    key: "companyUrl",
    label: "企業URL",
    placeholder: "https://example.com",
    type: "input"
  },
  {
    key: "news",
    label: "ニュース",
    placeholder: "直近の発表、事業トピック、地域拠点の動きなど",
    type: "textarea",
    rows: 3
  },
  {
    key: "ir",
    label: "IR情報",
    placeholder: "中期経営計画、人的資本、非財務KPIなど",
    type: "textarea",
    rows: 3
  },
  {
    key: "recruiting",
    label: "採用情報",
    placeholder: "採用職種、採用課題、学校連携、採用広報の状況など",
    type: "textarea",
    rows: 3
  },
  {
    key: "csr",
    label: "CSR情報",
    placeholder: "ESG、地域貢献、教育支援、脱炭素、社会貢献など",
    type: "textarea",
    rows: 3
  },
  {
    key: "painPoints",
    label: "課題感",
    placeholder: "採用、PR、営業ブランド、自治体接点などの課題",
    type: "textarea",
    rows: 3
  },
  {
    key: "memo",
    label: "自由入力欄",
    placeholder: "商談背景、提案したい方向性、重視したい自治体テーマなど",
    type: "textarea",
    rows: 4
  }
];

type CompanyFormProps = {
  value: CompanyInput;
  loading: boolean;
  onChange: (key: keyof CompanyInput, value: string) => void;
  onSubmit: () => void;
  onSample: () => void;
  onReset: () => void;
};

export function CompanyForm({
  value,
  loading,
  onChange,
  onSubmit,
  onSample,
  onReset
}: CompanyFormProps) {
  return (
    <form
      className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-teal-800">
            <Building2 size={14} />
            Company Input
          </p>
          <h2 className="mt-2 text-lg font-bold text-neutral-950">
            企業入力フォーム
          </h2>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={onSample}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-neutral-200 px-3 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50"
          >
            <Database size={15} />
            サンプル
          </button>
          <button
            type="button"
            onClick={onReset}
            className="inline-flex h-9 items-center justify-center rounded-md border border-neutral-200 px-3 text-neutral-700 transition hover:bg-neutral-50"
            title="リセット"
          >
            <RefreshCcw size={15} />
          </button>
        </div>
      </div>

      <div className="grid gap-4">
        {fields.map((field) => (
          <label key={field.key} className="block">
            <span className="mb-2 flex items-center gap-2 text-sm font-semibold text-neutral-800">
              {field.key === "companyUrl" ? <Link size={14} /> : null}
              {field.label}
            </span>
            {field.type === "input" ? (
              <input
                value={value[field.key]}
                onChange={(event) => onChange(field.key, event.target.value)}
                placeholder={field.placeholder}
                className="h-11 w-full rounded-md border border-neutral-200 bg-neutral-50 px-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-teal-700 focus:bg-white focus:ring-4 focus:ring-teal-700/10"
              />
            ) : (
              <textarea
                value={value[field.key]}
                onChange={(event) => onChange(field.key, event.target.value)}
                placeholder={field.placeholder}
                rows={field.rows}
                className="w-full resize-y rounded-md border border-neutral-200 bg-neutral-50 px-3 py-3 text-sm leading-6 text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-teal-700 focus:bg-white focus:ring-4 focus:ring-teal-700/10"
              />
            )}
          </label>
        ))}
      </div>

      <button
        type="submit"
        disabled={loading}
        className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-neutral-950 px-5 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-400"
      >
        <Sparkles size={18} />
        {loading ? "分析中" : "企業分析を生成"}
      </button>
    </form>
  );
}
