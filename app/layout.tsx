import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "day-by-day TOEIC",
  description: "매일 20문항씩 토익 단어와 문장을 간격 반복으로 외우는 앱.",
  manifest: "/manifest.json",
  // iOS 는 매니페스트의 name 이 아니라 apple-mobile-web-app-title 을 홈화면 이름으로 쓴다.
  appleWebApp: {
    capable: true,
    title: "토익 단어",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}
