import OpenAI from "openai";
import { NextResponse } from "next/server";

import { buildDemoProposal } from "@/lib/fallback";
import {
  buildAnalysisPrompt,
  buildDetailPrompt,
  buildProposalPrompt,
  systemPrompt
} from "@/lib/prompt";
import type {
  AnalysisResponse,
  CompanyInput,
  DetailResponse,
  GenerateResponse,
  ProposalOutput,
  StrategicAnalysis
} from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 15;

const OPENAI_TIMEOUT_MS = 12000;
const ANALYSIS_TIMEOUT_MS = 6000;
const ANALYSIS_OUTPUT_TOKEN_LIMIT = 500;
const PROPOSAL_OUTPUT_TOKEN_LIMIT = 900;
const DETAIL_OUTPUT_TOKEN_LIMIT = 900;
const DEFAULT_ANALYSIS_MODEL = "gpt-4.1-mini";
const DEFAULT_PROPOSAL_MODEL = "gpt-5";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readStringField(value: unknown, key: string) {
  if (!isRecord(value)) {
    return undefined;
  }

  const field = value[key];
  return typeof field === "string" ? field : undefined;
}

function readNumberField(value: unknown, key: string) {
  if (!isRecord(value)) {
    return undefined;
  }

  const field = value[key];
  return typeof field === "number" ? field : undefined;
}

function getErrorBody(error: unknown) {
  if (!isRecord(error)) {
    return undefined;
  }

  return error.error;
}

function logOpenAIError(context: string, error: unknown) {
  const errorBody = getErrorBody(error);
  const nestedError =
    isRecord(errorBody) && isRecord(errorBody.error)
      ? errorBody.error
      : errorBody;

  console.error("[api/generate] OpenAI API error", {
    context,
    statusCode: readNumberField(error, "status"),
    errorMessage:
      readStringField(nestedError, "message") ||
      readStringField(error, "message"),
    errorType:
      readStringField(nestedError, "type") || readStringField(error, "type"),
    errorCode:
      readStringField(nestedError, "code") || readStringField(error, "code"),
    errorParam:
      readStringField(nestedError, "param") || readStringField(error, "param"),
    requestID: readStringField(error, "requestID"),
    errorBody,
    stack: error instanceof Error ? error.stack : undefined
  });
}

function logRouteError(context: string, error: unknown) {
  console.error("[api/generate] route error", {
    context,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    error
  });
}

function normalizeInput(value: unknown): CompanyInput | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    companyName: readStringField(value, "companyName")?.trim() ?? "",
    industry: readStringField(value, "industry")?.trim() ?? "",
    companyUrl: readStringField(value, "companyUrl")?.trim() ?? "",
    news: readStringField(value, "news")?.trim() ?? "",
    ir: readStringField(value, "ir")?.trim() ?? "",
    recruiting: readStringField(value, "recruiting")?.trim() ?? "",
    csr: readStringField(value, "csr")?.trim() ?? "",
    painPoints: readStringField(value, "painPoints")?.trim() ?? "",
    memo: readStringField(value, "memo")?.trim() ?? ""
  };
}

const proposalOutputInstruction = `
出力形式:
- 通常テキストで返す。JSONは禁止。
- STEP1分析結果を前提にした提案だけを返す。企業分析を再計算しない。
- 見出しは指定7項目だけ使う。
- 自治体候補は3つ。
- KPI、営業メール、PDF用詳細、役員説明は書かない。
- 初回から全セクションを膨らませない。
- 表、コードブロック、長い前置きは禁止。
`.trim();

const detailOutputInstruction = `
出力形式:
- 通常テキストで返す。JSONは禁止。
- STEP3の追加生成だけを返す。
- 見出しは KPI、営業メール、PDF用詳細、役員説明 の4つだけ。
- STEP1分析とSTEP2提案は再生成しない。
`.trim();

function buildSafeFallbackPayload(
  input: CompanyInput,
  model: string,
  notice: string
): GenerateResponse {
  return {
    proposal: buildDemoProposal(input),
    demo: true,
    model,
    notice
  };
}

function compact(value: string, limit = 120) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > limit
    ? `${normalized.slice(0, Math.max(0, limit - 3))}...`
    : normalized;
}

function includesAny(value: string, keywords: string[]) {
  return keywords.some((keyword) => value.includes(keyword));
}

function buildRuleBasedAnalysis(input: CompanyInput) {
  const industry = input.industry || "未特定業種";
  const source = `${input.industry} ${input.news} ${input.csr} ${input.recruiting} ${input.painPoints} ${input.memo}`;
  const newsHint = input.news ? `直近ニュース「${compact(input.news, 44)}」` : "";
  const csrHint = input.csr ? `CSR「${compact(input.csr, 42)}」` : "";
  const issueHint = input.painPoints
    ? `課題感「${compact(input.painPoints, 40)}」`
    : "";

  const profile = (() => {
    if (includesAny(source, ["製造", "メーカー", "工場", "機械", "部品", "素材"])) {
      return {
        characteristics:
          "技術・設備・技能の蓄積を持つ事業で、地域のものづくり人材育成と接点を作りやすい。",
        industryIssues:
          "高専採用、技能継承、GX対応、工場人材不足が採用ブランドと直結する。",
        regionalConnectivity:
          "高専・工業高校・地場産業支援を持つ自治体と教育投資として接続できる。",
        donationThemeHypothesis:
          "次世代ものづくり人材育成、STEAM教育、地域産業基盤強化への寄付。"
      };
    }

    if (includesAny(source, ["放送", "テレビ", "メディア", "広告", "番組"])) {
      return {
        characteristics:
          "地域発信と映像制作の資産を持ち、広告外収益や地域事業転換を語りやすい。",
        industryIssues:
          "広告市場縮小、TVer競争、IP展開、若年層接点の再設計が課題になりやすい。",
        regionalConnectivity:
          "観光、移住、地域ブランディング、クリエイター育成を進める自治体と相性が良い。",
        donationThemeHypothesis:
          "地域発信人材育成、観光PR、自治体動画DX、クリエイター育成への寄付。"
      };
    }

    if (includesAny(source, ["IT", "DX", "SaaS", "システム", "デジタル", "AI"])) {
      return {
        characteristics:
          "デジタル実装力を持ち、自治体DXや教育DXを採用広報に転換しやすい。",
        industryIssues:
          "DX人材不足、導入支援の差別化、地方顧客開拓、採用認知の不足が課題。",
        regionalConnectivity:
          "デジタル教育、行政DX、地域企業の業務改善を進める自治体と接続できる。",
        donationThemeHypothesis:
          "地方DX人材育成、プログラミング教育、自治体業務DX実証への寄付。"
      };
    }

    if (includesAny(source, ["インフラ", "電力", "エネルギー", "建設", "土木", "交通"])) {
      return {
        characteristics:
          "社会基盤を支える事業で、防災・強靭化・エネルギーの公共性を打ち出せる。",
        industryIssues:
          "老朽化対応、担い手不足、防災投資、脱炭素対応が地域説明力を左右する。",
        regionalConnectivity:
          "防災、地域強靭化、インフラ維持、再エネに取り組む自治体と接続できる。",
        donationThemeHypothesis:
          "防災教育、地域インフラ人材育成、脱炭素・再エネ啓発への寄付。"
      };
    }

    if (includesAny(source, ["食品", "飲料", "農業", "食", "外食"])) {
      return {
        characteristics:
          "生活者接点と地域素材の文脈を持ち、食育や観光PRに展開しやすい。",
        industryIssues:
          "原材料高、地域ブランド化、食の安全、若年層接点、採用認知が課題。",
        regionalConnectivity:
          "農業、食育、観光、地域ブランド開発を進める自治体と接続しやすい。",
        donationThemeHypothesis:
          "食育、地域産品ブランド化、農業人材育成、観光コンテンツ開発への寄付。"
      };
    }

    return {
      characteristics:
        "入力情報を起点に、採用・ESG・営業ブランドへ転換できる地域接点を探れる。",
      industryIssues:
        "採用認知、人的資本、ESGの説明力、地域での事業接点づくりが課題になりやすい。",
      regionalConnectivity:
        "教育、産業振興、若者流出、子育て、DXなど自治体課題と接続できる。",
      donationThemeHypothesis:
        "人材育成、地域産業支援、DX、若者定着を軸に寄付テーマを設計する。"
    };
  })();

  return {
    companyCharacteristics: compact(
      `${industry}。${newsHint || csrHint || profile.characteristics}`,
      120
    ),
    industryIssues: compact(issueHint || profile.industryIssues, 120),
    regionalConnectivity: compact(
      csrHint
        ? `${csrHint}を自治体の教育・産業・若者定着課題に接続できる。`
        : profile.regionalConnectivity,
      120
    ),
    donationThemeHypothesis: compact(profile.donationThemeHypothesis, 120)
  } satisfies StrategicAnalysis;
}

function formatAnalysisText(analysis: StrategicAnalysis) {
  return [
    `## 企業特性\n${analysis.companyCharacteristics}`,
    `## 業界課題\n${analysis.industryIssues}`,
    `## 地域接続性\n${analysis.regionalConnectivity}`,
    `## 寄付テーマ仮説\n${analysis.donationThemeHypothesis}`
  ].join("\n\n");
}

function parseAnalysisJson(text: string, input: CompanyInput) {
  const stripped = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  const jsonText = stripped.match(/\{[\s\S]*\}/)?.[0] ?? stripped;

  try {
    const parsed = JSON.parse(jsonText) as Partial<StrategicAnalysis>;

    if (
      typeof parsed.companyCharacteristics === "string" &&
      typeof parsed.industryIssues === "string" &&
      typeof parsed.regionalConnectivity === "string" &&
      typeof parsed.donationThemeHypothesis === "string"
    ) {
      return {
        companyCharacteristics: compact(parsed.companyCharacteristics),
        industryIssues: compact(parsed.industryIssues),
        regionalConnectivity: compact(parsed.regionalConnectivity),
        donationThemeHypothesis: compact(parsed.donationThemeHypothesis)
      } satisfies StrategicAnalysis;
    }
  } catch {
    // Fall through to the rule-based analysis below.
  }

  const fallback = buildRuleBasedAnalysis(input);
  return {
    ...fallback,
    companyCharacteristics: compact(stripped || fallback.companyCharacteristics)
  };
}

function buildSafeAnalysisPayload(
  input: CompanyInput,
  model: string,
  notice: string
): AnalysisResponse {
  const analysis = buildRuleBasedAnalysis(input);

  return {
    analysis,
    analysisText: formatAnalysisText(analysis),
    demo: true,
    model,
    notice
  };
}

function getMode(value: unknown): "analysis" | "proposal" | "detail" {
  if (!isRecord(value)) {
    return "analysis";
  }

  if (value.mode === "proposal" || value.mode === "detail") {
    return value.mode;
  }

  return "analysis";
}

function getAnalysisData(value: unknown) {
  if (!isRecord(value)) {
    return null;
  }

  const analysis = value.analysis;

  if (isRecord(analysis)) {
    const data = analysis as Partial<StrategicAnalysis>;

    if (
      typeof data.companyCharacteristics === "string" &&
      typeof data.industryIssues === "string" &&
      typeof data.regionalConnectivity === "string" &&
      typeof data.donationThemeHypothesis === "string"
    ) {
      return data as StrategicAnalysis;
    }
  }

  return null;
}

function getProposalText(value: unknown) {
  if (!isRecord(value)) {
    return "";
  }

  const proposalText = value.proposalText;
  return typeof proposalText === "string" ? proposalText.trim() : "";
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getSection(text: string, headings: string[]) {
  const headingPattern = headings.map(escapeRegExp).join("|");
  const pattern = new RegExp(
    `(?:^|\\n)#{1,3}\\s*(?:(?:STEP\\s*)?\\d+(?:[-.)：:]\\d+)?[.)：:]?\\s*)?(?:${headingPattern})\\s*\\n([\\s\\S]*?)(?=\\n#{1,3}\\s*(?:(?:STEP\\s*)?\\d+(?:[-.)：:]\\d+)?[.)：:]?\\s*)?|$)`,
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

  const executiveSummary = getSection(text, [
    "提案概要",
    "エグゼクティブサマリー"
  ]);
  const titleSection = getSection(text, ["提案タイトル", "提案タイトル案"]);
  const companyAnalysis = getSection(text, [
    "企業戦略分析",
    "企業特性分析",
    "企業分析"
  ]);
  const assumedIssues = getSection(text, ["想定課題"]);
  const csrEsgPerspective = getSection(text, ["CSR/ESG観点", "CSR・ESG観点"]);
  const recruitmentIssues = getSection(text, ["採用課題"]);
  const municipalityThemes = getSection(text, ["相性の良い自治体テーマ"]);
  const municipalityCandidates = getSection(text, ["自治体候補"]);
  const donationStory = getSection(text, ["寄付ストーリー"]);
  const prStrategy = getSection(text, ["PR戦略"]);
  const newsIdeas = getSection(text, [
    "ニュース化シナリオ",
    "ニュース化アイデア"
  ]);
  const ceremonyPlan = getSection(text, ["感謝状贈呈式案"]);
  const tvPlan = getSection(text, ["TV活用案"]);
  const tverPlan = getSection(text, ["TVer活用案"]);
  const snsVideoIdeas = getSection(text, [
    "TV/TVer/SNS施策",
    "SNS動画企画",
    "SNSショート動画企画"
  ]);
  const youtubePlan = getSection(text, ["YouTube活用", "YouTube活用案"]);
  const localGovernmentPr = getSection(text, ["自治体連携PR"]);
  const employeeAppearancePlan = getSection(text, ["社員出演"]);
  const recruitmentBranding = getSection(text, ["採用ブランディング"]);
  const salesProposalOutline = getSection(text, [
    "営業活用方法",
    "営業提案骨子"
  ]);
  const kpis = getSection(text, ["想定KPI"]);
  const channelPlans = getSection(text, [
    "TV/TVer/SNS施策",
    "チャネル別施策"
  ]);
  const salesEmail = getSection(text, ["初回営業メール"]);
  const nextActions = getSection(text, ["次のアクション"]);
  const riskNotes = getSection(text, ["留意点"]);

  return {
    ...fallback,
    proposalTitles: toList(titleSection, fallback.proposalTitles),
    executiveSummary:
      executiveSummary || firstParagraph(text, fallback.executiveSummary),
    companyAnalysis: companyAnalysis || executiveSummary || text,
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

    const analysisModel =
      process.env.OPENAI_ANALYSIS_MODEL || DEFAULT_ANALYSIS_MODEL;
    const proposalModel = process.env.OPENAI_MODEL || DEFAULT_PROPOSAL_MODEL;
    const mode = getMode(body);
    const analysisData = getAnalysisData(body);
    const proposalText = getProposalText(body);

    if (!process.env.OPENAI_API_KEY) {
      const notice =
        "OPENAI_API_KEY が未設定のため、入力情報からルールベースで簡易生成しています。.env.local に API キーを設定するとAI生成に切り替わります。";

      if (mode === "detail") {
        return NextResponse.json({
          detail:
            "## KPI\n採用応募数、自治体接点数、メディア露出数を確認します。\n\n## 営業メール\nSTEP2提案をもとに個別送付文を作成します。\n\n## PDF用詳細\n提案背景、自治体候補、PR展開を提案書化します。\n\n## 役員説明\n人的資本、ESG、営業ブランド投資として説明します。",
          demo: true,
          model: "rule-based",
          notice
        } satisfies DetailResponse);
      }

      return NextResponse.json(
        mode === "analysis"
          ? buildSafeAnalysisPayload(input, "rule-based", notice)
          : buildSafeFallbackPayload(input, "rule-based", notice)
      );
    }

    if ((mode === "proposal" || mode === "detail") && !analysisData) {
      return NextResponse.json(
        { error: "先に企業分析を生成してください。" },
        { status: 400 }
      );
    }

    if (mode === "detail" && !proposalText) {
      return NextResponse.json(
        { error: "先に提案を生成してください。" },
        { status: 400 }
      );
    }

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      maxRetries: 0,
      timeout: OPENAI_TIMEOUT_MS
    });

    if (mode === "analysis") {
      const response = await client.responses
        .create(
          {
            model: analysisModel,
            input: buildAnalysisPrompt(input),
            max_output_tokens: ANALYSIS_OUTPUT_TOKEN_LIMIT,
            stream: false
          },
          {
            maxRetries: 0,
            timeout: ANALYSIS_TIMEOUT_MS
          }
        )
        .catch((error: unknown) => {
          logOpenAIError("client.responses.create.analysis", error);

          const detail =
            error instanceof Error ? `（${error.message.slice(0, 160)}）` : "";
          return buildSafeAnalysisPayload(
            input,
            "rule-based",
            `企業分析が制限時間内に完了しなかったため、入力情報からルールベース簡易分析を表示しています${detail}`
          );
        });

      if ("analysis" in response) {
        return NextResponse.json(response);
      }

      const responseError = extractResponseError(response);

      if (responseError) {
        console.error("[api/generate] OpenAI analysis response returned error", {
          errorMessage: responseError,
          response
        });

        return NextResponse.json(
          buildSafeAnalysisPayload(
            input,
            "rule-based",
            `OpenAI APIでエラーが発生したため、入力情報からルールベース簡易分析を表示しています（${responseError.slice(0, 160)}）`
          )
        );
      }

      try {
        const analysis = parseAnalysisJson(extractResponseText(response), input);
        return NextResponse.json({
          analysis,
          analysisText: formatAnalysisText(analysis),
          demo: false,
          model: analysisModel
        } satisfies AnalysisResponse);
      } catch (error) {
        logRouteError("extractAnalysisText", error);

        const detail =
          error instanceof Error ? `（${error.message.slice(0, 160)}）` : "";
        return NextResponse.json(
          buildSafeAnalysisPayload(
            input,
            "rule-based",
            `AIの分析結果を取得できなかったため、入力情報からルールベース簡易分析を表示しています${detail}`
          )
        );
      }
    }

    if (mode === "detail" && analysisData) {
      const response = await client.responses
        .create(
          {
            model: proposalModel,
            instructions: systemPrompt,
            input: `${buildDetailPrompt(input, analysisData, proposalText)}\n\n${detailOutputInstruction}`,
            max_output_tokens: DETAIL_OUTPUT_TOKEN_LIMIT,
            stream: false
          },
          {
            maxRetries: 0,
            timeout: OPENAI_TIMEOUT_MS
          }
        )
        .catch((error: unknown) => {
          logOpenAIError("client.responses.create.detail", error);

          const detail =
            error instanceof Error ? `（${error.message.slice(0, 160)}）` : "";
          return {
            detail:
              "## KPI\n採用応募数、自治体接点数、メディア露出数を追います。\n\n## 営業メール\n分析と提案をもとに個別メールを作成します。\n\n## PDF用詳細\n提案背景、自治体候補、PR展開を整理します。\n\n## 役員説明\n人的資本、ESG、営業ブランド投資として説明します。",
            demo: true,
            model: proposalModel,
            notice: `詳細生成が制限時間内に完了しなかったため、サンプル詳細を表示しています${detail}`
          } satisfies DetailResponse;
        });

      if ("detail" in response) {
        return NextResponse.json(response);
      }

      try {
        const detail = extractResponseText(response);
        return NextResponse.json({
          detail,
          demo: false,
          model: proposalModel
        } satisfies DetailResponse);
      } catch (error) {
        logRouteError("extractDetailText", error);

        return NextResponse.json({
          detail:
            "## KPI\n採用応募数、自治体接点数、メディア露出数を追います。\n\n## 営業メール\n分析と提案をもとに個別メールを作成します。\n\n## PDF用詳細\n提案背景、自治体候補、PR展開を整理します。\n\n## 役員説明\n人的資本、ESG、営業ブランド投資として説明します。",
          demo: true,
          model: proposalModel,
          notice: "AIの詳細結果を取得できなかったため、サンプル詳細を表示しています。"
        } satisfies DetailResponse);
      }
    }

    const response = await client.responses
      .create(
        {
          model: proposalModel,
          instructions: systemPrompt,
          input: `${buildProposalPrompt(input, analysisData as StrategicAnalysis)}\n\n${proposalOutputInstruction}`,
          max_output_tokens: PROPOSAL_OUTPUT_TOKEN_LIMIT,
          stream: false
        },
        {
          maxRetries: 0,
          timeout: OPENAI_TIMEOUT_MS
        }
      )
      .catch((error: unknown) => {
        logOpenAIError("client.responses.create.proposal", error);

        const detail =
          error instanceof Error ? `（${error.message.slice(0, 160)}）` : "";
        return buildSafeFallbackPayload(
          input,
          proposalModel,
          `AI生成が制限時間内に完了しなかったため、軽量なサンプル提案を表示しています${detail}`
        );
      });

    if ("proposal" in response) {
      return NextResponse.json(response);
    }

    const responseError = extractResponseError(response);

    if (responseError) {
      console.error("[api/generate] OpenAI response returned error", {
        errorMessage: responseError,
        response
      });

      return NextResponse.json(
        buildSafeFallbackPayload(
          input,
          proposalModel,
          `OpenAI APIでエラーが発生したため、軽量なサンプル提案を表示しています（${responseError.slice(0, 160)}）`
        )
      );
    }

    let generatedText = "";

    try {
      generatedText = extractResponseText(response);
    } catch (error) {
      logRouteError("extractResponseText", error);

      const detail =
        error instanceof Error ? `（${error.message.slice(0, 160)}）` : "";
      return NextResponse.json(
        buildSafeFallbackPayload(
          input,
          proposalModel,
          `AIの返答を取得できなかったため、軽量なサンプル提案を表示しています${detail}`
        )
      );
    }

    const proposal = buildProposalFromText(input, generatedText);
    const payload: GenerateResponse = {
      proposal,
      demo: false,
      model: proposalModel
    };

    return NextResponse.json(payload);
  } catch (error) {
    logRouteError("POST", error);

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
