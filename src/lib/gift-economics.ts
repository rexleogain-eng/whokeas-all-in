export const PROMOTIONAL_GIFT_SPEND_THRESHOLD_USD = 200;

/**
 * A complimentary WHOKEAS promotional gift is unlocked only when the
 * qualifying order subtotal is strictly greater than $200.
 */
export function qualifiesForPromotionalGift(orderSubtotalUsd: number) {
  const subtotal = Math.max(0, Number(orderSubtotalUsd) || 0);
  return subtotal > PROMOTIONAL_GIFT_SPEND_THRESHOLD_USD;
}
