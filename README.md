# 企業版ふるさと納税 PR提案生成ツール

企業情報から、企業分析、自治体候補、企業版ふるさと納税提案、PR戦略、TV/TVer/SNS施策、営業メール、提案タイトルを生成する Next.js アプリです。

## 1. ディレクトリ構成

```txt
.
├─ src/
│  ├─ app/
│  │  ├─ api/generate/route.ts      # OpenAI API接続とデモ生成
│  │  ├─ globals.css                # Tailwind CSS、印刷PDF用CSS
│  │  ├─ layout.tsx                 # 日本語フォント、メタデータ
│  │  └─ page.tsx                   # アプリ画面
│  ├─ components/
│  │  ├─ CompanyForm.tsx            # 企業入力フォーム
│  │  ├─ CopyButton.tsx             # ワンクリックコピー
│  │  ├─ LoadingState.tsx           # ローディング表示
│  │  ├─ ProposalGenerator.tsx      # 入力、生成、エラー状態管理
│  │  ├─ ProposalReport.tsx         # 提案書プレビュー、PDF保存
│  │  └─ SectionCard.tsx            # 出力項目カード
│  └─ lib/
│     ├─ fallback.ts                # APIキー未設定時のサンプル提案
│     ├─ format.ts                  # コピー用テキスト整形
│     ├─ prompt.ts                  # OpenAIプロンプトとJSON Schema
│     ├─ sample.ts                  # サンプル企業データ
│     └─ types.ts                   # 型定義
├─ .env.example
├─ eslint.config.mjs
├─ next.config.ts
├─ package.json
├─ postcss.config.mjs
└─ tsconfig.json
```

## 2. 必要パッケージ

- `next`
- `react`
- `react-dom`
- `tailwindcss`
- `@tailwindcss/postcss`
- `openai`
- `lucide-react`
- `typescript`
- `eslint`
- `eslint-config-next`
- `@types/node`
- `@types/react`
- `@types/react-dom`

## 3. セットアップ方法

```bash
npm install
cp .env.example .env.local
npm run dev
```

ブラウザで `http://localhost:3000` を開きます。

この環境では npm が PATH に存在しなかったため、依存関係のインストールとビルド実行は未実施です。ローカル環境または Vercel 上で `npm install` 後に動作確認してください。

## 4. 実装コード

主要コードは以下です。

- 画面: `src/app/page.tsx`
- 入力と状態管理: `src/components/ProposalGenerator.tsx`
- フォーム: `src/components/CompanyForm.tsx`
- 提案書プレビュー: `src/components/ProposalReport.tsx`
- API Route: `src/app/api/generate/route.ts`
- OpenAIプロンプト: `src/lib/prompt.ts`
- サンプルデータ: `src/lib/sample.ts`

PDF出力はブラウザの印刷保存を使います。`PDF保存` ボタンで印刷ダイアログを開き、保存先を PDF にしてください。

## 5. OpenAI API接続方法

`.env.local` を作成し、以下を設定します。

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5
```

APIキーはサーバー側の `src/app/api/generate/route.ts` だけで読み込みます。フロントエンドには露出しません。

OpenAI公式ドキュメントでは、Node.js/TypeScript 環境向けに `openai` SDK を使い、Responses API は `client.responses.create()` で呼び出します。本アプリもその構成にしています。

APIキーが未設定の場合は、UI確認用のデモ提案を返します。

## 6. デプロイ方法

1. GitHub にリポジトリを作成して push
2. Vercel でリポジトリを Import
3. Environment Variables に `OPENAI_API_KEY` と `OPENAI_MODEL` を設定
4. Framework Preset は Next.js
5. Deploy

Vercel の Build Command は通常 `npm run build`、Output は Next.js の標準設定で問題ありません。

## 7. 改善アイデア

- ユーザー認証と提案履歴保存
- 企業URLの自動クロールと要約
- 自治体データベースとの連携
- TV番組枠、TVer配信枠、広告費の概算見積もり
- 提案書テンプレートの複数パターン化
- PDFの表紙、目次、ロゴ差し替え
- CRM連携、メール送信、商談ステータス管理
- 生成結果の評価、再生成、トーン調整
