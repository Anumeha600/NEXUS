import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Baloo_2 } from "next/font/google";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AmbientBackground from "@/components/AmbientBackground";
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
      <body className="min-h-full text-ink">
        <AmbientBackground />
        <div className="relative mx-auto flex min-h-full max-w-[1440px] flex-col px-3 py-3 sm:px-4 sm:py-4 lg:px-6 lg:py-6">
          <div
            aria-hidden="true"
            className="nav-scrim pointer-events-none fixed inset-x-0 top-0 z-30 h-28 backdrop-blur-md"
          />
          <Header />
          <div className="app-shell mt-4 flex flex-1 flex-col overflow-hidden rounded-[28px] sm:rounded-[32px]">
            <main className="flex flex-1 flex-col">{children}</main>
            <Footer />
          </div>
        </div>
      </body>
    </html>
  );
}
