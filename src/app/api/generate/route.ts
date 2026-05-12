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
  MunicipalityCandidate,
  ProposalOutput,
  ProposalVariables,
  StrategicAnalysis
} from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 15;

const OPENAI_TIMEOUT_MS = 12000;
const ANALYSIS_TIMEOUT_MS = 6000;
const ANALYSIS_OUTPUT_TOKEN_LIMIT = 500;
const PROPOSAL_OUTPUT_TOKEN_LIMIT = 300;
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
- JSONのみ。Markdownは禁止。
- core_theme, target_region, media_angle, pr_hook, recruiting_angle, esg_angle, recommended_industries, suggested_municipality_type だけ返す。
- 自治体実名、提案本文、KPI、営業メール、表、コードブロックは禁止。
`.trim();

const detailOutputInstruction = `
出力形式:
- 通常テキストで返す。JSONは禁止。
- STEP3の追加生成だけを返す。
- 見出しは KPI、営業メール、PDF用詳細、役員説明 の4つだけ。
- STEP1分析とSTEP2提案は再生成しない。
`.trim();

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

function readStringArrayField(value: unknown, key: string) {
  if (!isRecord(value) || !Array.isArray(value[key])) {
    return [];
  }

  return value[key].filter((item): item is string => typeof item === "string");
}

function buildRuleBasedProposalVariables(
  input: CompanyInput,
  analysis: StrategicAnalysis
) {
  const source = `${input.industry} ${input.news} ${input.csr} ${input.recruiting} ${input.painPoints} ${input.memo}`;

  if (includesAny(source, ["製造", "メーカー", "工場", "機械", "部品", "素材"])) {
    return {
      core_theme: "次世代ものづくり人材育成",
      target_region: "工業高校・高専を持つ地域",
      media_angle: "地域産業の担い手不足",
      pr_hook: "学生と技術者の共同ワークショップ",
      recruiting_angle: "若手技術者採用",
      esg_angle: "技能継承とGX人材育成",
      recommended_industries: ["製造業", "地域産業", "教育"],
      suggested_municipality_type: "工業都市"
    } satisfies ProposalVariables;
  }

  if (includesAny(source, ["放送", "テレビ", "メディア", "広告", "番組"])) {
    return {
      core_theme: "地域発信人材育成",
      target_region: "観光・移住を強化する地域",
      media_angle: "地域の魅力を映像で再編集",
      pr_hook: "自治体と作る地域発信プロジェクト",
      recruiting_angle: "企画・映像人材への採用訴求",
      esg_angle: "地域情報格差の解消",
      recommended_industries: ["放送", "観光", "教育"],
      suggested_municipality_type: "クリエイター育成地域"
    } satisfies ProposalVariables;
  }

  if (includesAny(source, ["IT", "DX", "SaaS", "システム", "デジタル", "AI"])) {
    return {
      core_theme: "地方DX人材育成",
      target_region: "DX推進自治体",
      media_angle: "自治体DXを支える民間技術",
      pr_hook: "学生向けデジタル実装講座",
      recruiting_angle: "社会実装型エンジニア採用",
      esg_angle: "デジタル教育格差の解消",
      recommended_industries: ["IT", "教育", "行政DX"],
      suggested_municipality_type: "DX推進地域"
    } satisfies ProposalVariables;
  }

  if (includesAny(source, ["インフラ", "電力", "エネルギー", "建設", "土木", "交通"])) {
    return {
      core_theme: "地域防災・強靭化人材育成",
      target_region: "防災重点地域",
      media_angle: "地域インフラを守る人材不足",
      pr_hook: "防災教育と現場見学",
      recruiting_angle: "社会基盤を支える仕事の可視化",
      esg_angle: "防災と脱炭素の地域貢献",
      recommended_industries: ["インフラ", "防災", "エネルギー"],
      suggested_municipality_type: "防災強化地域"
    } satisfies ProposalVariables;
  }

  if (includesAny(source, ["食品", "飲料", "農業", "食", "外食"])) {
    return {
      core_theme: "食育・地域ブランド育成",
      target_region: "農業・観光連携地域",
      media_angle: "地域食材と企業ブランドの接続",
      pr_hook: "子ども向け食育ワークショップ",
      recruiting_angle: "食で地域に関わる仕事の訴求",
      esg_angle: "食育と地域産業支援",
      recommended_industries: ["食品", "農業", "観光"],
      suggested_municipality_type: "農業・食育地域"
    } satisfies ProposalVariables;
  }

  return {
    core_theme: analysis.donationThemeHypothesis || "地域人材育成",
    target_region: "人口減少と若者流出に向き合う地域",
    media_angle: analysis.regionalConnectivity || "地域課題と企業活動の接点",
    pr_hook: "自治体・企業・若者の共同発表",
    recruiting_angle: "社会性を伝える採用広報",
    esg_angle: analysis.industryIssues || "人的資本と地域産業支援",
    recommended_industries: [input.industry || "地域産業", "教育", "PR"],
    suggested_municipality_type: "人口減少地域"
  } satisfies ProposalVariables;
}

function parseProposalVariables(
  text: string,
  input: CompanyInput,
  analysis: StrategicAnalysis
) {
  const stripped = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  const jsonText = stripped.match(/\{[\s\S]*\}/)?.[0] ?? stripped;
  const fallback = buildRuleBasedProposalVariables(input, analysis);

  try {
    const parsed = JSON.parse(jsonText) as Partial<ProposalVariables>;

    const recommendedIndustries = readStringArrayField(
      parsed,
      "recommended_industries"
    )
      .slice(0, 3)
      .map((item) => compact(item, 24));

    return {
      core_theme: compact(parsed.core_theme || fallback.core_theme, 48),
      target_region: compact(parsed.target_region || fallback.target_region, 48),
      media_angle: compact(parsed.media_angle || fallback.media_angle, 48),
      pr_hook: compact(parsed.pr_hook || fallback.pr_hook, 48),
      recruiting_angle: compact(
        parsed.recruiting_angle || fallback.recruiting_angle,
        48
      ),
      esg_angle: compact(parsed.esg_angle || fallback.esg_angle, 48),
      recommended_industries:
        recommendedIndustries.length > 0
          ? recommendedIndustries
          : fallback.recommended_industries,
      suggested_municipality_type: compact(
        parsed.suggested_municipality_type ||
          fallback.suggested_municipality_type,
        32
      )
    } satisfies ProposalVariables;
  } catch {
    return fallback;
  }
}

const municipalityMap: Record<string, MunicipalityCandidate[]> = {
  工業都市: [
    {
      name: "長岡市",
      prefecture: "新潟県",
      themes: ["高専連携", "ものづくり", "若者定着"],
      reason: "",
      prHook: "",
      educationAsset: "長岡高専・工業系教育資産",
      populationIssue: "高度技術人材の地元定着"
    },
    {
      name: "北上市",
      prefecture: "岩手県",
      themes: ["産業集積", "工業高校", "採用課題"],
      reason: "",
      prHook: "",
      educationAsset: "工業高校・製造業ネットワーク",
      populationIssue: "地域産業の担い手不足"
    },
    {
      name: "豊田市",
      prefecture: "愛知県",
      themes: ["ものづくり", "DX", "産業人材"],
      reason: "",
      prHook: "",
      educationAsset: "工業高校・大学・産業支援機関",
      populationIssue: "高度技術人材の継続確保"
    }
  ],
  人口減少地域: [
    {
      name: "日南市",
      prefecture: "宮崎県",
      themes: ["人口減少", "若者流出", "移住"],
      reason: "",
      prHook: "",
      educationAsset: "地域学校・移住促進施策",
      populationIssue: "若年層の都市部流出"
    },
    {
      name: "雲南市",
      prefecture: "島根県",
      themes: ["若者定着", "地域課題解決", "教育"],
      reason: "",
      prHook: "",
      educationAsset: "地域自主組織・探究学習",
      populationIssue: "人口減少と地域の担い手不足"
    },
    {
      name: "真庭市",
      prefecture: "岡山県",
      themes: ["地域産業", "脱炭素", "若者定着"],
      reason: "",
      prHook: "",
      educationAsset: "地域産業・環境教育",
      populationIssue: "地域産業の継承と若者流出"
    }
  ],
  観光強化地域: [
    {
      name: "函館市",
      prefecture: "北海道",
      themes: ["観光", "地域ブランド", "若者定着"],
      reason: "",
      prHook: "",
      educationAsset: "観光教育・地域大学",
      populationIssue: "観光人材不足と若者流出"
    },
    {
      name: "別府市",
      prefecture: "大分県",
      themes: ["観光DX", "地域発信", "教育"],
      reason: "",
      prHook: "",
      educationAsset: "観光資源・大学連携",
      populationIssue: "観光産業の担い手確保"
    },
    {
      name: "飛騨市",
      prefecture: "岐阜県",
      themes: ["関係人口", "観光", "地域産業"],
      reason: "",
      prHook: "",
      educationAsset: "地域資源・探究学習",
      populationIssue: "人口減少と関係人口づくり"
    }
  ],
  DX推進地域: [
    {
      name: "会津若松市",
      prefecture: "福島県",
      themes: ["スマートシティ", "DX", "教育"],
      reason: "",
      prHook: "",
      educationAsset: "会津大学・ICT教育資産",
      populationIssue: "地域DX人材の育成"
    },
    {
      name: "鯖江市",
      prefecture: "福井県",
      themes: ["オープンデータ", "地域産業DX", "若者参画"],
      reason: "",
      prHook: "",
      educationAsset: "地場産業・学校連携",
      populationIssue: "若者の地域定着"
    },
    {
      name: "加賀市",
      prefecture: "石川県",
      themes: ["先端教育", "DX", "スマートシティ"],
      reason: "",
      prHook: "",
      educationAsset: "STEAM教育・スマートシティ施策",
      populationIssue: "デジタル人材の地域定着"
    }
  ],
  教育連携地域: [
    {
      name: "呉市",
      prefecture: "広島県",
      themes: ["高専", "ものづくり", "地域産業"],
      reason: "",
      prHook: "",
      educationAsset: "呉高専・工業教育",
      populationIssue: "技術人材の地元定着"
    },
    {
      name: "佐世保市",
      prefecture: "長崎県",
      themes: ["高専", "地域産業", "若者流出"],
      reason: "",
      prHook: "",
      educationAsset: "佐世保高専・工業教育",
      populationIssue: "若年層の県外流出"
    },
    {
      name: "長岡市",
      prefecture: "新潟県",
      themes: ["高専連携", "教育", "産業人材"],
      reason: "",
      prHook: "",
      educationAsset: "長岡高専・大学連携",
      populationIssue: "高度人材の地元定着"
    }
  ],
  防災強化地域: [
    {
      name: "静岡市",
      prefecture: "静岡県",
      themes: ["防災", "地域強靭化", "教育"],
      reason: "",
      prHook: "",
      educationAsset: "防災教育・地域訓練",
      populationIssue: "地域防災の担い手確保"
    },
    {
      name: "釜石市",
      prefecture: "岩手県",
      themes: ["防災教育", "復興", "地域人材"],
      reason: "",
      prHook: "",
      educationAsset: "防災学習・地域学校",
      populationIssue: "復興後の若者定着"
    },
    {
      name: "熊本市",
      prefecture: "熊本県",
      themes: ["防災", "インフラ", "教育"],
      reason: "",
      prHook: "",
      educationAsset: "防災教育・大学連携",
      populationIssue: "防災・インフラ人材の育成"
    }
  ],
  "農業・食育地域": [
    {
      name: "帯広市",
      prefecture: "北海道",
      themes: ["農業", "食育", "地域ブランド"],
      reason: "",
      prHook: "",
      educationAsset: "農業高校・食育資源",
      populationIssue: "農業人材の確保"
    },
    {
      name: "鶴岡市",
      prefecture: "山形県",
      themes: ["食文化", "農業", "地域ブランド"],
      reason: "",
      prHook: "",
      educationAsset: "食文化・学校連携",
      populationIssue: "地域産品の担い手不足"
    },
    {
      name: "今治市",
      prefecture: "愛媛県",
      themes: ["食育", "観光", "地域産業"],
      reason: "",
      prHook: "",
      educationAsset: "食育・地域産業教育",
      populationIssue: "地域産業の継承"
    }
  ],
  クリエイター育成地域: [
    {
      name: "金沢市",
      prefecture: "石川県",
      themes: ["文化発信", "観光", "クリエイター育成"],
      reason: "",
      prHook: "",
      educationAsset: "美術・文化教育資源",
      populationIssue: "若手クリエイターの地域定着"
    },
    {
      name: "神山町",
      prefecture: "徳島県",
      themes: ["移住", "創造人材", "地域発信"],
      reason: "",
      prHook: "",
      educationAsset: "創造人材・地域プロジェクト",
      populationIssue: "人口減少と関係人口づくり"
    },
    {
      name: "福岡市",
      prefecture: "福岡県",
      themes: ["クリエイティブ", "スタートアップ", "映像"],
      reason: "",
      prHook: "",
      educationAsset: "大学・クリエイティブ人材",
      populationIssue: "地域発信人材の育成"
    }
  ]
};

function resolveMunicipalityType(value: string, input: CompanyInput) {
  const source = `${value} ${input.industry} ${input.news} ${input.memo}`;

  if (includesAny(source, ["工業", "製造", "高専", "ものづくり"])) {
    return "工業都市";
  }

  if (includesAny(source, ["DX", "IT", "デジタル", "SaaS", "AI"])) {
    return "DX推進地域";
  }

  if (includesAny(source, ["防災", "インフラ", "エネルギー", "交通"])) {
    return "防災強化地域";
  }

  if (includesAny(source, ["食品", "食育", "農業", "飲料"])) {
    return "農業・食育地域";
  }

  if (includesAny(source, ["観光", "移住"])) {
    return "観光強化地域";
  }

  if (includesAny(source, ["放送", "メディア", "映像", "クリエイター"])) {
    return "クリエイター育成地域";
  }

  if (includesAny(source, ["教育", "学校", "若者", "人材"])) {
    return "教育連携地域";
  }

  return municipalityMap[value] ? value : "人口減少地域";
}

function buildMunicipalityCandidates(
  input: CompanyInput,
  variables: ProposalVariables
) {
  const category = resolveMunicipalityType(
    variables.suggested_municipality_type,
    input
  );
  const pool = municipalityMap[category] ?? municipalityMap["人口減少地域"];

  return pool.slice(0, 3).map((candidate) => ({
    ...candidate,
    themes: Array.from(
      new Set([
        ...candidate.themes,
        variables.core_theme,
        variables.suggested_municipality_type
      ])
    ).slice(0, 4),
    reason: `${candidate.name}は${category}として、${variables.target_region}に近い政策文脈を作りやすい。${variables.core_theme}を寄付テーマにすると、企業側の採用・ESG価値を地域課題と接続できる。`,
    prHook: `${variables.pr_hook}を起点に、首長コメント、学生・社員参加、地域課題の現場映像を組み合わせてニュース化する。`
  }));
}

function getIndustryTemplate(input: CompanyInput) {
  const source = `${input.industry} ${input.news} ${input.csr} ${input.memo}`;

  if (includesAny(source, ["放送", "テレビ", "メディア", "広告", "番組"])) {
    return {
      label: "放送・メディア",
      themes: ["地域発信", "観光・移住PR", "クリエイター育成", "TVer活用"],
      tv: "地上波では、自治体課題を入口に地域発信プロジェクトとして紹介する。企業宣伝ではなく、地域の魅力を映像で再編集する取り組みとして扱う。",
      tver: "TVerでは地上波素材を15秒、30秒、90秒に分解し、観光関心層、移住関心層、企画職志望層へ配信する。",
      sns: ["若手社員が地域の魅力を縦型で紹介", "自治体職員と番組制作者の対談", "地域クリエイター育成の舞台裏"],
      youtube: "YouTubeではプロジェクトの全体像、制作過程、自治体側の課題を3分動画で残し、営業資料と採用広報に二次利用する。",
      recruitment: "広告市場縮小やTVer競争の中で、地域事業を作れる企画人材に向けた採用広報として使う。"
    };
  }

  if (includesAny(source, ["製造", "メーカー", "工場", "機械", "部品", "素材"])) {
    return {
      label: "製造業",
      themes: ["高専連携", "工業高校", "技能継承", "GX人材"],
      tv: "地上波では、地域のものづくり人材不足を切り口に、社員と学生が技術を学び合う現場をニュース化する。",
      tver: "TVerでは技術職志望層、理工系学生、保護者に向けて、仕事の社会性と現場の魅力を短尺で届ける。",
      sns: ["若手技術者の1日密着", "高専生との共同ワークショップ", "工場見学のショート動画"],
      youtube: "YouTubeでは技術、地域課題、社員の思いを3分でまとめ、採用ページと展示会資料に埋め込む。",
      recruitment: "高専採用、技能継承、GX対応を、求人広告ではなく自治体公認の人材育成ストーリーとして伝える。"
    };
  }

  if (includesAny(source, ["IT", "DX", "SaaS", "システム", "デジタル", "AI"])) {
    return {
      label: "IT/DX",
      themes: ["地方DX", "デジタル教育", "行政DX", "DX人材育成"],
      tv: "地上波では、自治体DXを進める現場と学生向けデジタル教育を結び、地域の変化として紹介する。",
      tver: "TVerではエンジニア志望層や地方就職関心層に向けて、社会実装型の仕事を訴求する。",
      sns: ["自治体DXを1分で解説", "社員が教えるデジタル講座", "学生ハッカソンの舞台裏"],
      youtube: "YouTubeではDX講座や実証の成果をアーカイブし、採用説明会と自治体営業に活用する。",
      recruitment: "単なる開発会社ではなく、地域課題を実装で変えるエンジニア組織として採用認知を作る。"
    };
  }

  if (includesAny(source, ["食品", "飲料", "農業", "食", "外食"])) {
    return {
      label: "食品",
      themes: ["食育", "農業", "地域ブランド", "観光"],
      tv: "地上波では、地域食材、子どもの食育、観光をつなぎ、生活者に届く地域ブランド企画として見せる。",
      tver: "TVerでは子育て層、観光関心層、地域産品関心層に向けて短尺素材を配信する。",
      sns: ["食育教室のショート動画", "地域食材の生産者紹介", "社員が地域メニューを体験"],
      youtube: "YouTubeでは食育、地域産品、企業の品質思想を一本のストーリーとして保存する。",
      recruitment: "食の安全、地域素材、生活者接点を通じて、社会性のある仕事として採用広報に展開する。"
    };
  }

  if (includesAny(source, ["インフラ", "電力", "エネルギー", "建設", "土木", "交通"])) {
    return {
      label: "インフラ",
      themes: ["防災", "地域強靭化", "インフラ人材", "脱炭素"],
      tv: "地上波では、防災や地域インフラを支える人材不足を切り口に、企業の公共性をニュース化する。",
      tver: "TVerでは地域生活者、学生、保護者に向けて、社会基盤を支える仕事の意義を伝える。",
      sns: ["防災教育の現場", "若手社員のインフラ点検密着", "地域訓練の舞台裏"],
      youtube: "YouTubeでは防災教育、現場技術、自治体連携の流れを整理し、IRと採用に二次利用する。",
      recruitment: "社会基盤を支える仕事の誇りを、自治体連携と社員出演で具体化する。"
    };
  }

  return {
    label: "汎用",
    themes: ["人口減少対策", "若者流出対策", "教育連携", "地域産業支援"],
    tv: "地上波では、自治体課題と企業の参加理由を明確にし、地域の未来人材に関わるニュースとして扱う。",
    tver: "TVerでは採用関心層と地域関心層へ短尺で再配信し、検索と採用サイト流入を補強する。",
    sns: ["社員が地域課題を解説", "自治体担当者との対談", "活動現場のショート動画"],
    youtube: "YouTubeではプロジェクト概要を残し、営業資料、採用ページ、自治体ページで再利用する。",
    recruitment: "社会性と事業接点を見せることで、求人広告だけでは届かない採用候補者に訴求する。"
  };
}

function fixedKpis() {
  return [
    { label: "自治体接点", target: "3件", note: "候補自治体との初回協議数" },
    { label: "メディア露出", target: "1から2件", note: "ニュース・情報番組・自治体広報での露出" },
    { label: "SNS総再生", target: "5万回", note: "縦型動画3から5本の合算" },
    { label: "採用サイト流入", target: "前年比120%", note: "公開後2週間の流入変化" },
    { label: "営業資料活用", target: "20件", note: "商談・展示会・IR説明での利用数" }
  ] satisfies ProposalOutput["kpis"];
}

function buildProposalFromVariables(
  input: CompanyInput,
  analysis: StrategicAnalysis,
  variables: ProposalVariables
) {
  const base = buildDemoProposal(input);
  const company = input.companyName || "貴社";
  const industry = input.industry || "対象業種";
  const template = getIndustryTemplate(input);
  const candidates = buildMunicipalityCandidates(input, variables);
  const industryList =
    variables.recommended_industries.length > 0
      ? variables.recommended_industries
      : [template.label, industry, "地域産業"];

  return {
    ...base,
    proposalTitles: [
      `${company} ${variables.core_theme}プロジェクト`,
      `${company} 人的資本・ESG発信型 企業版ふるさと納税戦略`,
      `${variables.suggested_municipality_type}とつくる ${variables.recruiting_angle}PR`,
      `${company} × 自治体 ${variables.pr_hook}企画`
    ],
    executiveSummary: `${company}のSTEP1分析では「${analysis.companyCharacteristics}」が見えています。STEP2では、AIが抽出した中核テーマ「${variables.core_theme}」を起点に、${variables.suggested_municipality_type}との接点を作ります。提案本文はテンプレートで安定生成しつつ、${variables.media_angle}、${variables.recruiting_angle}、${variables.esg_angle}を企業固有の差分として反映します。`,
    companyAnalysis: `${company}は${industry}として、${analysis.industryIssues}という業界課題を抱えやすい。一方で、${analysis.regionalConnectivity}ため、企業版ふるさと納税を単なる寄付ではなく、採用・ESG・営業ブランドの実証接点に転換できます。`,
    assumedIssues: [
      analysis.industryIssues,
      `${variables.recruiting_angle}を求人媒体だけでなく、地域活動の実績として見せる必要がある`,
      `${variables.media_angle}を報道・情報番組が扱える社会性に翻訳する必要がある`,
      "自治体連携が単発の寄付で終わると、営業資料や採用広報に再利用しにくい"
    ],
    csrEsgPerspective: [
      `人的資本: ${variables.recruiting_angle}を地域人材育成と接続`,
      `ESG: ${variables.esg_angle}を自治体政策と接続`,
      `地域産業: ${industryList.join("、")}の担い手づくりとして説明`,
      "営業ブランド: 自治体公認の社会性ある取り組みとして商談資料化"
    ],
    recruitmentIssues: [
      template.recruitment,
      `${variables.core_theme}に社員が関わることで、仕事内容の社会的意義を可視化する`,
      "学生、保護者、地域関係者に第三者性のある採用接点を作る"
    ],
    municipalityThemes: Array.from(
      new Set([
        variables.suggested_municipality_type,
        variables.target_region,
        variables.core_theme,
        ...template.themes
      ])
    ).slice(0, 8),
    municipalityCandidates: candidates,
    donationStory: `${company}が${variables.suggested_municipality_type}に対して、${variables.core_theme}を支援するストーリーです。寄付金の使途は教育、地域産業、若者定着のいずれかに置き、社員参加と自治体広報を組み合わせることで、${variables.esg_angle}と${variables.recruiting_angle}を同時に発信します。`,
    prStrategy: `PRは、1. 自治体課題の提示、2. ${company}が関わる理由、3. ${variables.pr_hook}、4. 地上波露出、5. TVer/SNS再編集、6. 採用・営業資料への二次利用、の順に固定テンプレートで展開します。`,
    newsIdeas: [
      `${variables.pr_hook}を核にした首長・企業代表の共同発表`,
      `${variables.media_angle}を地域課題として扱う情報番組企画`,
      `学生・社員・自治体職員が参加する${variables.core_theme}ワークショップ`,
      "感謝状贈呈式を学校・産業施設・地域イベント会場で実施",
      "寄付金の活用先を追うミニドキュメント"
    ],
    ceremonyPlan: `感謝状贈呈式は、庁舎だけでなく${variables.pr_hook}が画になる場所で実施します。首長、企業代表、若手社員、学生を登壇者にし、${variables.core_theme}を地域の未来投資として語ります。`,
    tvPlan: template.tv,
    tverPlan: template.tver,
    snsVideoIdeas: template.sns,
    youtubePlan: template.youtube,
    localGovernmentPr: `自治体広報紙、公式SNS、記者会見、ふるさと納税活用事例ページを連動させます。自治体側は${variables.suggested_municipality_type}の政策事例、企業側は${variables.esg_angle}の実績として発信します。`,
    employeeAppearancePlan: `社員出演は、若手社員、人事責任者、地域拠点長の3層で設計します。若手は${variables.recruiting_angle}、責任者は人的資本、人事は採用メッセージを担います。`,
    recruitmentBranding: `${template.recruitment} そのうえで、${variables.core_theme}への参加を採用説明会、採用サイト、SNSで再利用します。`,
    salesProposalOutline: [
      "STEP1分析の4項目を確認し、企業固有の課題を合意",
      `AI変数で抽出した中核テーマ「${variables.core_theme}」を提示`,
      `${variables.suggested_municipality_type}に該当する自治体候補を3件提示`,
      "固定テンプレートでTV、TVer、SNS、採用広報、自治体広報を説明",
      "KPIと初回アクションを確認し、自治体打診へ進む"
    ],
    kpis: fixedKpis(),
    firstSalesEmail: {
      subject: `【ご提案】${company}様の${variables.core_theme}を起点にした自治体連携PRについて`,
      body: `${company}\nご担当者様\n\n突然のご連絡失礼いたします。\n${variables.core_theme}を起点に、企業版ふるさと納税、自治体連携、テレビ・TVer・SNSでのPR、採用広報まで一体化したご提案についてご連絡いたしました。\n\n貴社の事業特性は、${variables.recruiting_angle}や${variables.esg_angle}の発信と相性が高く、${variables.suggested_municipality_type}との連携により、単なる寄付ではなく人的資本・営業ブランド投資として設計できます。\n\n一度、候補自治体とニュース化の切り口を30分ほどでご紹介できれば幸いです。\nご都合の良い日時をいくつか頂戴できますでしょうか。\n\n何卒よろしくお願いいたします。`
    },
    nextActions: [
      "AI変数とSTEP1分析に違和感がないか確認",
      "自治体カテゴリに合う候補自治体を3件に絞る",
      "寄付対象事業、式典場所、出演者候補を整理",
      "テレビ、TVer、SNS、採用広報の素材化範囲を確認",
      "初回商談で採用課題とPR上のNG条件をヒアリング"
    ],
    riskNotes: [
      "自治体名はアプリ側マッピングの候補であり、実施前に政策テーマと制度要件の確認が必要",
      "テレビ露出は番組判断を伴うため、広告表現と報道表現を分けて設計する",
      "学校名、学生出演、社員出演は事前許諾と個人情報管理を徹底する"
    ],
    channelPlans: [
      {
        channel: "地上波テレビ",
        idea: variables.media_angle,
        execution: template.tv,
        kpi: "露出1から2件"
      },
      {
        channel: "情報番組",
        idea: `${variables.pr_hook}を地域課題特集として展開`,
        execution: "自治体、社員、学生の3者コメントを収録",
        kpi: "番組内尺・問い合わせ数"
      },
      {
        channel: "TVer",
        idea: "地上波素材の短尺再配信",
        execution: template.tver,
        kpi: "再生数・完全視聴率"
      },
      {
        channel: "SNSショート動画",
        idea: `${variables.recruiting_angle}の共感形成`,
        execution: template.sns.join(" / "),
        kpi: "総再生5万回"
      },
      {
        channel: "YouTube",
        idea: "提案ストーリーのアーカイブ化",
        execution: template.youtube,
        kpi: "視聴維持率・採用ページ流入"
      },
      {
        channel: "採用広報",
        idea: variables.recruiting_angle,
        execution: "採用サイト、説明会、スカウト文面へ二次利用",
        kpi: "応募数・説明会参加数"
      }
    ]
  } satisfies ProposalOutput;
}

function buildProposalPayload(
  input: CompanyInput,
  analysis: StrategicAnalysis,
  variables: ProposalVariables,
  model: string,
  demo: boolean,
  notice?: string
) {
  return {
    proposal: buildProposalFromVariables(input, analysis, variables),
    demo,
    model,
    notice,
    variables
  } satisfies GenerateResponse;
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

      if (mode === "analysis") {
        return NextResponse.json(
          buildSafeAnalysisPayload(input, "rule-based", notice)
        );
      }

      const fallbackAnalysis = analysisData ?? buildRuleBasedAnalysis(input);
      const fallbackVariables = buildRuleBasedProposalVariables(
        input,
        fallbackAnalysis
      );

      return NextResponse.json(
        buildProposalPayload(
          input,
          fallbackAnalysis,
          fallbackVariables,
          "rule-based",
          true,
          notice
        )
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

    const proposalAnalysis = analysisData as StrategicAnalysis;
    const response = await client.responses
      .create(
        {
          model: proposalModel,
          input: `${buildProposalPrompt(input, proposalAnalysis)}\n\n${proposalOutputInstruction}`,
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
        return buildProposalPayload(
          input,
          proposalAnalysis,
          buildRuleBasedProposalVariables(input, proposalAnalysis),
          proposalModel,
          true,
          `AI戦略変数の生成が制限時間内に完了しなかったため、ルールベース変数で提案を構築しています${detail}`
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
        buildProposalPayload(
          input,
          proposalAnalysis,
          buildRuleBasedProposalVariables(input, proposalAnalysis),
          proposalModel,
          true,
          `OpenAI APIでエラーが発生したため、ルールベース変数で提案を構築しています（${responseError.slice(0, 160)}）`
        )
      );
    }

    try {
      const variables = parseProposalVariables(
        extractResponseText(response),
        input,
        proposalAnalysis
      );
      return NextResponse.json(
        buildProposalPayload(
          input,
          proposalAnalysis,
          variables,
          proposalModel,
          false
        )
      );
    } catch (error) {
      logRouteError("extractProposalVariables", error);

      const detail =
        error instanceof Error ? `（${error.message.slice(0, 160)}）` : "";
      return NextResponse.json(
        buildProposalPayload(
          input,
          proposalAnalysis,
          buildRuleBasedProposalVariables(input, proposalAnalysis),
          proposalModel,
          true,
          `AIの戦略変数を取得できなかったため、ルールベース変数で提案を構築しています${detail}`
        )
      );
    }
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
