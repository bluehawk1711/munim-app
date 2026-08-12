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

const appUrl = process.env.NEXT_PUBLIC_APP_URL

export const metadata: Metadata = {
  title: {
    default: "Munim — Shop Management",
    template: "%s · Munim",
  },
  description:
    "Munim is a unified shop management suite for stock, sales, billing, khata (party advances), job letters, and reports — on web, desktop, and mobile over one shared database.",
  keywords: [
    "shop management",
    "inventory management",
    "stock management",
    "billing software",
    "invoice generator",
    "khata book",
    "advance tracking",
    "jewellery billing",
    "POS",
    "point of sale",
    "reports",
    "Munim",
  ],
  authors: [{ name: "Munim" }],
  applicationName: "Munim",
  category: "Business",
  ...(appUrl ? { metadataBase: new URL(appUrl) } : {}),
  openGraph: {
    type: "website",
    siteName: "Munim",
    title: "Munim — Shop Management",
    description:
      "Stock, billing, khata, and reports in one place — web, desktop, and mobile on a single shared database.",
    images: [{ url: "/logo.svg", alt: "Munim logo" }],
  },
  twitter: {
    card: "summary",
    title: "Munim — Shop Management",
    description:
      "Stock, billing, khata, and reports in one place — web, desktop, and mobile on a single shared database.",
    images: ["/logo.svg"],
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "/logo.svg",
  },
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
