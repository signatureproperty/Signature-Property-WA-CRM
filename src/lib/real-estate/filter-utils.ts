/**
 * Filter utilities for real estate prices, sizes, and search.
 */

export interface RealEstateFilters {
  propertyType: string;
  city: string;
  area: string;
  status?: string; // mainly for listings ('all' | 'available' | 'sold')
  minPrice: string;
  maxPrice: string;
  minSize: string;
  maxSize: string;
  sizeUnit: string;
  tagIds: string[];
}

export const INITIAL_FILTERS: RealEstateFilters = {
  propertyType: 'all',
  city: 'all',
  area: '',
  status: 'all',
  minPrice: '',
  maxPrice: '',
  minSize: '',
  maxSize: '',
  sizeUnit: 'Marla',
  tagIds: [],
};

/**
 * Converts price text (e.g. "2.2 Cr", "80 Lac", "25,000,000", "50k") into numeric value.
 */
export function parsePriceToNumber(raw?: string | null): number | null {
  if (!raw) return null;
  const str = raw.trim().toLowerCase().replace(/,/g, '');

  // Check Crore / Cr
  const croreMatch = str.match(/^([\d.]+)\s*(cr|crore|crores)$/);
  if (croreMatch) {
    const val = parseFloat(croreMatch[1]);
    return isNaN(val) ? null : val * 10_000_000;
  }

  // Check Lac / Lakh / Lacs
  const lacMatch = str.match(/^([\d.]+)\s*(lac|lakh|lakhs|lacs)$/);
  if (lacMatch) {
    const val = parseFloat(lacMatch[1]);
    return isNaN(val) ? null : val * 100_000;
  }

  // Check K / Thousand
  const kMatch = str.match(/^([\d.]+)\s*(k|thousand)$/);
  if (kMatch) {
    const val = parseFloat(kMatch[1]);
    return isNaN(val) ? null : val * 1_000;
  }

  // Pure digits or decimal (e.g. 25000000 or 25000000.00)
  const numMatch = str.match(/^[\d.]+/);
  if (numMatch) {
    const val = parseFloat(numMatch[0]);
    return isNaN(val) ? null : val;
  }

  return null;
}

/**
 * Normalizes any size representation into Marla for fair cross-unit range comparison.
 * Standard conversions:
 * 1 Marla = 1 Marla
 * 1 Kanal = 20 Marla
 * 1 Acre = 160 Marla (8 Kanal)
 * 1 Maraba = 4000 Marla (25 Acre)
 * 1 Sq Ft = 1/225 Marla
 */
export function parseSizeToMarla(raw?: string | null): number | null {
  if (!raw) return null;
  const str = raw.trim().toLowerCase();
  const match = str.match(/^([\d.]+)\s*(.*)$/);
  if (!match) return null;

  const val = parseFloat(match[1]);
  if (isNaN(val)) return null;

  const unit = match[2].trim();
  if (unit.startsWith('kanal')) {
    return val * 20;
  }
  if (unit.startsWith('acre')) {
    return val * 160;
  }
  if (unit.startsWith('maraba')) {
    return val * 4000;
  }
  if (unit.includes('sq') || unit.includes('ft') || unit.includes('feet')) {
    return val / 225;
  }
  return val; // Assume Marla if unspecified or already Marla
}

/**
 * Checks if a size string (e.g. "7.5 Marla") falls within [minSize, maxSize] of a given target unit.
 */
export function isSizeInRange(
  itemSize: string | null | undefined,
  minSize: string,
  maxSize: string,
  targetUnit: string
): boolean {
  if (!minSize && !maxSize) return true;
  if (!itemSize) return false;

  const itemMarla = parseSizeToMarla(itemSize);
  if (itemMarla === null) return false;

  // Convert min and max to Marla according to targetUnit
  const minMarla = minSize.trim() ? parseSizeToMarla(`${minSize.trim()} ${targetUnit}`) : null;
  const maxMarla = maxSize.trim() ? parseSizeToMarla(`${maxSize.trim()} ${targetUnit}`) : null;

  if (minMarla !== null && itemMarla < minMarla) return false;
  if (maxMarla !== null && itemMarla > maxMarla) return false;

  return true;
}

/**
 * Checks if a price string (e.g. "2.2 Cr") falls within [minPrice, maxPrice].
 */
export function isPriceInRange(
  itemPrice: string | null | undefined,
  minPrice: string,
  maxPrice: string
): boolean {
  if (!minPrice && !maxPrice) return true;
  if (!itemPrice) return false;

  const itemNum = parsePriceToNumber(itemPrice);
  if (itemNum === null) return false;

  const minNum = minPrice.trim() ? parsePriceToNumber(minPrice.trim()) : null;
  const maxNum = maxPrice.trim() ? parsePriceToNumber(maxPrice.trim()) : null;

  if (minNum !== null && itemNum < minNum) return false;
  if (maxNum !== null && itemNum > maxNum) return false;

  return true;
}

/**
 * Counts how many filter fields are currently active.
 */
export function countActiveFilters(filters: RealEstateFilters): number {
  let count = 0;
  if (filters.propertyType && filters.propertyType !== 'all') count++;
  if (filters.city && filters.city !== 'all') count++;
  if (filters.area?.trim()) count++;
  if (filters.status && filters.status !== 'all') count++;
  if (filters.minPrice?.trim() || filters.maxPrice?.trim()) count++;
  if (filters.minSize?.trim() || filters.maxSize?.trim()) count++;
  if (filters.tagIds?.length > 0) count++;
  return count;
}

