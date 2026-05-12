import type { CompanyInput, StrategicAnalysis } from "@/lib/types";

export const systemPrompt = `
あなたはテレビ局営業、自治体営業、PRコンサル、中小企業診断士、地域創生プロデューサーです。

企業版ふるさと納税を、寄付ではなく「地域と共につくる人的資本・営業ブランド投資」として設計してください。

最重要ルール:
- 絶対にテンプレ提案にしない。
- どの企業にも言える一般論は禁止。
- 必ず STEP1 で企業戦略分析を行ってから、STEP2 で提案を作る。
- 提案本文では「なぜこの企業にこの自治体なのか」を具体的に説明する。
- 企業の業界構造、市場変化、採用課題、地域接点、ESG文脈、ニュース性を踏まえる。
- 「地域共創」のような抽象ワードを連発しない。

業種別優先テーマ:
- 製造業: 高専、工業高校、ものづくり人材、地域産業基盤、ファブラボ、STEAM教育。
- インフラ: 防災、地域強靭化、インフラ老朽化、エネルギー。
- IT/DX: デジタル教育、DX人材、地方DX。
- 食品: 食育、農業、地域ブランド、観光。
- 放送・メディア: 地域発信、移住、観光、地域ブランディング、クリエイター育成。
- 放送局なら広告市場縮小、TVer競争、IP事業、地域事業転換を踏まえる。
- 製造業なら高専採用、技能継承、GX、工場人材不足を踏まえる。

文体:
- テレビ局営業の実務感、コンサル感、ニュース性を混ぜる。
- ふわっとしたポエムは禁止。
`.trim();

function clip(value: string, limit = 220) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > limit ? `${normalized.slice(0, limit)}...` : normalized;
}

function formatCompanyInput(input: CompanyInput) {
  return `
企業名: ${clip(input.companyName) || "未入力"}
業種: ${clip(input.industry) || "未入力"}
企業URL: ${clip(input.companyUrl, 120) || "未入力"}
ニュース: ${clip(input.news, 160) || "未入力"}
IR情報: ${clip(input.ir, 160) || "未入力"}
採用情報: ${clip(input.recruiting, 160) || "未入力"}
CSR情報: ${clip(input.csr, 160) || "未入力"}
課題感: ${clip(input.painPoints, 160) || "未入力"}
自由入力: ${clip(input.memo, 160) || "未入力"}
`.trim();
}

export function buildAnalysisPrompt(input: CompanyInput) {
  return `
以下の企業情報をもとに、STEP1の軽量分析JSONだけを作成してください。

${formatCompanyInput(input)}

出力要件:
- JSONのみ。Markdown禁止。
- reasoningや長い前置きは禁止。
- 提案、自治体名、PR施策詳細は書かない。
- 各値は最大120字。長文禁止。
- テンプレ禁止。業種、ニュース、CSR、採用情報から企業固有に推論する。
- 製造業は高専採用、技能継承、GX。放送・メディアは広告市場縮小、TVer、IP、地域事業転換を踏まえる。
- 必ず以下4キーだけを返す。

{
  "companyCharacteristics": "企業特性",
  "industryIssues": "業界課題",
  "regionalConnectivity": "地域接続性",
  "donationThemeHypothesis": "寄付テーマ仮説"
}
`.trim();
}

export function buildProposalPrompt(
  input: CompanyInput,
  analysis: StrategicAnalysis
) {
  return `
以下のSTEP1分析結果を使って、STEP2として提案だけを作成してください。
重要: STEP1を再計算しない。分析結果を前提に「なぜこの企業にこの自治体なのか」を具体的に説明してください。

${formatCompanyInput(input)}

STEP1分析JSON:
${JSON.stringify(analysis)}

出力要件:
- 一般論、どの企業にも言える表現は禁止。
- 「地域共創」という抽象ワードの連発は禁止。
- 業界構造や市場変化を踏まえる。
- 自治体候補は3つ。それぞれ相性、テーマ、ニュース化ポイントを書く。
- KPI、営業メール、PDF用詳細、役員説明はSTEP3で扱うため書かない。

## 提案タイトル
## 提案概要
## 自治体候補
## PR戦略
## TV/TVer/SNS施策
## ニュース化シナリオ
## 営業活用方法
`.trim();
}

export function buildDetailPrompt(
  input: CompanyInput,
  analysis: StrategicAnalysis,
  proposalText: string
) {
  return `
以下のSTEP1分析とSTEP2提案を前提に、STEP3の追加資料だけを作成してください。
STEP1とSTEP2を再生成しないでください。

${formatCompanyInput(input)}

STEP1分析JSON:
${JSON.stringify(analysis)}

STEP2提案:
${clip(proposalText, 1800)}

出力要件:
- KPI、営業メール、PDF用詳細、役員説明だけを出力。
- 各セクションは短く実務で使える内容にする。

## KPI
## 営業メール
## PDF用詳細
## 役員説明
`.trim();
}
