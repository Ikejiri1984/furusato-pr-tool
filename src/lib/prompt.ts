import type { CompanyInput } from "@/lib/types";

export const systemPrompt = `
あなたはテレビ局営業、自治体営業、PRコンサル、中小企業診断士、地域創生プロデューサーです。

企業版ふるさと納税を、寄付ではなく「地域と共につくる人的資本・営業ブランド投資」として設計してください。

最重要ルール:
- 絶対にテンプレ提案にしない。
- どの企業にも言える一般論は禁止。
- 出力前に内部で、事業特性、業界構造、採用課題、地域接点、ESG文脈、ニュース性を分析する。
- 採用、営業ブランド、ESG、地域共創、自治体連携、テレビ露出の接続理由を書く。

業種別優先テーマ:
- 製造業: 高専、工業高校、ものづくり人材、地域産業基盤、ファブラボ、STEAM教育。
- インフラ: 防災、地域強靭化、インフラ老朽化、エネルギー。
- IT/DX: デジタル教育、DX人材、地方DX。
- 食品: 食育、農業、地域ブランド、観光。
- 放送・メディア: 地域発信、移住、観光、地域ブランディング、クリエイター育成。

文体:
- テレビ局営業の実務感、コンサル感、ニュース性を混ぜる。
- ふわっとしたポエムは禁止。
`.trim();

function clip(value: string, limit = 220) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > limit ? `${normalized.slice(0, limit)}...` : normalized;
}

export function buildUserPrompt(input: CompanyInput) {
  return `
以下の企業情報から、その企業にしか成立しない企業版ふるさと納税PR戦略を作成してください。

企業名: ${clip(input.companyName) || "未入力"}
業種: ${clip(input.industry) || "未入力"}
ニュース: ${clip(input.news, 160) || "未入力"}
IR情報: ${clip(input.ir, 160) || "未入力"}
採用情報: ${clip(input.recruiting, 160) || "未入力"}
CSR情報: ${clip(input.csr, 160) || "未入力"}
課題感: ${clip(input.painPoints, 160) || "未入力"}
自由入力: ${clip(input.memo, 160) || "未入力"}

出力要件:
- 初回生成なので4セクションだけ出力する。
- 各セクションは簡潔に。ただし企業固有の理由は必ず入れる。
- 自治体候補は3自治体。各自治体は「相性 / テーマ / ニュース化ポイント」を1行で書く。
- TV/TVer/SNS施策、ニュース化シナリオ、営業活用、KPIは詳細生成で扱うため書かない。

## 1. 提案タイトル
## 2. 提案概要
## 3. 企業特性分析
## 4. 自治体候補
`.trim();
}
