import { describe, expect, it } from 'vitest';
import { parseListingCsv } from './parse-listing-csv';

describe('parseListingCsv', () => {
  it('parses Google Sheet format with tab or comma delimiters', () => {
    const csv = `Sr No\tDate\tNumber\tCity\tArea\tAddress\tProperty Type\tSize\tStorey\tUtilities\tStatus\tPotential Rent\tFront\tLength\tDemand\tDocuments
P-1\tDecember 24, 2025\t3278572797\tLahore\tSamanabad\tNear Chirag Market\tOld House\t7.5 Marla\t\t\tAvailable\t\t\t\t2.2 Cr\tRegistry Inteqal`;

    const result = parseListingCsv(csv);
    expect(result.hasRecognizedColumns).toBe(true);
    expect(result.rows).toHaveLength(1);

    const row = result.rows[0];
    expect(row.serial_no).toBe('P-1');
    expect(row.title).toBe('7.5 Marla Old House in Samanabad');
    expect(row.contact_number).toBe('+923278572797');
    expect(row.city).toBe('Lahore');
    expect(row.area).toBe('Samanabad');
    expect(row.property_type).toBe('Old House');
    expect(row.size).toBe('7.5 Marla');
    expect(row.demand_price).toBe('2.2 Cr');
    expect(row.documents).toBe('Registry Inteqal');
    expect(row.status).toBe('available');
    expect(row.tags).toEqual(['Lahore', 'Samanabad', 'Old House']);
  });

  it('auto-generates L-1 serial number and title if missing', () => {
    const csv = `Property Type,Size,City,Area,Demand,Status
House,5 Marla,Lahore,Harbanspura,1.4 Cr,Sold`;

    const result = parseListingCsv(csv, 0);
    expect(result.rows).toHaveLength(1);
    const row = result.rows[0];
    expect(row.serial_no).toBe('L-1');
    expect(row.title).toBe('5 Marla House in Harbanspura');
    expect(row.status).toBe('sold');
  });
});

