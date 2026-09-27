import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Baloo_2 } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// A single weight, not an array: this Next.js/Turbopack version fails to
// resolve next/font/google requests with multiple weight entries
// ("next/font/google queries have exactly one entry"). 700 (bold) covers
// every place this font is actually used (headings, buttons).
const baloo = Baloo_2({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "700",
});

export const metadata: Metadata = {
  title: "NEXUS — Adaptive Physics Lab",
  description:
    "NEXUS is an adaptive Physics learning game that changes challenge difficulty and content based on how you perform. Learn Physics by experimenting.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${baloo.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-bg text-ink">{children}</body>
    </html>
  );
}
