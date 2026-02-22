export function digitsOnly(input: string): string {
  return (input || '').replace(/\D/g, '');
}

export function isValidPhone(input: string): boolean {
  const d = digitsOnly(input);
  return /^0\d{10}$/.test(d) || /^98\d{10}$/.test(d);
}

/**
 * Normalize phone for backend (returns `98XXXXXXXXXX` when possible)
 */
export function normalizeTo98(input: string): string {
  const d = digitsOnly(input);
  if (/^0\d{10}$/.test(d)) return '98' + d.slice(1);
  if (/^98\d{10}$/.test(d)) return d;
  return d;
}

export default { digitsOnly, isValidPhone, normalizeTo98 };
