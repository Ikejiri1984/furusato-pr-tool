import type { CompanyInput } from "@/lib/types";

export const emptyCompanyInput: CompanyInput = {
  companyName: "",
  industry: "",
  companyUrl: "",
  news: "",
  ir: "",
  recruiting: "",
  csr: "",
  painPoints: "",
  memo: ""
};

export const sampleCompanyInput: CompanyInput = {
  companyName: "東都精機株式会社",
  industry: "産業用ロボット・精密部品メーカー",
  companyUrl: "https://example.com",
  news:
    "地方工場の増設を検討。中期経営計画で自動化、DX人材、若手技術者採用を重点テーマに設定。",
  ir:
    "売上高は堅調。人的資本投資、サプライチェーン強靭化、地域拠点との共創を非財務KPIとして開示予定。",
  recruiting:
    "機械設計、制御、データ活用人材の採用に課題。高専・工業高校との接点づくりを強化したい。",
  csr:
    "ものづくり教育、脱炭素設備、地域雇用、次世代人材育成をCSR重点領域として掲げている。",
  painPoints:
    "採用広報の差別化、地方自治体との接点不足、ニュースになる地域貢献施策の不足。",
  memo:
    "テレビ局営業として、企業版ふるさと納税を入口に自治体連携、番組露出、TVer、SNS動画、採用ブランディングまで一体提案したい。"
};

export const inputLabels: Record<keyof CompanyInput, string> = {
  companyName: "企業名",
  industry: "業種",
  companyUrl: "企業URL",
  news: "ニュース",
  ir: "IR情報",
  recruiting: "採用情報",
  csr: "CSR情報",
  painPoints: "課題感",
  memo: "自由入力欄"
};
