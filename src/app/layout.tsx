import type { Metadata } from "next";
import "./globals.css";
import localFont from "next/font/local";

const inter = localFont({
  src: "../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
  weight: "100 900",
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "SiteAudit AI — AI-Powered Marketing Website Analyzer",
  description:
    "Paste any URL and get a deep AI-generated marketing audit with scores, insights, and prioritized fix plans. Grounded in live page evidence and reviewed by Gemini AI specialists.",
  openGraph: {
    title: "SiteAudit AI — AI-Powered Marketing Website Analyzer",
    description:
      "Understand your website and make your next move with an evidence-based AI marketing review.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} antialiased`}>
      <body>{children}</body>
    </html>
  );
}
