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
    .replace(/\bforeign\s+trade\s+explosion\s*(?:--?|[-–—:])?\s*/gi, "")
    .replace(/\b(?:note\s*:\s*)?MOQ\s*(?:is|[:=])?\s*\d+(?:\s*(?:pieces?|pcs?))?\b[.;,]?/gi, "")
    .replace(/\s+/g, " ")
    .replace(/^[,;:\-–—\s]+|[,;:\-–—\s]+$/g, "")
    .trim();
}

function formatCapacity(amount: string) {
  return `${Number(amount).toLocaleString("en-US")}mAh`;
}

function formatPieceCount(count: string) {
  const amount = Number(count);
  return `${amount.toLocaleString("en-US")} ${amount === 1 ? "piece" : "pieces"}`;
}

function normalizeIPhoneModels(value: string) {
  return value
    .replace(/iphone/gi, "iPhone")
    .replace(/\biPhone\s*XS\s*MAX\b/gi, "iPhone XS Max")
    .replace(/\biPhone\s*X\s*\/\s*XS\b/gi, "iPhone X/XS")
    .replace(/\biPhone\s*XR\b/gi, "iPhone XR")
    .replace(
      /\biPhone\s*(\d{1,2})\s*(pro\s*max|promax|pro|max|plus)?\b/gi,
      (_, generation: string, suffix?: string) => {
        const normalizedSuffix = String(suffix || "")
          .replace(/\s+/g, "")
          .toLowerCase();
        const label =
          normalizedSuffix === "promax"
            ? " Pro Max"
            : normalizedSuffix === "pro"
              ? " Pro"
              : normalizedSuffix === "max"
                ? " Max"
                : normalizedSuffix === "plus"
                  ? " Plus"
                  : "";
        return `iPhone ${generation}${label}`;
      },
    );
}

function formatIncludedBlock(value: string) {
  const source = cleanInline(value);
  const items: string[] = [];
  const pattern = /(.+?)\s*[x×*]\s*(\d+)\s*pcs?\b/gi;

  for (const match of source.matchAll(pattern)) {
    const item = cleanInline(match[1]);
    const count = match[2];
    if (item && count) {
      items.push(`Included: ${formatPieceCount(count)} · ${item}`);
    }
  }

  if (items.length > 0) return items.join("\n");

  const countFirst = source.match(/^(\d+)\s*pcs?\s*[x×*]?\s*(.+)$/i);
  if (countFirst) {
    return `Included: ${formatPieceCount(countFirst[1])} · ${cleanInline(countFirst[2])}`;
  }

  return source ? `Included: ${source}` : "";
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
    tpu: "TPU",
    pvc: "PVC",
    eva: "EVA",
    ios: "iOS",
    xl: "XL",
    xxl: "XXL",
  };
  const connectors = new Set(["and", "with", "for", "of"]);

  return value
    .split(/(\s+|·)/)
    .map((part) => {
      const lower = part.toLowerCase();
      if (keep[lower]) return keep[lower];
      if (connectors.has(lower)) return lower;
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
    .replace(/\b(\d{4,6})\s*m\s*ah\b/gi, (_, amount: string) => formatCapacity(amount))
    .replace(/\b(\d+(?:\.\d+)?)\s*w\b/gi, "$1W")
    .replace(/\b(\d+(?:\.\d+)?)\s*v\b/gi, "$1V")
    .replace(/\s+(?=(?:\d{1,3}(?:,\d{3})?mAh|USB(?:-C)?|PD\b|Qi\b|US\s+Plug\b|UK\s+Plug\b|EU\s+Plug\b|AU\s+Plug\b))/gi, " · ")
    .replace(/\s*·\s*/g, " · ")
    .replace(/(?:\s*·\s*){2,}/g, " · ")
    .trim();

  if (!variant) return "Standard option";

  return normalizeIPhoneModels(titleCaseOption(variant));
}

export function storefrontProductDetails(value: unknown) {
  let source = decodeBasicEntities(String(value || ""))
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(?:p|div|li|ul|ol|h[1-6])>/gi, "\n")
    .replace(/<li[^>]*>/gi, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\r/g, "")
    .replace(/[：]/g, ":")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();

  const compactSource = source.replace(/\s+/g, " ").trim();
  if (
    /^PHOERA-New\s+24ML\s+makeup\s+lotion\b/i.test(compactSource) &&
    /\bFeatures:\s*isolation\s+moisturizing\b/i.test(compactSource)
  ) {
    return "A lightweight moisturizing makeup primer selected to help create a smooth base for everyday makeup.";
  }

  const supplierSpecLabels = source.match(
    /\b(?:model|product\s+name|product\s+list|list|clamping\s+range|product\s+angle|weight|transmission\s+range|transmission\s+distance|chip\s+type|battery\s+life|standby\s+time|bluetooth\s+version|impedance|rated\s+input|speaker\s+size|frequency\s+response|functions?|material|usage|design|included)\s*:/gi,
  ) || [];

  if (supplierSpecLabels.length >= 3) return "";

  // Numbered marketplace feature/overview blocks are supplier copy, not
  // polished customer-facing details. Suppress them rather than publishing
  // awkward claims or translation artefacts verbatim.
  if (
    (/\boverview\s*:?\s*1\s*[.、:【]/i.test(source) &&
      /(?:\b2\s*[.、:【]|\b3\s*[.、:【])/i.test(source)) ||
    (/(?:^|\s)1\s*【[^】]{2,80}】/.test(source) &&
      /(?:^|\s)2\s*【[^】]{2,80}】/.test(source))
  ) {
    return "";
  }

  source = source
    .replace(/\bCJ\s*dropshipping\b/gi, "")
    .replace(/\bdropshipping\b/gi, "")
    .replace(/\bwholesale\b/gi, "")
    .replace(/\bforeign\s+trade\s+explosion\s*(?:--?|[-–—:])?\s*/gi, "")
    .replace(/\b(?:note\s*:\s*)?MOQ\s*(?:is|[:=])?\s*\d+(?:\s*(?:pieces?|pcs?))?\b[.;,]?/gi, "")
    .replace(/^available\s+ship\s+to:\s*(?:puerto\s+rico\s*,?\s*)?united\s+states\s*/i, "")
    .replace(/^(?:product\s+(?:information|description)|specifications?)\s*:?\s*$/gim, "")
    .replace(/\bproduct\s+(?:information|description)\s*:\s*/gi, "")
    .replace(/\bApplicable\s+Models?\s*:/gi, "Compatibility:")
    .replace(/\bStyle\s*:/gi, "Design:")
    .replace(/\bFunction\s*:/gi, "Features:")
    .replace(/\bProcess\s*:/gi, "Finish:")
    .replace(
      /\b(\d{4,6})mAh large capacity,\s*once fully charged,\s*can warm for\s*(\d+)\s*hours?\.\s*It also belongs to the power bank,\s*Type\s*c-USB\b/gi,
      (_, amount: string, hours: string) =>
        `\nBattery: ${formatCapacity(amount)}\nHeating time: Up to ${hours} hours per full charge\nInterface: USB-C / USB`,
    )
    .replace(/\bType\s*C\s*-\s*USB\b/gi, "USB-C / USB")
    .replace(/\bPC\s*\+\s*ABS\b/gi, "PC + ABS")
    .replace(/\bFlame\s+retardant\b/gi, "Flame-retardant")
    .replace(/\b(\d{4,6})\s*m\s*ah\b/gi, (_, amount: string) => formatCapacity(amount))
    .replace(/\b(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*cm\b/gi, "$1 × $2 × $3 cm")
    .replace(/\s+(?=(?:Power supply|Rated voltage|Color|Colour|Capacity|Size|Dimensions|Material|Input|Output|Interface|Charging|Weight|Battery|Heating time|Design|Compatibility|Features|Finish|Note|Packing list|Package includes|Package content)\s*:)/gi, "\n")
    .replace(/\bPacking list\s*:/gi, "Included:")
    .replace(/\bPackage includes\s*:/gi, "Included:")
    .replace(/\bPackage content\s*:/gi, "Included:")
    .replace(/Included:\s*([^\n]+)/gi, (_, items: string) => formatIncludedBlock(items))
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const lines = source
    .split("\n")
    .map((line) => line.trim().replace(/^[•\-–—]+\s*/, ""))
    .filter(Boolean)
    .map((line) => {
      let cleaned = line
        .replace(/\b[x×]\s*(\d+)\s*pcs?\b/gi, (_, count: string) => formatPieceCount(count))
        .replace(/\b(\d+)\s*pcs?\b/gi, (_, count: string) => formatPieceCount(count))
        .replace(/\s*·\s*/g, " · ")
        .replace(/(?:\s*·\s*){2,}/g, " · ")
        .replace(/^\s*·\s*|\s*·\s*$/g, "")
        .trim();

      const colorMatch = cleaned.match(/^(Color|Colour):\s*(.+)$/i);
      if (colorMatch) {
        const colors = colorMatch[2]
          .split(",")
          .map((color) => titleCaseOption(color.trim()))
          .join(", ");
        cleaned = `Color: ${colors}`;
      }

      const materialMatch = cleaned.match(/^Material:\s*(.+)$/i);
      if (materialMatch) {
        cleaned = `Material: ${titleCaseOption(materialMatch[1])}`;
      }

      const compatibilityMatch = cleaned.match(/^Compatibility:\s*(.+)$/i);
      if (compatibilityMatch) {
        cleaned = `Compatibility: ${normalizeIPhoneModels(compatibilityMatch[1])}`;
      }

      if (/^Note:/i.test(cleaned)) {
        cleaned = normalizeIPhoneModels(cleaned);
      }

      cleaned = cleaned.replace(/^Design:\s*rear cover type$/i, "Design: Rear-cover case");

      return cleaned;
    })
    .filter(Boolean);

  const seen = new Set<string>();
  return lines
    .filter((line) => {
      const key = line.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join("\n");
}
