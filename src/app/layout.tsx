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
  title: "ResumeForge — Professional Resume Builder",
  description: "Build professional resumes with real-time preview, PDF/DOCX import with format preservation, multiple profiles, and PDF export.",
  keywords: ["resume", "builder", "PDF", "CV", "career", "resume builder", "resume forge"],
  authors: [{ name: "ResumeForge" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "ResumeForge — Professional Resume Builder",
    description: "Build stunning resumes with real-time preview and format-preserving import",
    url: "https://github.com/Pratham2511/Resumer_builder",
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
