import OpenAI from "openai";
import { NextResponse } from "next/server";

import { buildDemoProposal } from "@/lib/fallback";
import { buildUserPrompt, systemPrompt } from "@/lib/prompt";
import type { CompanyInput, GenerateResponse, ProposalOutput } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    isRecord(value) &&
    Object.values(value).every((item) => typeof item === "string")
  );
}

function normalizeInput(value: unknown): CompanyInput | null {
  if (!isStringRecord(value)) {
    return null;
  }

  return {
    companyName: value.companyName?.trim() ?? "",
    industry: value.industry?.trim() ?? "",
    companyUrl: value.companyUrl?.trim() ?? "",
    news: value.news?.trim() ?? "",
    ir: value.ir?.trim() ?? "",
    recruiting: value.recruiting?.trim() ?? "",
    csr: value.csr?.trim() ?? "",
    painPoints: value.painPoints?.trim() ?? "",
    memo: value.memo?.trim() ?? ""
  };
}

const plainTextOutputInstruction = `
出力形式:
- JSONではなく、通常の日本語テキストで出力してください。
- 各項目は Markdown の「## 見出し」で区切ってください。
- 見出しは次を使ってください。
  - ## エグゼクティブサマリー
  - ## 提案タイトル案
  - ## 企業分析
  - ## 想定課題
  - ## CSR/ESG観点
  - ## 採用課題
  - ## 相性の良い自治体テーマ
  - ## 自治体候補
  - ## 寄付ストーリー
  - ## PR戦略
  - ## ニュース化アイデア
  - ## 感謝状贈呈式案
  - ## TV活用案
  - ## TVer活用案
  - ## SNS動画企画
  - ## YouTube活用
  - ## 自治体連携PR
  - ## 社員出演
  - ## 採用ブランディング
  - ## 営業提案骨子
  - ## 想定KPI
  - ## チャネル別施策
  - ## 初回営業メール
  - ## 次のアクション
  - ## 留意点
`.trim();

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getSection(text: string, headings: string[]) {
  const pattern = new RegExp(
    `(?:^|\\n)#{1,3}\\s*(?:${headings.map(escapeRegExp).join("|")})\\s*\\n([\\s\\S]*?)(?=\\n#{1,3}\\s|$)`,
    "i"
  );

  return pattern.exec(text)?.[1]?.trim() ?? "";
}

function cleanLine(line: string) {
  return line
    .replace(/^\s*(?:[-*・]|\d+[.)]|[①-⑳])\s*/u, "")
    .replace(/\*\*/g, "")
    .trim();
}

function toList(section: string, fallback: string[]) {
  const items = section
    .split(/\r?\n/)
    .map(cleanLine)
    .filter((item) => item && !item.startsWith("#"));

  return items.length > 0 ? items : fallback;
}

function firstParagraph(text: string, fallback: string) {
  const paragraph = text
    .split(/\n{2,}/)
    .map((item) => item.replace(/^#{1,3}\s+/gm, "").trim())
    .find(Boolean);

  return paragraph ?? fallback;
}

function toKpis(section: string, fallback: ProposalOutput["kpis"]) {
  const lines = toList(section, []);

  if (lines.length === 0) {
    return fallback;
  }

  return lines.map((line) => {
    const [label, ...rest] = line.split(/[:：]/);
    const target = rest.join(":").trim() || "要設計";

    return {
      label: label.trim() || "KPI",
      target,
      note: line
    };
  });
}

function toChannelPlans(
  section: string,
  fallback: ProposalOutput["channelPlans"]
) {
  const lines = toList(section, []);

  if (lines.length === 0) {
    return fallback;
  }

  return lines.map((line) => {
    const [channel, ...rest] = line.split(/[:：]/);
    const detail = rest.join(":").trim() || line;

    return {
      channel: channel.trim() || "PR施策",
      idea: detail,
      execution: detail,
      kpi: "露出数・再生数・問い合わせ数"
    };
  });
}

function toMunicipalityCandidates(
  section: string,
  fallback: ProposalOutput["municipalityCandidates"]
) {
  const lines = toList(section, []);

  if (lines.length === 0) {
    return fallback;
  }

  return lines.slice(0, 8).map((line, index) => {
    const match = line.match(/^(.+?)[（(](.+?)[）)]/);
    const fallbackCandidate = fallback[index % fallback.length];

    return {
      name: match?.[1]?.trim() || fallbackCandidate.name,
      prefecture: match?.[2]?.trim() || fallbackCandidate.prefecture,
      themes: fallbackCandidate.themes,
      reason: line,
      prHook: line,
      educationAsset: fallbackCandidate.educationAsset,
      populationIssue: fallbackCandidate.populationIssue
    };
  });
}

function buildProposalFromText(
  input: CompanyInput,
  generatedText: string
): ProposalOutput {
  const fallback = buildDemoProposal(input);
  const text = generatedText.trim();

  if (!text) {
    return fallback;
  }

  const executiveSummary = getSection(text, ["エグゼクティブサマリー"]);
  const titleSection = getSection(text, ["提案タイトル案"]);
  const companyAnalysis = getSection(text, ["企業分析"]);
  const assumedIssues = getSection(text, ["想定課題"]);
  const csrEsgPerspective = getSection(text, ["CSR/ESG観点", "CSR・ESG観点"]);
  const recruitmentIssues = getSection(text, ["採用課題"]);
  const municipalityThemes = getSection(text, ["相性の良い自治体テーマ"]);
  const municipalityCandidates = getSection(text, ["自治体候補"]);
  const donationStory = getSection(text, ["寄付ストーリー"]);
  const prStrategy = getSection(text, ["PR戦略"]);
  const newsIdeas = getSection(text, ["ニュース化アイデア"]);
  const ceremonyPlan = getSection(text, ["感謝状贈呈式案"]);
  const tvPlan = getSection(text, ["TV活用案"]);
  const tverPlan = getSection(text, ["TVer活用案"]);
  const snsVideoIdeas = getSection(text, ["SNS動画企画", "SNSショート動画企画"]);
  const youtubePlan = getSection(text, ["YouTube活用", "YouTube活用案"]);
  const localGovernmentPr = getSection(text, ["自治体連携PR"]);
  const employeeAppearancePlan = getSection(text, ["社員出演"]);
  const recruitmentBranding = getSection(text, ["採用ブランディング"]);
  const salesProposalOutline = getSection(text, ["営業提案骨子"]);
  const kpis = getSection(text, ["想定KPI"]);
  const channelPlans = getSection(text, ["チャネル別施策"]);
  const salesEmail = getSection(text, ["初回営業メール"]);
  const nextActions = getSection(text, ["次のアクション"]);
  const riskNotes = getSection(text, ["留意点"]);

  return {
    ...fallback,
    proposalTitles: toList(titleSection, fallback.proposalTitles),
    executiveSummary:
      executiveSummary || firstParagraph(text, fallback.executiveSummary),
    companyAnalysis: companyAnalysis || text,
    assumedIssues: toList(assumedIssues, fallback.assumedIssues),
    csrEsgPerspective: toList(csrEsgPerspective, fallback.csrEsgPerspective),
    recruitmentIssues: toList(recruitmentIssues, fallback.recruitmentIssues),
    municipalityThemes: toList(municipalityThemes, fallback.municipalityThemes),
    municipalityCandidates: toMunicipalityCandidates(
      municipalityCandidates,
      fallback.municipalityCandidates
    ),
    donationStory: donationStory || fallback.donationStory,
    prStrategy: prStrategy || fallback.prStrategy,
    newsIdeas: toList(newsIdeas, fallback.newsIdeas),
    ceremonyPlan: ceremonyPlan || fallback.ceremonyPlan,
    tvPlan: tvPlan || fallback.tvPlan,
    tverPlan: tverPlan || fallback.tverPlan,
    snsVideoIdeas: toList(snsVideoIdeas, fallback.snsVideoIdeas),
    youtubePlan: youtubePlan || fallback.youtubePlan,
    localGovernmentPr: localGovernmentPr || fallback.localGovernmentPr,
    employeeAppearancePlan:
      employeeAppearancePlan || fallback.employeeAppearancePlan,
    recruitmentBranding: recruitmentBranding || fallback.recruitmentBranding,
    salesProposalOutline: toList(
      salesProposalOutline,
      fallback.salesProposalOutline
    ),
    kpis: toKpis(kpis, fallback.kpis),
    firstSalesEmail: {
      subject: fallback.firstSalesEmail.subject,
      body: salesEmail || fallback.firstSalesEmail.body
    },
    nextActions: toList(nextActions, fallback.nextActions),
    riskNotes: toList(riskNotes, fallback.riskNotes),
    channelPlans: toChannelPlans(channelPlans, fallback.channelPlans)
  };
}

function extractResponseError(response: unknown) {
  if (!isRecord(response) || !isRecord(response.error)) {
    return "";
  }

  const message = response.error.message;
  return typeof message === "string" ? message : "OpenAI APIでエラーが発生しました。";
}

function extractResponseText(response: unknown) {
  if (isRecord(response) && typeof response.output_text === "string") {
    const text = response.output_text.trim();
    if (text) {
      return text;
    }
  }

  const output = isRecord(response) && Array.isArray(response.output)
    ? response.output
    : [];

  const parts: string[] = [];

  for (const item of output) {
    if (!isRecord(item) || !Array.isArray(item.content)) {
      continue;
    }

    for (const content of item.content) {
      if (!isRecord(content)) {
        continue;
      }

      if (content.type === "output_text" && typeof content.text === "string") {
        parts.push(content.text);
      }

      if (content.type === "refusal" && typeof content.refusal === "string") {
        parts.push(content.refusal);
      }
    }
  }

  const text = parts.join("\n\n").trim();

  if (!text) {
    throw new Error("OpenAIからテキスト応答を取得できませんでした。");
  }

  return text;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const input = normalizeInput(body);

    if (!input) {
      return NextResponse.json(
        { error: "入力形式が正しくありません。" },
        { status: 400 }
      );
    }

    if (!input.companyName && !input.industry && !input.memo) {
      return NextResponse.json(
        { error: "企業名、業種、自由入力欄のいずれかを入力してください。" },
        { status: 400 }
      );
    }

    const model = process.env.OPENAI_MODEL || "gpt-5";

    if (!process.env.OPENAI_API_KEY) {
      const payload: GenerateResponse = {
        proposal: buildDemoProposal(input),
        demo: true,
        model: "demo",
        notice:
          "OPENAI_API_KEY が未設定のため、サンプル提案を生成しました。.env.local に API キーを設定するとAI生成に切り替わります。"
      };

      return NextResponse.json(payload);
    }

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    const response = await client.responses.create({
      model,
      instructions: systemPrompt,
      input: `${buildUserPrompt(input)}\n\n${plainTextOutputInstruction}`
    });

    const responseError = extractResponseError(response);

    if (responseError) {
      throw new Error(responseError);
    }

    const generatedText = extractResponseText(response);
    const proposal = buildProposalFromText(input, generatedText);
    const payload: GenerateResponse = {
      proposal,
      demo: false,
      model
    };

    return NextResponse.json(payload);
  } catch (error) {
    const message = (
      error instanceof Error
        ? error.message
        : "提案生成中に予期しないエラーが発生しました。"
    ).slice(0, 500);

    return NextResponse.json(
      {
        error: message
      },
      { status: 500 }
    );
  }
}
