export type Discount = { amountSaved: number; discountPercent: number };

/** amountSaved in rupees; discountPercent rounded to 1 decimal place. */
export function computeDiscount(mrp: number, salePrice: number): Discount {
  const amountSaved = Math.max(0, mrp - salePrice);
  const discountPercent = mrp > 0 ? Math.round((amountSaved / mrp) * 1000) / 10 : 0;
  return { amountSaved, discountPercent };
}
