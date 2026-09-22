import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import Nav from "@/components/Nav";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono-family", display: "swap" });

export const metadata: Metadata = {
  title: "Blackjack Tutor",
  description: "Learn basic strategy, study betting systems, practice at a realistic table.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f172a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body>
        <a href="#main" className="visually-hidden">Skip to content</a>
        <Nav />
        <main id="main" tabIndex={-1}>{children}</main>
      </body>
    </html>
  );
}
