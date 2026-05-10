import type { ProposalOutput } from "@/lib/types";

export function formatList(items: string[]) {
  return items.map((item, index) => `${index + 1}. ${item}`).join("\n");
}

export function formatProposalForCopy(proposal: ProposalOutput) {
  const candidates = proposal.municipalityCandidates
    .map(
      (candidate, index) =>
        `${index + 1}. ${candidate.name}（${candidate.prefecture}）\nテーマ: ${candidate.themes.join("、")}\n理由: ${candidate.reason}\nPR切り口: ${candidate.prHook}\n教育資産: ${candidate.educationAsset}\n地域課題: ${candidate.populationIssue}`
    )
    .join("\n\n");

  const kpis = proposal.kpis
    .map((item) => `- ${item.label}: ${item.target}（${item.note}）`)
    .join("\n");

  const channels = proposal.channelPlans
    .map(
      (item) =>
        `- ${item.channel}: ${item.idea}\n  実行: ${item.execution}\n  KPI: ${item.kpi}`
    )
    .join("\n");

  return [
    `提案タイトル案\n${formatList(proposal.proposalTitles)}`,
    `エグゼクティブサマリー\n${proposal.executiveSummary}`,
    `企業分析\n${proposal.companyAnalysis}`,
    `想定課題\n${formatList(proposal.assumedIssues)}`,
    `CSR/ESG観点\n${formatList(proposal.csrEsgPerspective)}`,
    `採用課題\n${formatList(proposal.recruitmentIssues)}`,
    `相性の良い自治体テーマ\n${formatList(proposal.municipalityThemes)}`,
    `自治体候補\n${candidates}`,
    `寄付ストーリー\n${proposal.donationStory}`,
    `PR戦略\n${proposal.prStrategy}`,
    `ニュース化アイデア\n${formatList(proposal.newsIdeas)}`,
    `感謝状贈呈式案\n${proposal.ceremonyPlan}`,
    `TV活用案\n${proposal.tvPlan}`,
    `TVer活用案\n${proposal.tverPlan}`,
    `SNS動画企画\n${formatList(proposal.snsVideoIdeas)}`,
    `YouTube活用\n${proposal.youtubePlan}`,
    `自治体連携PR\n${proposal.localGovernmentPr}`,
    `社員出演\n${proposal.employeeAppearancePlan}`,
    `採用ブランディング\n${proposal.recruitmentBranding}`,
    `営業提案骨子\n${formatList(proposal.salesProposalOutline)}`,
    `想定KPI\n${kpis}`,
    `初回営業メール\n件名: ${proposal.firstSalesEmail.subject}\n\n${proposal.firstSalesEmail.body}`,
    `次のアクション\n${formatList(proposal.nextActions)}`,
    `留意点\n${formatList(proposal.riskNotes)}`,
    `チャネル別施策\n${channels}`
  ].join("\n\n---\n\n");
}
