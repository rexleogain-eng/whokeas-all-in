function decodeBasicEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function cleanInline(value: unknown) {
  return decodeBasicEntities(String(value || ""))
    .replace(/<[^>]*>/g, " ")
    .replace(/[_|]+/g, " ")
    .replace(/\bCJ\s*dropshipping\b/gi, "")
    .replace(/\bdropshipping\b/gi, "")
    .replace(/\bwholesale\b/gi, "")
    .replace(/\s+/g, " ")
    .replace(/^[,;:\-–—\s]+|[,;:\-–—\s]+$/g, "")
    .trim();
}

function titleCaseOption(value: string) {
  const keep: Record<string, string> = {
    usb: "USB",
    "usb-c": "USB-C",
    "type-c": "USB-C",
    qi: "Qi",
    pd: "PD",
    led: "LED",
    rgb: "RGB",
    hd: "HD",
    hdmi: "HDMI",
    pc: "PC",
    abs: "ABS",
    pu: "PU",
    ios: "iOS",
    xl: "XL",
    xxl: "XXL",
  };

  return value
    .split(/(\s+|·)/)
    .map((part) => {
      const lower = part.toLowerCase();
      if (keep[lower]) return keep[lower];
      if (/^\d/.test(part) || /^\s+$/.test(part) || part === "·") return part;
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join("");
}

export function storefrontVariantName(productValue: unknown, variantValue: unknown) {
  const product = cleanInline(productValue);
  let variant = cleanInline(variantValue);

  if (!variant) return "Standard option";

  if (product && variant.toLowerCase().startsWith(product.toLowerCase())) {
    variant = variant.slice(product.length).trim();
  }

  variant = variant
    .replace(/^[-–—,:;\s]+/, "")
    .replace(/\btype\s*c\b/gi, "USB-C")
    .replace(/\b(\d{4,6})\s*m\s*ah\b/gi, (_, amount: string) =>
      `${Number(amount).toLocaleString("en-US")}mAh`,
    )
    .replace(/\b(\d+(?:\.\d+)?)\s*w\b/gi, "$1W")
    .replace(/\b(\d+(?:\.\d+)?)\s*v\b/gi, "$1V")
    .replace(/\s+(?=(?:\d{1,3}(?:,\d{3})?mAh|USB(?:-C)?|PD\b|Qi\b|US\s+Plug\b|UK\s+Plug\b|EU\s+Plug\b|AU\s+Plug\b))/gi, " · ")
    .replace(/\s*·\s*/g, " · ")
    .replace(/(?:\s*·\s*){2,}/g, " · ")
    .trim();

  if (!variant) return "Standard option";

  return titleCaseOption(variant);
}

export function storefrontProductDetails(value: unknown) {
  let source = decodeBasicEntities(String(value || ""))
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(?:p|div|li|ul|ol|h[1-6])>/gi, "\n")
    .replace(/<li[^>]*>/gi, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();

  source = source
    .replace(/\bCJ\s*dropshipping\b/gi, "")
    .replace(/\bdropshipping\b/gi, "")
    .replace(/\bwholesale\b/gi, "")
    .replace(/^product\s+(?:information|description)\s*:\s*/i, "")
    .replace(/\s+(?=(?:Power supply|Rated voltage|Voltage|Color|Colour|Capacity|Size|Dimensions|Material|Input|Output|Interface|Charging|Weight|Packing list|Package includes|Package content)\s*:)/gi, "\n")
    .replace(/\bPacking list\s*:/gi, "Included:")
    .replace(/\bPackage includes\s*:/gi, "Included:")
    .replace(/\bPackage content\s*:/gi, "Included:")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const lines = source
    .split("\n")
    .map((line) => line.trim().replace(/^[•\-–—]+\s*/, ""))
    .filter(Boolean);

  return lines.join("\n");
}
