/**
 * Smart Search Helper with Full Vietnamese Diacritics & Multi-word (Space) Support
 * Solves:
 * 1. Spacebar typing (dấu cách) never getting blocked or stripped.
 * 2. Multi-word search (e.g. "vỏ a78", "màn hình reno", "cáp vooc", "find x8 nắp lưng").
 * 3. Vietnamese accent-insensitive matching (e.g. "vo" matches "vỏ", "sac" matches "sạc").
 * 4. Cross-field matching (e.g. model + part name + customer name across fields).
 * 5. Flexible phone and code matching (handles spaces/dashes in phone or codes).
 */

/**
 * Strips Vietnamese diacritics / tones accurately.
 * Handles both NFC and NFD Unicode representations.
 */
export function removeVietnameseTones(str: string | undefined | null): string {
  if (!str) return '';
  let s = String(str).normalize('NFD');

  // Replace decomposed accent marks
  s = s.replace(/[\u0300-\u036f]/g, '');

  // Replace special Vietnamese characters
  s = s.replace(/[đĐ]/g, (m) => (m === 'đ' ? 'd' : 'D'));
  s = s.replace(/[\u02C6\u0306\u031B]/g, ''); // lingering modifiers

  // Normalization fallback
  return s.normalize('NFC').toLowerCase();
}

/**
 * Normalizes text for search comparison (lowercase, trimmed, collapsed whitespace)
 */
export function normalizeSearchString(str: string | undefined | null): string {
  if (!str) return '';
  return String(str).toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Performs a comprehensive, smart multi-word and tone-insensitive match.
 *
 * @param query The user's search query (can contain spaces, accents, or unaccented words)
 * @param targetFields Array or list of field strings to search within (e.g. ticketNumber, model, partName, phone...)
 * @returns boolean true if the target matches the search query
 */
export function matchesSmartSearch(
  query: string | undefined | null,
  targetFields: (string | number | undefined | null)[]
): boolean {
  if (!query) return true;
  const rawQuery = String(query).trim();
  if (!rawQuery) return true;

  // Prepare combined target text
  const validTargets = targetFields
    .filter((f) => f !== undefined && f !== null && f !== '')
    .map((f) => String(f));

  if (validTargets.length === 0) return false;

  const combinedRaw = validTargets.join(' ').toLowerCase();
  const combinedNorm = removeVietnameseTones(combinedRaw);
  const combinedNoSpace = combinedRaw.replace(/[\s\-_./\\#]/g, '');

  const queryLower = rawQuery.toLowerCase();
  const queryNorm = removeVietnameseTones(rawQuery);
  const queryNoSpace = queryLower.replace(/[\s\-_./\\#]/g, '');

  // 1. Direct exact or substring match (fastest path)
  if (combinedRaw.includes(queryLower) || combinedNorm.includes(queryNorm)) {
    return true;
  }

  // 2. Compact match (useful for phone numbers, codes with dashes/spaces e.g. "0901 234 567" vs "0901234567")
  if (queryNoSpace.length >= 3 && combinedNoSpace.includes(queryNoSpace)) {
    return true;
  }

  // 3. Multi-word (space-separated) matching:
  // When user types multiple words (e.g. "vỏ a78" or "màn reno 8"),
  // verify that EVERY word token is found in the combined target fields.
  const tokens = queryLower.split(/\s+/).filter(Boolean);
  if (tokens.length > 1) {
    const allTokensMatch = tokens.every((token) => {
      const tokenNorm = removeVietnameseTones(token);
      const tokenNoSpace = token.replace(/[\s\-_./\\#]/g, '');

      return (
        combinedRaw.includes(token) ||
        combinedNorm.includes(tokenNorm) ||
        (tokenNoSpace.length >= 3 && combinedNoSpace.includes(tokenNoSpace))
      );
    });

    if (allTokensMatch) {
      return true;
    }
  }

  return false;
}
