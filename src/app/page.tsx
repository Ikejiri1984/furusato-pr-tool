import { ProposalGenerator } from "@/components/ProposalGenerator";

export default function Home() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#fafaf9_0%,#ffffff_46%,#f6f7f5_100%)] text-neutral-950">
      <header className="no-print border-b border-neutral-200 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-3 px-4 py-5 md:flex-row md:items-end md:justify-between md:px-6">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-teal-800">
              Strategy Consulting × TV Station × Local Creation
            </p>
            <h1 className="mt-2 text-2xl font-black tracking-normal text-neutral-950">
              企業版ふるさと納税 PR提案生成ツール
            </h1>
          </div>
          <p className="max-w-xl text-sm leading-6 text-neutral-600">
            広告営業、テレビ局営業、自治体営業、PR担当のための提案作成ワークスペース
          </p>
        </div>
      </header>

      <ProposalGenerator />
    </main>
  );
}
