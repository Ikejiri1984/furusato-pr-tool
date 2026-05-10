import type { Metadata } from "next";
import { Noto_Sans_JP } from "next/font/google";
import type { ReactNode } from "react";

import "@/app/globals.css";

const notoSansJp = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  display: "swap"
});

export const metadata: Metadata = {
  title: "企業版ふるさと納税 PR提案生成ツール",
  description:
    "広告営業、テレビ局営業、自治体営業向けの企業版ふるさと納税 × PR提案生成ツール"
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={notoSansJp.className}>{children}</body>
    </html>
  );
}
