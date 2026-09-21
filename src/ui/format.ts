/** Integers stay exact (xp, prices, levels); a derived stat like `1.8` damage gets one decimal
 *  rather than a float's full tail. */
export const formatStat = (value: number): string =>
  (Number.isInteger(value) ? String(value) : value.toFixed(1));

/** `null` is the cap or the top of the ladder refusing the purchase, not a price of zero. */
export const formatPrice = (price: number | null): string => (price === null ? '—' : String(price));

/** Level 0 has no title — the sim says so with an empty string, which is not a label. */
export const formatTitle = (title: string): string => (title === '' ? 'new hire' : title);
