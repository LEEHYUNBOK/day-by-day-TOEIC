import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "day-by-day TOEIC",
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
