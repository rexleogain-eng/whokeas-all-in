import type { Metadata } from "next";

import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
} from "../../lib/seo";

export const metadata: Metadata = {
  title: "Shop Products Online",
  description:
    `Browse technology, home, fashion, study, beauty and lifestyle products from ${SITE_NAME}.`,
  alternates: {
    canonical: `${SITE_URL}/products`,
  },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/products`,
    siteName: SITE_NAME,
    title: `Shop Products Online | ${SITE_NAME}`,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function ProductsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}