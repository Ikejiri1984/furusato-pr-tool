"use client";

import { LoaderCircle } from "lucide-react";

type LoadingStateProps = {
  title?: string;
  description?: string;
};

export function LoadingState({
  title = "提案を生成しています",
  description = "企業分析、自治体候補、PR戦略、営業メールを組み立てています。"
}: LoadingStateProps) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-8 text-center shadow-sm">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-teal-800">
        <LoaderCircle className="animate-spin" size={24} />
      </div>
      <p className="mt-5 text-sm font-semibold text-neutral-900">
        {title}
      </p>
      <p className="mt-2 text-sm leading-6 text-neutral-500">
        {description}
      </p>
    </div>
  );
}
