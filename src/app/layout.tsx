import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ResumeForge — Resume Builder",
  description: "Build professional resumes with real-time preview, multiple profiles, and PDF export.",
  keywords: ["resume", "builder", "PDF", "CV", "career"],
  authors: [{ name: "ResumeForge" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "ResumeForge",
    description: "Professional resume builder with live preview",
    url: "https://chat.z.ai",
    siteName: "ResumeForge",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ResumeForge",
    description: "Professional resume builder with live preview",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
