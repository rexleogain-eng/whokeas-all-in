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

  if (/power\s*bank/.test(lower) && /digital\s*display/.test(lower)) {
    return "Portable Digital Display Power Bank";
  }

  if (/car/.test(lower) && /wireless/.test(lower) && /fm\s*transmitter/.test(lower)) {
    return "Car Wireless FM Transmitter";
  }

  if (/hair\s*removal/.test(lower) && /spray/.test(lower)) {
    return "Gentle Hair Removal Spray";
  }

  if (/glitter/.test(lower) && /spray/.test(lower)) {
    return "Long-Lasting Hair & Body Glitter Spray";
  }

  if (/vitamin\s*e/.test(lower) && /(oil|skin)/.test(lower)) {
    return "Vitamin E Multi-Purpose Skin & Hair Oil";
  }

  if (/moisturi[sz]ing/.test(lower) && /spray/.test(lower)) {
    return "Refreshing Body & Hair Moisturizing Spray";
  }

  if (/hair\s*identifier/.test(lower)) {
    return "Facial Hair Identifier Spray & Razor Set";
  }

  const cleaned = trimRepeatedEdgePhrase(source);
  if (cleaned.length <= 76) return cleaned || "WHOKEAS Selection";
  return `${cleaned.slice(0, 73).trimEnd()}…`;
}

export function storefrontSummary(titleValue: unknown, summaryValue: unknown) {
  const title = normalize(titleValue).toLowerCase();

  if (/power\s*bank/.test(title)) {
    return "Portable backup power with a clear digital display, selected for everyday charging and travel.";
  }

  if (/fm\s*transmitter/.test(title)) {
    return "A compact in-car wireless audio accessory designed to make everyday driving more convenient.";
  }

  if (/hair\s*removal/.test(title)) {
    return "A convenient topical spray designed for straightforward at-home hair-removal routines. Follow the product directions before use.";
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

  const source = removeSupplierNoise(normalize(summaryValue))
    .replace(/^our\s+/i, "")
    .replace(/\b(supplied|fulfilled)\s+(through|by)\s+[^.]+\.?/gi, "")
    .trim();

  if (!source) return "A practical WHOKEAS selection chosen for value, availability and everyday use.";

  const firstSentence = source.match(/^(.{30,190}?[.!?])(?:\s|$)/)?.[1] || source;
  if (firstSentence.length <= 180) return firstSentence;
  return `${firstSentence.slice(0, 177).trimEnd()}…`;
}
