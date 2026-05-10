"use client";

import { CopyButton } from "@/components/CopyButton";
import type { ReactNode } from "react";

type SectionCardProps = {
  title: string;
  kicker?: string;
  copyText: string;
  children: ReactNode;
  className?: string;
};

export function SectionCard({
  title,
  kicker,
  copyText,
  children,
  className = ""
}: SectionCardProps) {
  return (
    <section
      className={`print-avoid rounded-lg border border-neutral-200 bg-white p-5 shadow-sm ${className}`}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          {kicker ? (
            <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.16em] text-teal-800">
              {kicker}
            </p>
          ) : null}
          <h2 className="text-base font-bold text-neutral-950">{title}</h2>
        </div>
        <CopyButton text={copyText} />
      </div>
      {children}
    </section>
  );
}
