const GTIN_LENGTHS = new Set([8, 12, 13, 14]);

function parseJsonObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  if (typeof value !== "string" || !value.trim()) return null;

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function gs1CheckDigitIsValid(digits: string) {
  if (!GTIN_LENGTHS.has(digits.length)) return false;

  const expected = Number(digits.at(-1));
  let sum = 0;
  let positionFromRight = 0;

  for (let index = digits.length - 2; index >= 0; index -= 1) {
    const digit = Number(digits[index]);
    sum += digit * (positionFromRight % 2 === 0 ? 3 : 1);
    positionFromRight += 1;
  }

  return (10 - (sum % 10)) % 10 === expected;
}

function googleRestrictedGtinRange(digits: string) {
  return digits.startsWith("02") || digits.startsWith("04") || digits.startsWith("2");
}

export function normalizeGtin(value: unknown) {
  const digits = String(value ?? "")
    .replace(/[\s-]+/g, "")
    .trim();

  if (!/^\d+$/.test(digits)) return null;
  if (!GTIN_LENGTHS.has(digits.length)) return null;
  if (googleRestrictedGtinRange(digits)) return null;
  if (!gs1CheckDigitIsValid(digits)) return null;

  return digits;
}

export type CJIdentifierVariant = {
  variantId: string | null;
  sku: string | null;
  gtin: string | null;
};

export type CJProductIdentifiers = {
  gtins: string[];
  primaryGtin: string | null;
  variants: CJIdentifierVariant[];
  updatedAt: string;
};

export function collectCJProductIdentifiers(
  variants: Array<{
    vid?: unknown;
    variantSku?: unknown;
    barcode?: unknown;
  }>,
): CJProductIdentifiers {
  const normalizedVariants = variants.map((variant) => ({
    variantId: String(variant.vid ?? "").trim() || null,
    sku: String(variant.variantSku ?? "").trim() || null,
    gtin: normalizeGtin(variant.barcode),
  }));
  const gtins = [...new Set(
    normalizedVariants
      .map((variant) => variant.gtin)
      .filter((value): value is string => Boolean(value)),
  )].slice(0, 10);

  return {
    gtins,
    primaryGtin: gtins.length === 1 ? gtins[0] : null,
    variants: normalizedVariants,
    updatedAt: new Date().toISOString(),
  };
}

function collectCandidateGtins(
  value: unknown,
  output: Set<string>,
  depth = 0,
) {
  if (depth > 7 || output.size >= 10 || value == null) return;

  if (Array.isArray(value)) {
    for (const item of value) collectCandidateGtins(item, output, depth + 1);
    return;
  }

  if (typeof value !== "object") return;

  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
    const identifierKey = [
      "gtin",
      "gtins",
      "gtin8",
      "gtin12",
      "gtin13",
      "gtin14",
      "barcode",
      "barcodes",
      "upc",
      "ean",
      "ean13",
    ].includes(normalizedKey);

    if (identifierKey) {
      const candidates = Array.isArray(nested) ? nested : [nested];
      for (const candidate of candidates) {
        const gtin = normalizeGtin(candidate);
        if (gtin) output.add(gtin);
      }
    }

    collectCandidateGtins(nested, output, depth + 1);
  }
}

export function supplierGtins(rawData: unknown) {
  const parsed = parseJsonObject(rawData);
  if (!parsed) return [];

  const gtins = new Set<string>();
  collectCandidateGtins(parsed, gtins);
  return [...gtins].slice(0, 10);
}

export function productLevelGtin(rawData: unknown) {
  const gtins = supplierGtins(rawData);
  return gtins.length === 1 ? gtins[0] : null;
}

export function verifiedMerchantBrand(value: unknown, retailerNames: string[] = []) {
  const brand = String(value ?? "").trim().slice(0, 70);
  if (!brand) return null;

  const normalized = brand.toLowerCase();
  if (
    retailerNames.some((retailerName) =>
      normalized === String(retailerName || "").trim().toLowerCase()
    )
  ) {
    return null;
  }

  return brand;
}
