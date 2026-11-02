/*
 * Montants en toutes lettres (orthographe traditionnelle) :
 * 1 580,50 → « mille cinq cent quatre-vingts dirhams et cinquante centimes ».
 */

const UNITS = [
  'zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
  'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize',
];
const TENS = ['', 'dix', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante'];

/** 0–99. `final` tells whether "quatre-vingt" ends the number (it then takes an s). */
function belowHundred(n: number, final: boolean): string {
  if (n < 17) return UNITS[n];
  if (n < 20) return `dix-${UNITS[n - 10]}`;
  if (n < 70) {
    const t = Math.floor(n / 10);
    const u = n % 10;
    if (u === 0) return TENS[t];
    return u === 1 ? `${TENS[t]} et un` : `${TENS[t]}-${UNITS[u]}`;
  }
  if (n < 80) return n === 71 ? 'soixante et onze' : `soixante-${belowHundred(n - 60, final)}`;
  if (n === 80) return final ? 'quatre-vingts' : 'quatre-vingt';
  return `quatre-vingt-${belowHundred(n - 80, final)}`;
}

/** 0–999. */
function belowThousand(n: number, final: boolean): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  if (h === 0) return belowHundred(rest, final);
  const hundreds = h === 1 ? 'cent' : `${UNITS[h]} cent${rest === 0 && final ? 's' : ''}`;
  return rest === 0 ? hundreds : `${hundreds} ${belowHundred(rest, final)}`;
}

export function integerToFrenchWords(value: number): string {
  const n = Math.floor(Math.abs(value));
  if (n === 0) return 'zéro';
  if (n >= 1e12) return String(n);
  const billions = Math.floor(n / 1e9);
  const millions = Math.floor((n % 1e9) / 1e6);
  const thousands = Math.floor((n % 1e6) / 1000);
  const rest = n % 1000;
  const parts: string[] = [];
  // "million" and "milliard" are nouns: they agree, and the number before them keeps its s.
  if (billions) parts.push(`${belowThousand(billions, true)} milliard${billions > 1 ? 's' : ''}`);
  if (millions) parts.push(`${belowThousand(millions, true)} million${millions > 1 ? 's' : ''}`);
  // "mille" is invariable and the number before it never takes an s.
  if (thousands) parts.push(thousands === 1 ? 'mille' : `${belowThousand(thousands, false)} mille`);
  if (rest) parts.push(belowThousand(rest, true));
  return parts.join(' ');
}

const CURRENCIES: Record<string, [string, string]> = {
  dh: ['dirham', 'dirhams'],
  dhs: ['dirham', 'dirhams'],
  mad: ['dirham', 'dirhams'],
  dirham: ['dirham', 'dirhams'],
  dirhams: ['dirham', 'dirhams'],
  '€': ['euro', 'euros'],
  eur: ['euro', 'euros'],
  euro: ['euro', 'euros'],
  euros: ['euro', 'euros'],
};

/** « mille deux cents dirhams et cinquante centimes ». Unknown currencies keep their label. */
export function amountToFrenchWords(amount: number, currency = 'DH') {
  const totalCents = Math.round(Math.abs(amount) * 100);
  const units = Math.floor(totalCents / 100);
  const cents = totalCents % 100;
  const [singular, plural] = CURRENCIES[currency.trim().toLowerCase()] ?? [currency.trim(), currency.trim()];
  const exactMillions = units >= 1e6 && units % 1e6 === 0;
  let text = `${integerToFrenchWords(units)}${exactMillions ? ' de' : ''} ${units > 1 ? plural : singular}`.trim();
  if (cents) text += ` et ${integerToFrenchWords(cents)} centime${cents > 1 ? 's' : ''}`;
  return text;
}
