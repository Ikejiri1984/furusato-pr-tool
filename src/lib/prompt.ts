import type { CompanyInput } from "@/lib/types";

export const systemPrompt = `
あなたは「広告営業 × 地域創生 × PR × 企業版ふるさと納税」を専門にする、戦略コンサルタント兼テレビ局ビジネスプロデューサーです。

目的:
企業情報をもとに、営業現場でそのまま使える企業版ふるさと納税の提案を生成してください。

必ず反映する思想:
- 単なるCSR提案ではなく、採用強化、人的資本経営、営業ブランディング、ESG、地域共創、社員エンゲージメント、ニュース化、SNS展開、テレビ露出を統合する。
- 企業版ふるさと納税を「寄付」ではなく、自治体課題と企業成長を接続する共創投資として設計する。
- テレビ局営業、広告営業、自治体営業、PR担当が初回商談で使える具体性にする。

品質基準:
- 戦略コンサル会社レベルの論理性と、テレビ局営業の企画実装力を両立する。
- 抽象論を避け、テーマ、対象自治体、番組化、ニュース化、TVer、SNS、YouTube、採用広報、KPIまで具体化する。
- 企業の業種、採用課題、CSR/ESG、地域との相性を読み替え、汎用文ではなく個別提案にする。
- 断定しすぎず、公開情報の不足部分は「仮説」として表現する。
- 日本語で、自然かつ丁寧な営業文体にする。
`.trim();

export function buildUserPrompt(input: CompanyInput) {
  return `
以下の企業情報から、企業版ふるさと納税とPRを統合した営業提案を作成してください。

企業名: ${input.companyName || "未入力"}
業種: ${input.industry || "未入力"}
企業URL: ${input.companyUrl || "未入力"}
ニュース: ${input.news || "未入力"}
IR情報: ${input.ir || "未入力"}
採用情報: ${input.recruiting || "未入力"}
CSR情報: ${input.csr || "未入力"}
課題感: ${input.painPoints || "未入力"}
自由入力: ${input.memo || "未入力"}

出力要件:
- 企業分析
- 想定課題: 5件以上
- CSR/ESG観点: 5件以上
- 採用課題: 4件以上
- 相性の良い自治体テーマ: 7件以上
- 自治体候補: 5件以上
- 寄付ストーリー
- PR戦略
- ニュース化アイデア: 5件以上
- 感謝状贈呈式案
- TV活用案
- TVer活用案
- SNSショート動画企画: 5件以上
- YouTube活用
- 自治体連携PR
- 社員出演
- 採用ブランディング
- 営業提案骨子: 6件以上
- 想定KPI: 6件以上
- 初回営業メール
- 提案タイトル案: 5件以上
- チャネル別施策: 7件以上

自治体候補は、人口減少、高専、工業高校、DX推進、観光課題、地域産業、子育て支援、採用課題、若者流出の観点を必ず織り込んでください。
`.trim();
}

export const proposalJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "proposalTitles",
    "executiveSummary",
    "companyAnalysis",
    "assumedIssues",
    "csrEsgPerspective",
    "recruitmentIssues",
    "municipalityThemes",
    "municipalityCandidates",
    "donationStory",
    "prStrategy",
    "newsIdeas",
    "ceremonyPlan",
    "tvPlan",
    "tverPlan",
    "snsVideoIdeas",
    "youtubePlan",
    "localGovernmentPr",
    "employeeAppearancePlan",
    "recruitmentBranding",
    "salesProposalOutline",
    "kpis",
    "firstSalesEmail",
    "nextActions",
    "riskNotes",
    "channelPlans"
  ],
  properties: {
    proposalTitles: {
      type: "array",
      items: { type: "string" }
    },
    executiveSummary: { type: "string" },
    companyAnalysis: { type: "string" },
    assumedIssues: {
      type: "array",
      items: { type: "string" }
    },
    csrEsgPerspective: {
      type: "array",
      items: { type: "string" }
    },
    recruitmentIssues: {
      type: "array",
      items: { type: "string" }
    },
    municipalityThemes: {
      type: "array",
      items: { type: "string" }
    },
    municipalityCandidates: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "name",
          "prefecture",
          "themes",
          "reason",
          "prHook",
          "educationAsset",
          "populationIssue"
        ],
        properties: {
          name: { type: "string" },
          prefecture: { type: "string" },
          themes: {
            type: "array",
            items: { type: "string" }
          },
          reason: { type: "string" },
          prHook: { type: "string" },
          educationAsset: { type: "string" },
          populationIssue: { type: "string" }
        }
      }
    },
    donationStory: { type: "string" },
    prStrategy: { type: "string" },
    newsIdeas: {
      type: "array",
      items: { type: "string" }
    },
    ceremonyPlan: { type: "string" },
    tvPlan: { type: "string" },
    tverPlan: { type: "string" },
    snsVideoIdeas: {
      type: "array",
      items: { type: "string" }
    },
    youtubePlan: { type: "string" },
    localGovernmentPr: { type: "string" },
    employeeAppearancePlan: { type: "string" },
    recruitmentBranding: { type: "string" },
    salesProposalOutline: {
      type: "array",
      items: { type: "string" }
    },
    kpis: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "target", "note"],
        properties: {
          label: { type: "string" },
          target: { type: "string" },
          note: { type: "string" }
        }
      }
    },
    firstSalesEmail: {
      type: "object",
      additionalProperties: false,
      required: ["subject", "body"],
      properties: {
        subject: { type: "string" },
        body: { type: "string" }
      }
    },
    nextActions: {
      type: "array",
      items: { type: "string" }
    },
    riskNotes: {
      type: "array",
      items: { type: "string" }
    },
    channelPlans: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["channel", "idea", "execution", "kpi"],
        properties: {
          channel: { type: "string" },
          idea: { type: "string" },
          execution: { type: "string" },
          kpi: { type: "string" }
        }
      }
    }
  }
} as const;
