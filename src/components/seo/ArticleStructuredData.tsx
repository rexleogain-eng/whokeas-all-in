import { SITE_URL } from "@/lib/seo";

type ArticleStructuredDataProps = {
  title: string;
  description: string;
  path: string;
  datePublished: string;
  dateModified: string;
  imageUrl?: string | null;
};

export default function ArticleStructuredData({
  title,
  description,
  path,
  datePublished,
  dateModified,
  imageUrl,
}: ArticleStructuredDataProps) {
  const url = `${SITE_URL}${path}`;
  const schema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": url,
    },
    url,
    inLanguage: "en-US",
    datePublished,
    dateModified,
    author: {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "WHOKEAS ALL IN",
      url: SITE_URL,
    },
    publisher: {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "WHOKEAS ALL IN",
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/brand/search-logo.png`,
      },
    },
    ...(imageUrl ? { image: [imageUrl] } : {}),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(schema).replace(/</g, "\\u003c"),
      }}
    />
  );
}
