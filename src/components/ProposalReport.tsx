"use client";

import {
  BriefcaseBusiness,
  ChartColumn,
  FileDown,
  Handshake,
  Lightbulb,
  Mail,
  MapPin,
  Megaphone,
  MonitorPlay,
  Newspaper,
  ShieldCheck,
  Target,
  Tv,
  Users
} from "lucide-react";

import { CopyButton } from "@/components/CopyButton";
import { SectionCard } from "@/components/SectionCard";
import { formatList, formatProposalForCopy } from "@/lib/format";
import type { ProposalOutput } from "@/lib/types";

type ProposalReportProps = {
  proposal: ProposalOutput;
  demo: boolean;
  model: string;
  notice?: string;
};

function LeadText({ children }: { children: string }) {
  return <p className="text-sm leading-7 text-neutral-700">{children}</p>;
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2 text-sm leading-6 text-neutral-700">
      {items.map((item) => (
        <li key={item} className="flex gap-3">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-700" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function ProposalReport({
  proposal,
  demo,
  model,
  notice
}: ProposalReportProps) {
  const allText = formatProposalForCopy(proposal);
  const primaryTitle = proposal.proposalTitles[0] ?? "企業版ふるさと納税 PR提案";

  return (
    <article className="print-area space-y-4">
      {notice ? (
        <div className="no-print rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
          {notice}
        </div>
      ) : null}

      <section className="print-avoid rounded-lg border border-neutral-900 bg-neutral-950 p-6 text-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-300">
              Proposal Draft
            </p>
            <h1 className="mt-3 text-2xl font-bold leading-tight">
              {primaryTitle}
            </h1>
            <p className="mt-4 text-sm leading-7 text-neutral-200">
              {proposal.executiveSummary}
            </p>
          </div>
          <div className="no-print flex flex-wrap gap-2">
            <CopyButton
              text={allText}
              label="全体コピー"
              className="border-white/20 bg-white/10 text-white hover:bg-white/15"
            />
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex h-9 items-center gap-2 rounded-md bg-amber-300 px-3 text-xs font-bold text-neutral-950 transition hover:bg-amber-200"
            >
              <FileDown size={15} />
              PDF保存
            </button>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-white/15 px-3 py-1 text-neutral-200">
            {demo ? "Demo Mode" : "AI Generated"}
          </span>
          <span className="rounded-full border border-white/15 px-3 py-1 text-neutral-200">
            Model: {model}
          </span>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="企業分析"
          kicker="Analysis"
          copyText={proposal.companyAnalysis}
        >
          <LeadText>{proposal.companyAnalysis}</LeadText>
        </SectionCard>

        <SectionCard
          title="想定課題"
          kicker="Issues"
          copyText={formatList(proposal.assumedIssues)}
        >
          <BulletList items={proposal.assumedIssues} />
        </SectionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="CSR/ESG観点"
          kicker="ESG"
          copyText={formatList(proposal.csrEsgPerspective)}
        >
          <BulletList items={proposal.csrEsgPerspective} />
        </SectionCard>

        <SectionCard
          title="採用課題"
          kicker="Human Capital"
          copyText={formatList(proposal.recruitmentIssues)}
        >
          <BulletList items={proposal.recruitmentIssues} />
        </SectionCard>
      </div>

      <SectionCard
        title="相性の良い自治体テーマ"
        kicker="Municipality Themes"
        copyText={formatList(proposal.municipalityThemes)}
      >
        <div className="flex flex-wrap gap-2">
          {proposal.municipalityThemes.map((theme) => (
            <span
              key={theme}
              className="rounded-full border border-teal-100 bg-teal-50 px-3 py-1.5 text-sm font-semibold text-teal-900"
            >
              {theme}
            </span>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="自治体候補"
        kicker="Candidate Cities"
        copyText={proposal.municipalityCandidates
          .map(
            (candidate) =>
              `${candidate.name}（${candidate.prefecture}）\n${candidate.reason}\n${candidate.prHook}`
          )
          .join("\n\n")}
      >
        <div className="overflow-hidden rounded-md border border-neutral-200">
          <div className="grid grid-cols-[1.2fr_2fr] bg-neutral-100 px-4 py-3 text-xs font-bold text-neutral-600 md:grid-cols-[1.1fr_1.6fr_1.5fr]">
            <span>自治体</span>
            <span>選定理由</span>
            <span className="hidden md:block">PR切り口</span>
          </div>
          <div className="divide-y divide-neutral-200">
            {proposal.municipalityCandidates.map((candidate) => (
              <div
                key={`${candidate.prefecture}-${candidate.name}`}
                className="grid grid-cols-1 gap-3 px-4 py-4 text-sm md:grid-cols-[1.1fr_1.6fr_1.5fr]"
              >
                <div>
                  <p className="flex items-center gap-2 font-bold text-neutral-950">
                    <MapPin size={15} className="text-teal-800" />
                    {candidate.name}
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {candidate.prefecture}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-neutral-600">
                    {candidate.themes.join(" / ")}
                  </p>
                </div>
                <div>
                  <p className="leading-6 text-neutral-700">
                    {candidate.reason}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-neutral-500">
                    {candidate.educationAsset}・{candidate.populationIssue}
                  </p>
                </div>
                <p className="leading-6 text-neutral-700">{candidate.prHook}</p>
              </div>
            ))}
          </div>
        </div>
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="寄付ストーリー"
          kicker="Donation Story"
          copyText={proposal.donationStory}
        >
          <div className="flex gap-3">
            <Handshake className="mt-1 shrink-0 text-teal-800" size={20} />
            <LeadText>{proposal.donationStory}</LeadText>
          </div>
        </SectionCard>

        <SectionCard
          title="PR戦略"
          kicker="PR Strategy"
          copyText={proposal.prStrategy}
        >
          <div className="flex gap-3">
            <Megaphone className="mt-1 shrink-0 text-amber-600" size={20} />
            <LeadText>{proposal.prStrategy}</LeadText>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="ニュース化アイデア"
          kicker="News"
          copyText={formatList(proposal.newsIdeas)}
        >
          <div className="flex gap-3">
            <Newspaper className="mt-1 shrink-0 text-teal-800" size={20} />
            <BulletList items={proposal.newsIdeas} />
          </div>
        </SectionCard>

        <SectionCard
          title="感謝状贈呈式案"
          kicker="Ceremony"
          copyText={proposal.ceremonyPlan}
        >
          <LeadText>{proposal.ceremonyPlan}</LeadText>
        </SectionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard title="TV活用案" kicker="TV" copyText={proposal.tvPlan}>
          <Tv className="mb-3 text-teal-800" size={22} />
          <LeadText>{proposal.tvPlan}</LeadText>
        </SectionCard>
        <SectionCard
          title="TVer活用案"
          kicker="TVer"
          copyText={proposal.tverPlan}
        >
          <MonitorPlay className="mb-3 text-amber-600" size={22} />
          <LeadText>{proposal.tverPlan}</LeadText>
        </SectionCard>
        <SectionCard
          title="SNS動画企画"
          kicker="Short Video"
          copyText={formatList(proposal.snsVideoIdeas)}
        >
          <Lightbulb className="mb-3 text-rose-700" size={22} />
          <BulletList items={proposal.snsVideoIdeas} />
        </SectionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard
          title="YouTube活用"
          kicker="YouTube"
          copyText={proposal.youtubePlan}
        >
          <LeadText>{proposal.youtubePlan}</LeadText>
        </SectionCard>
        <SectionCard
          title="自治体連携PR"
          kicker="Public Relations"
          copyText={proposal.localGovernmentPr}
        >
          <LeadText>{proposal.localGovernmentPr}</LeadText>
        </SectionCard>
        <SectionCard
          title="社員出演"
          kicker="Employees"
          copyText={proposal.employeeAppearancePlan}
        >
          <Users className="mb-3 text-teal-800" size={22} />
          <LeadText>{proposal.employeeAppearancePlan}</LeadText>
        </SectionCard>
      </div>

      <SectionCard
        title="採用ブランディング"
        kicker="Recruiting"
        copyText={proposal.recruitmentBranding}
      >
        <div className="flex gap-3">
          <BriefcaseBusiness className="mt-1 shrink-0 text-teal-800" size={20} />
          <LeadText>{proposal.recruitmentBranding}</LeadText>
        </div>
      </SectionCard>

      <SectionCard
        title="チャネル別施策"
        kicker="Media Plan"
        copyText={proposal.channelPlans
          .map(
            (item) =>
              `${item.channel}: ${item.idea}\n実行: ${item.execution}\nKPI: ${item.kpi}`
          )
          .join("\n\n")}
      >
        <div className="overflow-hidden rounded-md border border-neutral-200">
          <div className="hidden grid-cols-[1fr_1.5fr_1.5fr_1fr] bg-neutral-100 px-4 py-3 text-xs font-bold text-neutral-600 md:grid">
            <span>媒体</span>
            <span>企画</span>
            <span>実行</span>
            <span>KPI</span>
          </div>
          <div className="divide-y divide-neutral-200">
            {proposal.channelPlans.map((item) => (
              <div
                key={item.channel}
                className="grid grid-cols-1 gap-2 px-4 py-4 text-sm leading-6 text-neutral-700 md:grid-cols-[1fr_1.5fr_1.5fr_1fr]"
              >
                <strong className="text-neutral-950">{item.channel}</strong>
                <span>{item.idea}</span>
                <span>{item.execution}</span>
                <span>{item.kpi}</span>
              </div>
            ))}
          </div>
        </div>
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="営業提案骨子"
          kicker="Sales Story"
          copyText={formatList(proposal.salesProposalOutline)}
        >
          <ol className="space-y-3 text-sm leading-6 text-neutral-700">
            {proposal.salesProposalOutline.map((item, index) => (
              <li key={item} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-xs font-bold text-white">
                  {index + 1}
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ol>
        </SectionCard>

        <SectionCard
          title="想定KPI"
          kicker="KPI"
          copyText={proposal.kpis
            .map((item) => `${item.label}: ${item.target}（${item.note}）`)
            .join("\n")}
        >
          <div className="space-y-3">
            {proposal.kpis.map((item) => (
              <div
                key={item.label}
                className="grid grid-cols-[1fr_auto] gap-3 border-b border-neutral-100 pb-3 last:border-0 last:pb-0"
              >
                <div>
                  <p className="flex items-center gap-2 text-sm font-bold text-neutral-950">
                    <ChartColumn size={15} className="text-teal-800" />
                    {item.label}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-neutral-500">
                    {item.note}
                  </p>
                </div>
                <p className="text-right text-sm font-bold text-neutral-950">
                  {item.target}
                </p>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="初回営業メール"
        kicker="First Contact"
        copyText={`件名: ${proposal.firstSalesEmail.subject}\n\n${proposal.firstSalesEmail.body}`}
      >
        <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-neutral-950">
            <Mail size={16} className="text-teal-800" />
            {proposal.firstSalesEmail.subject}
          </p>
          <pre className="mt-4 whitespace-pre-wrap font-sans text-sm leading-7 text-neutral-700">
            {proposal.firstSalesEmail.body}
          </pre>
        </div>
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="次のアクション"
          kicker="Next"
          copyText={formatList(proposal.nextActions)}
        >
          <BulletList items={proposal.nextActions} />
        </SectionCard>
        <SectionCard
          title="留意点"
          kicker="Risk"
          copyText={formatList(proposal.riskNotes)}
        >
          <div className="flex gap-3">
            <ShieldCheck className="mt-1 shrink-0 text-rose-700" size={20} />
            <BulletList items={proposal.riskNotes} />
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="提案タイトル案"
        kicker="Titles"
        copyText={formatList(proposal.proposalTitles)}
      >
        <div className="grid gap-2 md:grid-cols-2">
          {proposal.proposalTitles.map((title) => (
            <div
              key={title}
              className="flex items-center gap-3 border-b border-neutral-100 py-2 text-sm font-semibold text-neutral-900"
            >
              <Target size={16} className="shrink-0 text-teal-800" />
              <span>{title}</span>
            </div>
          ))}
        </div>
      </SectionCard>
    </article>
  );
}
