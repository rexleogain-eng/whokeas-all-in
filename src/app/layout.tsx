import type { Metadata } from "next";
import Script from "next/script";

import GrowthAttributionTracker from "../components/growth/GrowthAttributionTracker";
import SiteStructuredData from "../components/seo/SiteStructuredData";
import {
  DEFAULT_SOCIAL_IMAGE,
  FAVICON_URL,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
} from "../lib/seo";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  title: {
    default: "WHOKEAS ALL IN | U.S. Tech, Home, Fashion, Beauty & More",
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "WHOKEAS ALL IN",
    "WHOKEAS",
    "Whokeas Store",
    "U.S. online store",
    "tech essentials online",
    "home essentials online",
    "fashion essentials online",
    "beauty essentials online",
    "accessories online",
    "everyday essentials online",
  ],
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  alternates: {
    canonical: `${SITE_URL}/`,
  },
  icons: {
    icon: [
      {
        url: FAVICON_URL,
        type: "image/png",
        sizes: "512x512",
      },
      {
        url: "/favicon.ico",
        type: "image/x-icon",
        sizes: "64x64",
      },
    ],
    shortcut: FAVICON_URL,
    apple: "/apple-icon.png",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: `${SITE_URL}/`,
    siteName: SITE_NAME,
    title: "WHOKEAS ALL IN | U.S. Tech, Home, Fashion, Beauty & More",
    description: SITE_DESCRIPTION,
    images: [DEFAULT_SOCIAL_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "WHOKEAS ALL IN | U.S. Tech, Home, Fashion, Beauty & More",
    description: SITE_DESCRIPTION,
    images: [DEFAULT_SOCIAL_IMAGE],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
    other: process.env.BING_SITE_VERIFICATION
      ? {
          "msvalidate.01": process.env.BING_SITE_VERIFICATION,
        }
      : undefined,
  },
  category: "shopping",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-US" data-scroll-behavior="smooth">
      <body>
        <Script
          id="whokeas-google-tag-loader"
          src="https://www.googletagmanager.com/gtag/js?id=GT-TBWLPPMJ"
          strategy="afterInteractive"
        />
        <Script
          id="whokeas-google-tag-config"
          strategy="afterInteractive"
        >
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'GT-TBWLPPMJ');
          `}
        </Script>
        <SiteStructuredData />
        <GrowthAttributionTracker />
        {children}
      </body>
    </html>
  );
}
