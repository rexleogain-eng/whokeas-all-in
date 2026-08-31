function normalize(value: unknown) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/[_|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function removeSupplierNoise(value: string) {
  return value
    .replace(/\bCJ\s*dropshipping\b/gi, "")
    .replace(/\bdropshipping\b/gi, "")
    .replace(/\bwholesale\b/gi, "")
    .replace(/\bhot\s*sale\b/gi, "")
    .replace(/\bnew\s*arrival\b/gi, "")
    .replace(/\b202[0-9]\b/g, "")
    .replace(/\bforeign\s+trade\s+explosion\s*(?:--?|[-–—:])?\s*/gi, "")
    .replace(/\b(?:note\s*:\s*)?MOQ\s*(?:is|[:=])?\s*\d+(?:\s*(?:pieces?|pcs?))?\b[.;,]?/gi, "")
    .replace(/\bphysical\s+pictures?\s*,?\s*amazon\s*,?\s*cross[-\s]?border\s+business\s+opportunities?\b[^.!?]*/gi, "")
    .replace(/\bcross[-\s]?border\s+business\s+opportunities?\b[^.!?]*/gi, "")
    .replace(/\s+/g, " ")
    .replace(/^[,;:\-–—\s]+|[,;:\-–—\s]+$/g, "")
    .trim();
}

function trimRepeatedEdgePhrase(value: string) {
  const words = value.split(/\s+/).filter(Boolean);

  for (let size = Math.min(4, Math.floor(words.length / 2)); size >= 1; size -= 1) {
    const head = words.slice(0, size).join(" ").toLowerCase();
    const tail = words.slice(-size).join(" ").toLowerCase();

    if (head === tail && words.length > size * 2) {
      return words.slice(0, -size).join(" ");
    }
  }

  return value;
}

export function storefrontTitle(value: unknown) {
  const source = removeSupplierNoise(normalize(value));
  const lower = source.toLowerCase();

  if (/power\s*bank/.test(lower)) {
    if (/digital\s*display/.test(lower)) return "Portable Digital Display Power Bank";
    if (/hand\s*warmer/.test(lower) && /5000\s*mah/.test(lower)) return "5,000mAh Hand Warmer Power Bank";
    if (/solar/.test(lower) && /power\s*station/.test(lower)) return "Portable Solar Backup Power Station";
    if (/20000\s*mah/.test(lower)) return "20,000mAh Portable Power Bank";
    if (/10400\s*mah/.test(lower) && /(qi|wireless)/.test(lower)) return "10,400mAh Qi Wireless Power Bank";
    if (/(magsafe|magnetic)/.test(lower)) return "Magnetic Wireless Power Bank";
    if (/ultra[-\s]*thin/.test(lower) && /fast\s*charg/.test(lower)) return "Slim Fast-Charging Power Bank";
    return "Portable Power Bank";
  }

  if (/fm\s*transmitter/.test(lower)) {
    if (/fast\s*pd|pd\s*adapter/.test(lower)) return "Bluetooth FM Transmitter & Fast Car Charger";
    if (/hands[-\s]*free|remote\s*control|phone\s*stand/.test(lower)) return "Hands-Free FM Transmitter & Car Charger";
    if (/car\s*charger|usb\s*charger/.test(lower)) return "Bluetooth FM Transmitter & Car Charger";
    return "Wireless Car FM Transmitter";
  }

  if (/hair\s*removal/.test(lower) && /spray/.test(lower)) return "Gentle Hair Removal Spray";
  if (/hair\s*removal/.test(lower) && /cream/.test(lower)) return "Hair Removal Cream";
  if (/crystal/.test(lower) && /hair\s*(?:removal|eraser)/.test(lower)) return "Crystal Hair Eraser";
  if (/neck/.test(lower) && /face\s*massager/.test(lower)) return "Face & Neck Massager";
  if (/makeup\s*organizer/.test(lower) && /(rotat|spinn)/.test(lower)) return "Rotating Makeup Organizer";
  if (/makeup\s*train\s*case|cosmetic\s*organizer.*mirror/.test(lower)) return "Aluminum Makeup & Jewelry Case";
  if (/shoulder\s*bag/.test(lower) && /shiny/.test(lower)) return "Shiny Everyday Shoulder Bag";
  if (/shoulder\s*bag/.test(lower) && /(commute|leisure)/.test(lower)) return "Everyday Commuter Shoulder Bag";
  if (/shoulder\s*bag/.test(lower) && /(women|women's)/.test(lower)) return "Women's Everyday Shoulder Bag";
  if (/dish\s*drying\s*rack/.test(lower)) return "2-Tier Dish Drying Rack";
  if (/rolling\s*(?:utility\s*)?cart/.test(lower) && /3[-\s]*tier/.test(lower)) return "3-Tier Rolling Utility Cart";
  if (/shoe\s*rack/.test(lower) && /6[-\s]*tier/.test(lower)) return "6-Tier Foldable Shoe Rack";
  if (/portable/.test(lower) && /thermal\s*printer/.test(lower)) return "Portable Wireless Thermal Printer";
  if (/ceramic/.test(lower) && /hair\s*straightener/.test(lower)) return "Ceramic Hair Straightener";
  if (/glitter/.test(lower) && /spray/.test(lower)) return "Long-Lasting Hair & Body Glitter Spray";
  if (/vitamin\s*e/.test(lower) && /(oil|skin)/.test(lower)) return "Vitamin E Multi-Purpose Skin & Hair Oil";
  if (/moisturi[sz]ing/.test(lower) && /spray/.test(lower)) return "Refreshing Body & Hair Moisturizing Spray";
  if (/hair\s*identifier/.test(lower)) return "Facial Hair Identifier Spray & Razor Set";

  const cleaned = trimRepeatedEdgePhrase(source)
    .replace(/^compatible\s+with\s*[,;:\-–—\s]+/i, "")
    .replace(/^\d+\s*(?:pc|pcs|pack)\s+/i, "")
    .replace(/\s+(?:for|fit for)\s+(?:ios|iphone|android|galaxy)\b.*$/i, "")
    .trim();

  if (cleaned.length <= 68) return cleaned || "WHOKEAS Selection";
  return `${cleaned.slice(0, 65).trimEnd()}…`;
}

export function storefrontSummary(titleValue: unknown, summaryValue: unknown) {
  const title = normalize(titleValue).toLowerCase();

  if (/power\s*bank/.test(title) && /digital\s*display/.test(title)) {
    return "Portable backup power with a clear digital display, selected for everyday charging and travel.";
  }
  if (/power\s*bank/.test(title)) {
    return "Portable backup power selected for everyday charging, travel and on-the-go convenience.";
  }
  if (/fm\s*transmitter/.test(title)) {
    return "A compact in-car wireless audio accessory designed to make everyday driving more convenient.";
  }
  if (/phone\s*(?:case|cover)|mobile\s*phone\s*(?:case|shell)|protective\s*case/.test(title)) {
    return "A practical phone case selected for everyday protection and an easy-to-carry profile.";
  }
  if (/organizer|storage\s*(?:rack|drawer|shelf)|shoe\s*rack|utility\s*cart|dish\s*drying\s*rack/.test(title)) {
    return "A practical organization essential selected to make everyday storage and access simpler.";
  }
  if (/portable/.test(title) && /thermal\s*printer/.test(title)) {
    return "A compact wireless thermal printer selected for convenient everyday printing at home, work or on the go.";
  }
  if (/shoulder\s*bag|crossbody|tote\s*bag/.test(title)) {
    return "A practical everyday bag selected for commuting, errands and casual use, with an easy-to-carry profile.";
  }
  if (/hair\s*removal/.test(title)) {
    return "A convenient at-home grooming option. Follow the product directions and patch-test guidance before use.";
  }
  if (/brightening\s+repair\s+paste|gaoguang\s+eye\s+cream/.test(title)) {
    return "A compact cosmetic highlighting cream selected for everyday makeup and beauty routines.";
  }
  if (/glitter/.test(title) && /spray/.test(title)) {
    return "An easy-to-apply shimmer spray for adding a visible sparkle effect to hair or body for events and styling.";
  }
  if (/vitamin\s*e/.test(title) && /(oil|skin)/.test(title)) {
    return "A multi-purpose cosmetic oil for skin and hair care, selected for simple everyday moisturizing routines.";
  }
  if (/moisturi[sz]ing/.test(title) && /spray/.test(title)) {
    return "A lightweight body and hair mist designed for convenient everyday moisturizing and refreshment.";
  }
  if (/hair\s*identifier/.test(title)) {
    return "A facial-grooming set designed to make fine hairs easier to see before shaving or shaping.";
  }
  if (/silk\s+bonnet|satin\s+hair\s+bonnet/.test(title)) {
    return "A soft satin sleep bonnet selected to help protect hair overnight and reduce friction during sleep.";
  }

  const source = removeSupplierNoise(normalize(summaryValue))
    .replace(/^our\s+/i, "")
    .replace(/\b(supplied|fulfilled)\s+(through|by)\s+[^.]+\.?/gi, "")
    .replace(/^specification\s+(?:brand\s*:\s*.{1,80}?\s+)?available\s+ship\s+to:\s*(?:puerto\s+rico\s*,?\s*)?united\s+states\s+details\s+(?:product\s+)?description\s*/i, "")
    .replace(/^product\s+attributes:.*?estimated\s+shipping\s+time\s*:[^:]{0,80}?product\s+description:\s*/i, "")
    .replace(/^note\s*[:：]\s*only\s+(?:sold|sales?)\s+in\s+the\s+usa\s*\([^)]*\)\s*[,.;:\-–—]?\s*/i, "")
    .replace(/^available\s+ship\s+to:\s*united\s+states\s*/i, "")
    .replace(/^product\s+information:\s*/i, "")
    .trim();

  const specificationLabels = source.match(
    /\b(?:model|product\s+name|style|material|composition|pattern|color(?:\s+classification)?|colour|size|dimensions?|weight|clamping\s+range|applicable models?|specifications?|packing list|package includes?|list|transmission\s+range|transmission\s+distance|chip\s+type|battery\s+life|standby\s+time|bluetooth\s+version|impedance|rated\s+input|speaker\s+size|frequency\s+response|usage|design|included|main\s+fabric\s+component(?:\s*\d+)?|sleeve\s+length|version|collar\s+type)\s*:/gi,
  ) || [];

  const supplierCopyLabels = source.match(
    /\b(?:overview|features?|highlights?|fabric|composition|care\s+instructions?|net\s+weight|functions?|suggested\s+usage)\s*[:：]?/gi,
  ) || [];

  if (
    specificationLabels.length >= 2 ||
    supplierCopyLabels.length >= 2 ||
    /\boverview\s*:?[\s]*\d+\s*[.、:【〖]/i.test(source) ||
    /(?:^|\s)\d+\s*[.、:]?\s*[【〖][^】〗]{2,80}[】〗]/.test(source) ||
    /^\*{0,2}(?:overview|features?|highlights?)\*{0,2}\s*[:：]/i.test(source) ||
    /^(?:color\s+classification|colour\s+classification)\s*[:：]/i.test(source) ||
    /^note\s*[:：].*?(?:\boverview\b|\bcompatible\b|[【〖])/i.test(source)
  ) {
    const productName = storefrontTitle(titleValue);
    return `${productName} selected for everyday use, with clear USD pricing and U.S. delivery through WHOKEAS.`;
  }

  if (!source) return "A practical WHOKEAS selection chosen for value, availability and everyday use.";

  const firstSentence = source.match(/^(.{30,190}?[.!?])(?:\s|$)/)?.[1] || source;
  if (firstSentence.length <= 180) return firstSentence;
  return `${firstSentence.slice(0, 177).trimEnd()}…`;
}

type FocusProduct = {
  name?: unknown;
  price?: unknown;
  deliveryDays?: unknown;
  image?: unknown;
  featured?: unknown;
  shortDescription?: unknown;
};

export function storefrontFocusFamily(value: unknown) {
  const name = normalize(value).toLowerCase();
  if (/power\s*bank|battery\s*pack/.test(name)) return "power-bank";
  if (/fm\s*(?:transmitter|radio)/.test(name)) return "car-audio";
  if (/organizer|shoe\s*rack|dish\s*drying\s*rack|utility\s*cart/.test(name)) return "organization";
  if (/hair\s*removal|hair\s*straightener|face\s*massager|makeup|skin/.test(name)) return "beauty";
  if (/speaker|earbud|headphone|headset/.test(name)) return "audio";
  if (/wireless\s*charger|smart\s*plug|thermal\s*printer|translator/.test(name)) return "tech";
  if (/shoulder\s*bag|tote\s*bag|crossbody/.test(name)) return "other";
  return "other";
}

export function storefrontFocusScore(product: FocusProduct) {
  const name = normalize(product.name).toLowerCase();
  const price = Number(product.price || 0);
  const deliveryDays = Number(product.deliveryDays || 0);
  let score = 0;

  if (/power\s*bank|fm\s*transmitter/.test(name)) score += 9;
  if (/organizer|shoe\s*rack|dish\s*drying\s*rack|utility\s*cart/.test(name)) score += 6;
  if (/portable\s*(?:wireless\s*)?thermal\s*printer|car\s*vacuum|wireless\s*charger/.test(name)) score += 5;
  if (/hair\s*removal|makeup\s*organizer|hair\s*straightener|face\s*massager/.test(name)) score += 5;
  if (/speaker|open\s*ear|translator|smart\s*plug/.test(name)) score += 3;

  if (price >= 18 && price <= 40) score += 7;
  else if (price > 40 && price <= 70) score += 4;
  else if (price > 70 && price <= 100) score += 1;
  else if (price > 100) score -= 4;

  if (deliveryDays > 0 && deliveryDays <= 12) score += 8;
  else if (deliveryDays <= 16 && deliveryDays > 0) score += 5;
  else if (deliveryDays <= 21 && deliveryDays > 0) score += 2;
  else if (deliveryDays > 25) score -= 4;

  if (product.image) score += 3;
  if (product.featured) score += 2;
  if (normalize(product.shortDescription).length >= 60) score += 1;

  if (name.length > 110) score -= 4;
  if (/undefined|null|v4[.-]?[12]|\b5w\b/.test(name)) score -= 8;
  if (/^\d+\s*(?:pc|pcs|pack)\b/.test(name)) score -= 1;

  return score;
}