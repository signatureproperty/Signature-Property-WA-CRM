import { describe, expect, it } from 'vitest';
import { parseContactCsv, parseTagCell } from './parse-contact-csv';

describe('parseTagCell', () => {
  it('splits comma-separated tags and trims whitespace', () => {
    expect(parseTagCell(' VIP , Lead ,  ')).toEqual(['VIP', 'Lead']);
  });

  it('splits semicolon-separated tags', () => {
    expect(parseTagCell('VIP; Lead; Customer')).toEqual([
      'VIP',
      'Lead',
      'Customer',
    ]);
  });

  it('de-dupes case-insensitively', () => {
    expect(parseTagCell('vip, VIP, Lead')).toEqual(['vip', 'Lead']);
  });

  it('returns empty for blank values', () => {
    expect(parseTagCell('')).toEqual([]);
    expect(parseTagCell(undefined)).toEqual([]);
  });
});

describe('parseContactCsv', () => {
  it('parses optional tags column', () => {
    const csv = `phone,name,tags
+15551234567,Alice,"VIP, Lead"
+15559876543,Bob,Customer`;

    expect(parseContactCsv(csv)).toEqual({
      hasPhoneColumn: true,
      hasTagsColumn: true,
      hasCompanyColumn: false,
      discoveredCustomColumns: [],
      headers: ['phone', 'name', 'tags'],
      rows: [
        {
          phone: '+15551234567',
          name: 'Alice',
          email: undefined,
          company: undefined,
          tagNames: ['VIP', 'Lead'],
          notes: undefined,
          customFieldValues: undefined,
        },
        {
          phone: '+15559876543',
          name: 'Bob',
          email: undefined,
          company: undefined,
          tagNames: ['Customer'],
          notes: undefined,
          customFieldValues: undefined,
        },
      ],
    });
  });

  it('keeps a row with an empty phone cell instead of dropping it silently', () => {
    const csv = `phone,name
+15551234567,Alice
,Bob`;

    const { rows } = parseContactCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[1].phone).toBe('');
    expect(rows[1].name).toBe('Bob');
  });

  it('returns empty tagNames when tags column is absent', () => {
    const csv = `phone,name
+15551234567,Alice`;

    const result = parseContactCsv(csv);
    expect(result.hasPhoneColumn).toBe(true);
    expect(result.hasTagsColumn).toBe(false);
    expect(result.rows[0].tagNames).toEqual([]);
    expect(result.headers).toEqual(['phone', 'name']);
  });

  it('parses Real Estate columns, normalizes phone, keeps tags clean and routes custom columns', () => {
    const csv = `Date,Number,Name,City,Area,Property Type,Size,Budget,Investor,Notes
"December 24, 2025",3278572797,Farooq,Lahore,Samanabad,House,7.5 Marla,2.2 Cr,Yes,Near Chirag Market`;

    const result = parseContactCsv(csv);
    expect(result.hasPhoneColumn).toBe(true);
    expect(result.hasTagsColumn).toBe(false);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].phone).toBe('+923278572797');
    expect(result.rows[0].name).toBe('Farooq');
    expect(result.rows[0].city).toBe('Lahore');
    expect(result.rows[0].area).toBe('Samanabad');
    expect(result.rows[0].property_type).toBe('House');
    expect(result.rows[0].size).toBe('7.5 Marla');
    expect(result.rows[0].budget).toBe('2.2 Cr');
    expect(result.rows[0].tagNames).toEqual([]);
    expect(result.rows[0].notes).toBe('Near Chirag Market');
    expect(result.rows[0].customFieldValues).toEqual({ Investor: 'Yes' });
    expect(result.discoveredCustomColumns.map((c) => c.name)).toEqual(['Investor']);
  });
});
