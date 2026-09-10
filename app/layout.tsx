import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Folio｜見積・請求・領収",
  description: "見積から領収まで。スマホでつながる、日々の仕事。",
  manifest: "/manifest.json",
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
    <html lang="ja">
      <body className="antialiased">{children}</body>
    </html>
  );
}
