export const STORE_DISPLAY_CURRENCY = "USD";
export const STORE_DISPLAY_LOCALE = "en-US";

function configuredRate() {
  const parsed = Number(
    process.env.NEXT_PUBLIC_STORE_USD_TO_TZS_RATE || 2700,
  );

  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : 2700;
}

export const STORE_USD_TO_TZS_RATE = configuredRate();

export function roundStoreUsd(value: string | number) {
  const numeric = Number(value || 0);

  if (!Number.isFinite(numeric)) return 0;

  return Math.round((numeric + Number.EPSILON) * 100) / 100;
}

export function tzsToStoreUsd(value: string | number) {
  const numeric = Number(value || 0);

  if (!Number.isFinite(numeric)) return 0;

  return roundStoreUsd(numeric / STORE_USD_TO_TZS_RATE);
}

export function sourcePriceToStoreUsd(
  value: string | number,
  currency: string,
) {
  const code = String(currency || "").trim().toUpperCase();

  if (code === "USD") return roundStoreUsd(value);
  if (code === "TZS") return tzsToStoreUsd(value);

  return 0;
}

export function formatStorePrice(value: string | number) {
  const numeric = Number(value || 0);

  try {
    return new Intl.NumberFormat(STORE_DISPLAY_LOCALE, {
      style: "currency",
      currency: STORE_DISPLAY_CURRENCY,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number.isFinite(numeric) ? numeric : 0);
  }
  catch {
    return `USD ${(Number.isFinite(numeric) ? numeric : 0).toFixed(2)}`;
  }
}
