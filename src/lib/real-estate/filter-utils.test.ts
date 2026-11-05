import { describe, it, expect } from 'vitest';
import {
  parsePriceToNumber,
  parseSizeToMarla,
  isPriceInRange,
  isSizeInRange,
  countActiveFilters,
  INITIAL_FILTERS,
} from './filter-utils';

describe('Real Estate Filter Utils', () => {
  it('parses Pakistani price strings correctly', () => {
    expect(parsePriceToNumber('2.2 Cr')).toBe(22_000_000);
    expect(parsePriceToNumber('80 Lac')).toBe(8_000_000);
    expect(parsePriceToNumber('50k')).toBe(50_000);
    expect(parsePriceToNumber('25,000,000')).toBe(25_000_000);
  });

  it('checks price range matching', () => {
    expect(isPriceInRange('2.2 Cr', '1 Cr', '3 Cr')).toBe(true);
    expect(isPriceInRange('80 Lac', '1 Cr', '3 Cr')).toBe(false);
    expect(isPriceInRange('80 Lac', '', '1 Cr')).toBe(true);
    expect(isPriceInRange('2.2 Cr', '2.5 Cr', '')).toBe(false);
  });

  it('parses real estate sizes into standard marla', () => {
    expect(parseSizeToMarla('5 Marla')).toBe(5);
    expect(parseSizeToMarla('1 Kanal')).toBe(20);
    expect(parseSizeToMarla('2 Kanal')).toBe(40);
    expect(parseSizeToMarla('1 Acre')).toBe(160);
    expect(parseSizeToMarla('450 Sq Ft')).toBe(2);
  });

  it('checks size range matching', () => {
    expect(isSizeInRange('7.5 Marla', '5', '10', 'Marla')).toBe(true);
    expect(isSizeInRange('1 Kanal', '10', '30', 'Marla')).toBe(true);
    expect(isSizeInRange('3 Marla', '5', '10', 'Marla')).toBe(false);
    expect(isSizeInRange('1 Kanal', '1', '2', 'Kanal')).toBe(true);
  });

  it('counts active filters correctly', () => {
    expect(countActiveFilters(INITIAL_FILTERS)).toBe(0);
    expect(
      countActiveFilters({
        ...INITIAL_FILTERS,
        propertyType: 'House',
        city: 'Lahore',
        minPrice: '1 Cr',
      })
    ).toBe(3);
  });
});

