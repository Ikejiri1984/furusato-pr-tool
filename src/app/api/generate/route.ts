import OpenAI from "openai";
import { NextResponse } from "next/server";

import { buildDemoProposal } from "@/lib/fallback";
import {
  buildAnalysisPrompt,
  buildProposalPrompt,
  systemPrompt
} from "@/lib/prompt";
import type {
  AnalysisResponse,
  CompanyInput,
  GenerateResponse,
  ProposalOutput
} from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 15;

const OPENAI_TIMEOUT_MS = 12000;
const ANALYSIS_OUTPUT_TOKEN_LIMIT = 500;
const PROPOSAL_OUTPUT_TOKEN_LIMIT = 900;

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

const analysisOutputInstruction = `
出力形式:
- 通常テキストで返す。JSONは禁止。
- 企業分析だけを返す。提案タイトルや自治体候補は書かない。
- 見出しは指定7項目だけ使う。
- 各項目は1行。長い前置きは禁止。
`.trim();

const proposalOutputInstruction = `
出力形式:
- 通常テキストで返す。JSONは禁止。
- STEP1分析結果を前提にした提案だけを返す。企業分析を再計算しない。
- 見出しは指定5項目だけ使う。
- 自治体候補は3つ。
- TV/TVer/SNS施策、営業活用、KPIの詳細は書かない。
- 表、コードブロック、長い前置きは禁止。
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

function buildDemoAnalysis(input: CompanyInput) {
  const demo = buildDemoProposal(input);

  return [
    `## 事業構造\n${demo.companyAnalysis}`,
    `## 競争環境\n${demo.assumedIssues[0]}`,
    `## 採用課題\n${demo.recruitmentIssues[0]}`,
    `## 人的資本課題\n${demo.csrEsgPerspective[0]}`,
    `## ESG文脈\n${demo.csrEsgPerspective[1]}`,
    `## ニュース化要素\n${demo.newsIdeas[0]}`,
    `## 自治体と接続すべき理由\n${demo.municipalityThemes.slice(0, 3).join("、")}と接続しやすいため。`
  ].join("\n\n");
}

function buildSafeAnalysisPayload(
  input: CompanyInput,
  model: string,
  notice: string
): AnalysisResponse {
  return {
    analysis: buildDemoAnalysis(input),
    demo: true,
    model,
    notice
  };
}

function getMode(value: unknown): "analysis" | "proposal" {
  return isRecord(value) && value.mode === "proposal" ? "proposal" : "analysis";
}

function getAnalysisText(value: unknown) {
  if (!isRecord(value)) {
    return "";
  }

  const analysis = value.analysis;
  return typeof analysis === "string" ? analysis.trim() : "";
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

    const model = process.env.OPENAI_MODEL || "gpt-5";
    const mode = getMode(body);
    const analysisText = getAnalysisText(body);

    if (!process.env.OPENAI_API_KEY) {
      const notice =
        "OPENAI_API_KEY が未設定のため、サンプルを生成しました。.env.local に API キーを設定するとAI生成に切り替わります。";

      return NextResponse.json(
        mode === "analysis"
          ? buildSafeAnalysisPayload(input, "demo", notice)
          : buildSafeFallbackPayload(input, "demo", notice)
      );
    }

    if (mode === "proposal" && !analysisText) {
      return NextResponse.json(
        { error: "先に企業分析を生成してください。" },
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
            model,
            instructions: systemPrompt,
            input: `${buildAnalysisPrompt(input)}\n\n${analysisOutputInstruction}`,
            max_output_tokens: ANALYSIS_OUTPUT_TOKEN_LIMIT,
            stream: false
          },
          {
            maxRetries: 0,
            timeout: OPENAI_TIMEOUT_MS
          }
        )
        .catch((error: unknown) => {
          logOpenAIError("client.responses.create.analysis", error);

          const detail =
            error instanceof Error ? `（${error.message.slice(0, 160)}）` : "";
          return buildSafeAnalysisPayload(
            input,
            model,
            `企業分析が制限時間内に完了しなかったため、サンプル分析を表示しています${detail}`
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
            model,
            `OpenAI APIでエラーが発生したため、サンプル分析を表示しています（${responseError.slice(0, 160)}）`
          )
        );
      }

      try {
        const analysis = extractResponseText(response);
        return NextResponse.json({
          analysis,
          demo: false,
          model
        } satisfies AnalysisResponse);
      } catch (error) {
        logRouteError("extractAnalysisText", error);

        const detail =
          error instanceof Error ? `（${error.message.slice(0, 160)}）` : "";
        return NextResponse.json(
          buildSafeAnalysisPayload(
            input,
            model,
            `AIの分析結果を取得できなかったため、サンプル分析を表示しています${detail}`
          )
        );
      }
    }

    const response = await client.responses
      .create(
        {
          model,
          instructions: systemPrompt,
          input: `${buildProposalPrompt(input, analysisText)}\n\n${proposalOutputInstruction}`,
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
          model,
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
          model,
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
          model,
          `AIの返答を取得できなかったため、軽量なサンプル提案を表示しています${detail}`
        )
      );
    }

    const proposal = buildProposalFromText(input, generatedText);
    const payload: GenerateResponse = {
      proposal,
      demo: false,
      model
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
