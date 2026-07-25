import {
  BRAND_ALTERNATE_NAMES,
  BRAND_LOGO_URL,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
} from "../../lib/seo";

export default function SiteStructuredData() {
  const organizationId = `${SITE_URL}/#organization`;
  const websiteId = `${SITE_URL}/#website`;

  const data = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": organizationId,
      name: SITE_NAME,
      legalName: SITE_NAME,
      alternateName: BRAND_ALTERNATE_NAMES,
      url: `${SITE_URL}/`,
      description: SITE_DESCRIPTION,
      logo: {
        "@type": "ImageObject",
        url: BRAND_LOGO_URL,
        width: 512,
        height: 512,
      },
      brand: {
        "@type": "Brand",
        name: SITE_NAME,
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": websiteId,
      url: `${SITE_URL}/`,
      name: SITE_NAME,
      alternateName: BRAND_ALTERNATE_NAMES,
      description: SITE_DESCRIPTION,
      publisher: {
        "@id": organizationId,
      },
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${SITE_URL}/products?q={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    },
  ];

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}