import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { MotionConfig } from "motion/react";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Toaster } from "@munim/ui"
;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "StockPilot — Inventory & Sales Management",
  description:
    "A modern inventory and sales management system with real-time stock tracking, analytics, and one-click reporting.",
  keywords: [
    "inventory",
    "sales",
    "stock management",
    "POS",
    "analytics",
    "Next.js",
  ],
  authors: [{ name: "StockPilot" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Apply the stored color theme before first paint so a returning
            user never sees a flash of the default (apple) theme. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("munim.theme");if(t&&["apple","ocean","forest","rose","midnight"].indexOf(t)>-1){document.documentElement.setAttribute("data-theme",t)}}catch(e){}})();`,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <Providers>
          <MotionConfig reducedMotion="user">{children}</MotionConfig>
          <Toaster position="top-right" richColors closeButton />
        </Providers>
      </body>
    </html>
  );
}
