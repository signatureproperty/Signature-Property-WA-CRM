import fs from 'fs';
import path from 'path';
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

  it('parses Google Sheet export with title row at top', () => {
    const csv = `Signature Property,,,,,,,,,,,,,,,
Sr No,Date,Number,City,Area,Address,Property Type,Size,Storey,Utilities,Status,Potential Rent,Front,Length,Demand,Documents
P-1,24-Dec-25,3278572797,Lahore,Samanabad,Pakki thatti near Chirag Market,Old House,7.5 Marla,"""""",,Available,,,,2.2 Cr,Registry Inteqal
P-2,24-Dec-25,3316108450,Lahore,Bahria Town,"Madina Heights 2 Plaza, Bahria town",Basement,5 Marla,"""""",,Available,,,,1.5 Cr,Transfer`;

    const result = parseListingCsv(csv);
    expect(result.hasRecognizedColumns).toBe(true);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].serial_no).toBe('P-1');
    expect(result.rows[0].contact_number).toBe('+923278572797');
    expect(result.rows[0].city).toBe('Lahore');
    expect(result.rows[0].area).toBe('Samanabad');
    expect(result.rows[0].demand_price).toBe('2.2 Cr');
    expect(result.rows[0].documents).toBe('Registry Inteqal');
    expect(result.rows[0].created_at).toBeDefined();

    expect(result.rows[1].serial_no).toBe('P-2');
    expect(result.rows[1].demand_price).toBe('1.5 Cr');
  });

  it('successfully parses the full user uploaded Google Sheet file (media_1794061538002_819377ad.csv)', () => {
    const filePath = 'C:/Users/USMAN SAGHEER/.gemini/antigravity/brain/92215b94-c6b2-452c-8ebe-b9709d9a1287/.user_uploaded/media_1794061538002_819377ad.csv';
    if (!fs.existsSync(filePath)) return;
    const content = fs.readFileSync(filePath, 'utf8');
    const result = parseListingCsv(content);

    expect(result.hasRecognizedColumns).toBe(true);
    expect(result.rows.length).toBeGreaterThan(1300);
    expect(result.rows[0].serial_no).toBe('P-1');
    expect(result.rows[0].city).toBe('Lahore');
    expect(result.rows[0].area).toBe('Samanabad');
    expect(result.rows[0].contact_number).toBe('+923278572797');
    expect(result.rows[0].demand_price).toBe('2.2 Cr');
  });
});

