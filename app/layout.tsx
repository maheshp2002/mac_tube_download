import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LocalDrop — Download & convert locally",
  description: "A private, local-only media downloader and converter.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-theme="dark">
      <body>{children}</body>
    </html>
  );
}
