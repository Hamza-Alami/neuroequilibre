const formatter = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

/** "12 500 DH" — narrow no-break spaces are swapped for regular ones so PDFs render them. */
export function formatMoney(amount: number, currency: string) {
  const value = formatter.format(Math.round(amount * 100) / 100).replace(/\u202f/g, '\u00a0');
  return currency ? `${value}\u00a0${currency}` : value;
}

/** Parse a user-typed amount ("1 500,50", "1500.5"). Returns NaN when invalid. */
export function parseAmount(input: string) {
  const cleaned = input.replace(/[\s\u00a0\u202f]/g, '').replace(',', '.');
  if (!cleaned) return NaN;
  return /^\d+(\.\d{1,2})?$/.test(cleaned) ? Number(cleaned) : NaN;
}
