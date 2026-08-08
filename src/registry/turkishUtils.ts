/**
 * Normalizes a Turkish string by converting to lowercase and stripping Turkish diacritics.
 * Allows accent-insensitive and case-insensitive matching (e.g., 'sifre' matches 'Şifre', 'sayac' matches 'Metin Sayacı').
 */
export function normalizeTurkishText(text: string): string {
  if (!text) return '';

  return text
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .trim();
}

/**
 * Checks if a haystack matches a search query using Turkish normalization.
 */
export function matchesTurkishQuery(haystack: string, query: string): boolean {
  if (!query) return true;
  if (!haystack) return false;

  const normalizedHaystack = normalizeTurkishText(haystack);
  const normalizedQuery = normalizeTurkishText(query);

  return normalizedHaystack.includes(normalizedQuery);
}
