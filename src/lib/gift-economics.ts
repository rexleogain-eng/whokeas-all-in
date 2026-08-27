export const PROMOTIONAL_GIFT_PROFIT_SHARE = 0.15;

function roundUsd(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateGiftEconomics(input: {
  sellingPriceUsd: number;
  landedCostUsd: number;
}) {
  const sellingPriceUsd = Math.max(0, Number(input.sellingPriceUsd) || 0);
  const landedCostUsd = Math.max(0, Number(input.landedCostUsd) || 0);
  const grossProfitUsd = Math.max(0, sellingPriceUsd - landedCostUsd);
  const maxGiftCostUsd = roundUsd(
    grossProfitUsd * PROMOTIONAL_GIFT_PROFIT_SHARE,
  );
  const profitAfterGiftUsd = roundUsd(grossProfitUsd - maxGiftCostUsd);

  return {
    sellingPriceUsd: roundUsd(sellingPriceUsd),
    landedCostUsd: roundUsd(landedCostUsd),
    grossProfitUsd: roundUsd(grossProfitUsd),
    maxGiftCostUsd,
    profitAfterGiftUsd,
  };
}

export function giftFitsProfitBudget(input: {
  sellingPriceUsd: number;
  landedCostUsd: number;
  giftCostUsd: number;
}) {
  const economics = calculateGiftEconomics(input);
  return Math.max(0, Number(input.giftCostUsd) || 0) <= economics.maxGiftCostUsd;
}
