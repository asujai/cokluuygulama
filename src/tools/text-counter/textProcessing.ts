/**
 * Utility functions for advanced Turkish-aware text processing,
 * formatting, cleaning, sorting, and CSV conversion.
 */

/**
 * Converts text to upper case with full Turkish locale support (i -> İ, ı -> I).
 */
export function toTurkishUpperCase(text: string): string {
  return text.toLocaleUpperCase('tr-TR');
}

/**
 * Converts text to lower case with full Turkish locale support (İ -> i, I -> ı).
 */
export function toTurkishLowerCase(text: string): string {
  return text.toLocaleLowerCase('tr-TR');
}

/**
 * Converts text to Title Case (Capitalizes first letter of each word) using Turkish locale.
 */
export function toTurkishTitleCase(text: string): string {
  if (!text) return '';
  const lower = text.toLocaleLowerCase('tr-TR');
  return lower.replace(/(?:^|\s)\S/g, (char) => char.toLocaleUpperCase('tr-TR'));
}

/**
 * Cleans excessive whitespace:
 * - Trims each line
 * - Replaces multiple internal spaces/tabs on a line with a single space
 * - Trims leading/trailing empty lines
 */
export function cleanWhitespace(text: string): string {
  if (!text) return '';
  const lines = text.split('\n');
  const cleanedLines = lines.map((line) => line.trim().replace(/[ \t]+/g, ' '));
  return cleanedLines.join('\n').trim();
}

/**
 * Removes duplicate lines while preserving the original order of first occurrence.
 */
export function removeDuplicateLines(text: string): string {
  if (!text) return '';
  const lines = text.split('\n');
  const seen = new Set<string>();
  const uniqueLines: string[] = [];

  for (const line of lines) {
    if (!seen.has(line)) {
      seen.add(line);
      uniqueLines.push(line);
    }
  }

  return uniqueLines.join('\n');
}

/**
 * Sorts lines according to Turkish alphabetical order.
 */
export function sortLinesTurkish(text: string, ascending = true): string {
  if (!text) return '';
  const lines = text.split('\n');
  lines.sort((a, b) => {
    const comparison = a.localeCompare(b, 'tr', { sensitivity: 'base' });
    return ascending ? comparison : -comparison;
  });
  return lines.join('\n');
}

/**
 * Reverses the entire text character by character (handles unicode surrogate pairs).
 */
export function reverseText(text: string): string {
  if (!text) return '';
  return Array.from(text).reverse().join('');
}

/**
 * Reverses the order of lines in the text.
 */
export function reverseLines(text: string): string {
  if (!text) return '';
  return text.split('\n').reverse().join('\n');
}

/**
 * Converts line-separated items into CSV format.
 * If lines contain spaces, tabs, or commas, wraps them in quotes.
 */
export function linesToCsv(text: string, delimiter = ','): string {
  if (!text) return '';
  const lines = text.split('\n');
  const csvItems = lines.map((line) => {
    const trimmed = line.trim();
    if (trimmed.includes(delimiter) || trimmed.includes('"') || trimmed.includes('\n')) {
      const escaped = trimmed.replace(/"/g, '""');
      return `"${escaped}"`;
    }
    return trimmed;
  });
  return csvItems.join(delimiter + ' ');
}

/**
 * Converts CSV formatted text (comma, semicolon or tab separated) into line-separated items.
 */
export function csvToLines(text: string): string {
  if (!text) return '';

  // Simple CSV parser handling quotes
  const result: string[] = [];
  let currentItem = '';
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (char === '"') {
      if (insideQuotes && text[i + 1] === '"') {
        currentItem += '"';
        i++; // skip escaped quote
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if ((char === ',' || char === ';' || char === '\t' || char === '\n') && !insideQuotes) {
      if (currentItem.trim() || char === '\n') {
        result.push(currentItem.trim());
        currentItem = '';
      }
    } else {
      currentItem += char;
    }
  }

  if (currentItem.trim()) {
    result.push(currentItem.trim());
  }

  return result.filter(Boolean).join('\n');
}
