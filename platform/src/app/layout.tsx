import type { Metadata } from "next";
import { Fraunces, Hanken_Grotesk } from "next/font/google";
import "./globals.css";

// WRI platform type pairing (00A design system):
//   Display — Fraunces, a warm "old-style" serif with optical sizing. Carries
//   the established / trustworthy / editorial-finance tone on headings.
//   Body/UI — Hanken Grotesk, a warm humanist grotesque: highly legible in
//   forms and dense views, friendlier than Inter. Together: distinctive + calm.
const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
  axes: ["opsz", "SOFT"],
});

const hanken = Hanken_Grotesk({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "WRI — Websites for Regulatory Industries",
  description:
    "Done-for-you, compliance-aware websites for SEC- and state-registered investment advisers.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${hanken.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="bg-background text-foreground min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}
