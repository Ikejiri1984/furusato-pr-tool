import type { CompanyInput } from "@/lib/types";

export const systemPrompt = `
あなたは広告営業、地域創生、PR、企業版ふるさと納税の提案プランナーです。
初回表示用に、短い提案タイトルと提案概要だけを日本語で作成してください。
採用強化、ESG、地域共創、ニュース化、テレビ/TVer/SNS展開の視点を1つに絞って入れてください。
長文、表、過剰なMarkdown、詳細分析は出力しないでください。
`.trim();

function clip(value: string, limit = 120) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > limit ? `${normalized.slice(0, limit)}...` : normalized;
}

export function buildUserPrompt(input: CompanyInput) {
  return `
企業版ふるさと納税PR提案の初回サマリーを作成してください。

企業名: ${clip(input.companyName) || "未入力"}
業種: ${clip(input.industry) || "未入力"}
ニュース: ${clip(input.news, 100) || "未入力"}
採用情報: ${clip(input.recruiting, 100) || "未入力"}
CSR情報: ${clip(input.csr, 100) || "未入力"}
課題感: ${clip(input.painPoints) || "未入力"}
自由入力: ${clip(input.memo) || "未入力"}

出力要件:
- 300字以内。
- セクションは2個だけ。
- 見出しは必ず「## 提案タイトル」「## 提案概要」。
- 提案タイトルは1行。
- 提案概要は2から3文。
`.trim();
}
