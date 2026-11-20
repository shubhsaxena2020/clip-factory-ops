import type { Metadata, Viewport } from "next";
import { Big_Shoulders, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const shoulders = Big_Shoulders({ subsets: ["latin"], axes: ["opsz"], variable: "--font-shoulders", display: "swap" });
const jet = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jet", display: "swap" });

export const metadata: Metadata = {
  title: "Clip Factory Ops",
  description: "Operator console for the GTA 6 clip pipeline",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#0d0b0a", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${shoulders.variable} ${jet.variable}`}>
      <body>{children}</body>
    </html>
  );
}
