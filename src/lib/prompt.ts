import type { CompanyInput } from "@/lib/types";

export const systemPrompt = `
あなたは「広告営業 × 地域創生 × PR × 企業版ふるさと納税」を専門にする、戦略コンサルタント兼テレビ局ビジネスプロデューサーです。

目的:
企業情報をもとに、営業現場で初回提案に使える企業版ふるさと納税の軽量提案を生成してください。

必ず反映する思想:
- 単なるCSR提案ではなく、採用強化、人的資本経営、営業ブランディング、ESG、地域共創、社員エンゲージメント、ニュース化、SNS展開、テレビ露出を統合する。
- 企業版ふるさと納税を「寄付」ではなく、自治体課題と企業成長を接続する共創投資として設計する。
- テレビ局営業、広告営業、自治体営業、PR担当が初回商談で使える具体性にする。

品質基準:
- 短く、具体的に、読みやすく書く。
- 1文は80文字以内を目安にする。
- 抽象論を避け、自治体テーマ、PR施策、採用広報、KPIを要点だけ具体化する。
- 企業の業種、採用課題、CSR/ESG、地域との相性を読み替え、汎用文ではなく個別提案にする。
- 断定しすぎず、公開情報の不足部分は「仮説」として表現する。
- 日本語で、自然かつ丁寧な営業文体にする。
`.trim();

function clip(value: string, limit = 280) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > limit ? `${normalized.slice(0, limit)}...` : normalized;
}

export function buildUserPrompt(input: CompanyInput) {
  return `
以下の企業情報から、企業版ふるさと納税とPRを統合した短い営業提案を作成してください。

企業名: ${clip(input.companyName) || "未入力"}
業種: ${clip(input.industry) || "未入力"}
企業URL: ${clip(input.companyUrl, 160) || "未入力"}
ニュース: ${clip(input.news) || "未入力"}
IR情報: ${clip(input.ir) || "未入力"}
採用情報: ${clip(input.recruiting) || "未入力"}
CSR情報: ${clip(input.csr) || "未入力"}
課題感: ${clip(input.painPoints) || "未入力"}
自由入力: ${clip(input.memo) || "未入力"}

出力要件:
- 出力は1000字以内。
- Markdownは「## 見出し」と短い箇条書きだけ。
- セクションは最大8個。
- 各セクションは1から3行。
- 自治体候補は3件まで。
- 初回営業メールは件名1行、本文は250字以内。
- 人口減少、高専、工業高校、DX推進、観光課題、地域産業、子育て支援、採用課題、若者流出の観点は必要なものだけ織り込む。
`.trim();
}
