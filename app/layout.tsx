import type { Metadata } from "next";
import "./globals.css";
import "./decision-tools.css";
import "./studio.css";

export const metadata: Metadata = {
  title: "明策 MINGCE · 自然语言策略研究台",
  description:
    "把自然语言变成可检查的选股条件，用数据解释入选、排除与不确定性。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
