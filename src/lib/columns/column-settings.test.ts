import { describe, expect, it } from 'vitest';
import {
  compareSerials,
  formatDateCompact,
  DEFAULT_LISTING_COLUMNS_DEF,
  DEFAULT_CONTACT_COLUMNS_DEF,
} from './column-settings';

describe('compareSerials', () => {
  it('sorts serial numbers naturally (P-1, P-2, P-10, P-100, P-1381) in ascending order', () => {
    const raw = ['P-10', 'P-1', 'P-100', 'P-2', 'P-1381', 'P-25', 'P-3'];
    const sorted = [...raw].sort((a, b) => compareSerials(a, b, 'asc'));
    expect(sorted).toEqual(['P-1', 'P-2', 'P-3', 'P-10', 'P-25', 'P-100', 'P-1381']);
  });

  it('sorts serial numbers in reverse (descending order)', () => {
    const raw = ['P-1', 'P-2', 'P-10', 'P-100'];
    const sorted = [...raw].sort((a, b) => compareSerials(a, b, 'desc'));
    expect(sorted).toEqual(['P-100', 'P-10', 'P-2', 'P-1']);
  });

  it('handles purely numeric serial numbers naturally', () => {
    const raw = ['10', '1', '2', '20', '3'];
    const sorted = [...raw].sort((a, b) => compareSerials(a, b, 'asc'));
    expect(sorted).toEqual(['1', '2', '3', '10', '20']);
  });

  it('places empty or null serial numbers at the bottom', () => {
    const raw = ['P-2', null, '', 'P-1', undefined];
    const sorted = [...raw].sort((a, b) => compareSerials(a, b, 'asc'));
    expect(sorted.slice(0, 2)).toEqual(['P-1', 'P-2']);
    expect(sorted.slice(2)).toContain(null);
    expect(sorted.slice(2)).toContain('');
    expect(sorted.slice(2)).toContain(undefined);
  });
});

describe('column definitions', () => {
  it('marks serial_no as required in both listings and contacts to ensure permanence', () => {
    const listingSerial = DEFAULT_LISTING_COLUMNS_DEF.find((c) => c.id === 'serial_no');
    const contactSerial = DEFAULT_CONTACT_COLUMNS_DEF.find((c) => c.id === 'serial_no');

    expect(listingSerial?.required).toBe(true);
    expect(contactSerial?.required).toBe(true);
  });
});

describe('formatDateCompact', () => {
  it('formats dates into compact readable strings', () => {
    const formatted = formatDateCompact('2026-09-30T12:00:00Z');
    expect(formatted).toMatch(/30\s+Sept?\s+2026/i);
  });
});

