import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "데일리 CS",
  description: "면접 질문을 매일 공부하고 설명해 이해도를 기록하는 앱.",
  manifest: "/manifest.json",
  // iOS 는 매니페스트의 name 이 아니라 apple-mobile-web-app-title 을 홈화면 이름으로 쓴다.
  appleWebApp: {
    capable: true,
    title: "데일리 CS",
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
