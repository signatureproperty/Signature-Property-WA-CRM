import { parseCsvLine, normalizePhoneForImport, type DiscoveredCustomColumn } from '@/lib/contacts/parse-contact-csv';

export interface ParsedListingRow {
  serial_no?: string;
  title: string;
  contact_number?: string;
  city?: string;
  area?: string;
  address?: string;
  property_type?: string;
  size?: string;
  storey?: string;
  front_dimension?: string;
  length_dimension?: string;
  demand_price?: string;
  potential_rent?: string;
  utilities?: string;
  documents?: string;
  status: 'available' | 'sold';
  description?: string;
  tags: string[];
  /** Dynamic unmapped custom fields (e.g. { 'Commission': '1%', 'Plot No': '142' }) */
  customFieldValues?: Record<string, string>;
}

export interface ParseListingCsvResult {
  rows: ParsedListingRow[];
  hasRecognizedColumns: boolean;
  discoveredCustomColumns: DiscoveredCustomColumn[];
}

function normalizeHeaderName(name: string): string {
  return name.trim().toLowerCase().replace(/["']/g, '').replace(/[_\s]+/g, ' ');
}

function findHeaderIndex(headers: string[], synonyms: string[]): number {
  return headers.findIndex((h) => synonyms.includes(normalizeHeaderName(h)));
}

/**
 * Parses a Real Estate Property Listings CSV or TSV file.
 * Automatically aligns with Google Sheet exports containing:
 * Sr No, Date, Number, City, Area, Address, Property Type, Size, Storey,
 * Utilities, Status, Potential Rent, Front, Length, Demand, Documents.
 */
export function parseListingCsv(text: string, currentListingCount = 0): ParseListingCsvResult {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) {
    return {
      rows: [],
      hasRecognizedColumns: false,
      discoveredCustomColumns: [],
    };
  }

  const delimiter = lines[0].includes('\t') ? '\t' : (lines[0].includes(';') && !lines[0].includes(',') ? ';' : ',');
  const rawHeaders = parseCsvLine(lines[0], delimiter).map((h) => h.replace(/["']/g, '').trim());
  const headers = rawHeaders.map(normalizeHeaderName);

  const serialIdx = findHeaderIndex(headers, ['sr no', 'sr. no', 'sr_no', 'serial', 'reference', 'ref', 'p no', 'id']);
  const dateIdx = findHeaderIndex(headers, ['date', 'listing date', 'created']);
  const numberIdx = findHeaderIndex(headers, ['number', 'phone', 'contact', 'mobile', 'owner number', 'phone number', 'cell', 'whatsapp']);
  const cityIdx = findHeaderIndex(headers, ['city']);
  const areaIdx = findHeaderIndex(headers, ['area', 'location', 'sector', 'phase']);
  const addressIdx = findHeaderIndex(headers, ['address', 'full address', 'street', 'location detail']);
  const typeIdx = findHeaderIndex(headers, ['property type', 'propertytype', 'type', 'category']);
  const sizeIdx = findHeaderIndex(headers, ['size', 'area size', 'plot size']);
  const storeyIdx = findHeaderIndex(headers, ['storey', 'story', 'floors', 'floor']);
  const utilitiesIdx = findHeaderIndex(headers, ['utilities', 'utility', 'facilities']);
  const statusIdx = findHeaderIndex(headers, ['status']);
  const rentIdx = findHeaderIndex(headers, ['potential rent', 'rent', 'rental']);
  const frontIdx = findHeaderIndex(headers, ['front', 'front dimension', 'width']);
  const lengthIdx = findHeaderIndex(headers, ['length', 'length dimension', 'depth']);
  const demandIdx = findHeaderIndex(headers, ['demand', 'demand price', 'price', 'rate', 'cost']);
  const docsIdx = findHeaderIndex(headers, ['documents', 'docs', 'legal', 'title deed']);
  const titleIdx = findHeaderIndex(headers, ['title', 'property title', 'name']);
  const descIdx = findHeaderIndex(headers, ['description', 'notes', 'remarks']);
  const tagsIdx = findHeaderIndex(headers, ['tags', 'tag']);

  // At least one recognizable real estate column must be present
  const hasRecognized =
    serialIdx >= 0 ||
    cityIdx >= 0 ||
    areaIdx >= 0 ||
    typeIdx >= 0 ||
    demandIdx >= 0 ||
    sizeIdx >= 0 ||
    numberIdx >= 0 ||
    titleIdx >= 0;

  if (!hasRecognized) {
    return {
      rows: [],
      hasRecognizedColumns: false,
      discoveredCustomColumns: [],
    };
  }

  // Any column not mapped to core table columns is a custom column
  const baseIndices = new Set(
    [
      serialIdx, dateIdx, numberIdx, cityIdx, areaIdx, addressIdx,
      typeIdx, sizeIdx, storeyIdx, utilitiesIdx, statusIdx, rentIdx,
      frontIdx, lengthIdx, demandIdx, docsIdx, titleIdx, descIdx, tagsIdx
    ].filter((idx) => idx >= 0)
  );

  const customColumnIndices: number[] = [];
  for (let idx = 0; idx < rawHeaders.length; idx++) {
    if (!baseIndices.has(idx) && rawHeaders[idx]) {
      customColumnIndices.push(idx);
    }
  }

  const customColSamples: Record<string, string[]> = {};
  for (const cIdx of customColumnIndices) {
    customColSamples[rawHeaders[cIdx]] = [];
  }

  const rows: ParsedListingRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCsvLine(line, delimiter);

    const rawSerial = serialIdx >= 0 ? values[serialIdx]?.replace(/["']/g, '').trim() : '';
    const dateVal = dateIdx >= 0 ? values[dateIdx]?.replace(/["']/g, '').trim() : '';
    const rawNumber = numberIdx >= 0 ? values[numberIdx]?.replace(/["']/g, '').trim() : '';
    const cityVal = cityIdx >= 0 ? values[cityIdx]?.replace(/["']/g, '').trim() : '';
    const areaVal = areaIdx >= 0 ? values[areaIdx]?.replace(/["']/g, '').trim() : '';
    const addressVal = addressIdx >= 0 ? values[addressIdx]?.replace(/["']/g, '').trim() : '';
    const typeVal = typeIdx >= 0 ? values[typeIdx]?.replace(/["']/g, '').trim() : '';
    const sizeVal = sizeIdx >= 0 ? values[sizeIdx]?.replace(/["']/g, '').trim() : '';
    const storeyVal = storeyIdx >= 0 ? values[storeyIdx]?.replace(/["']/g, '').trim() : '';
    const utilitiesVal = utilitiesIdx >= 0 ? values[utilitiesIdx]?.replace(/["']/g, '').trim() : '';
    const rawStatus = statusIdx >= 0 ? values[statusIdx]?.replace(/["']/g, '').trim().toLowerCase() : '';
    const rentVal = rentIdx >= 0 ? values[rentIdx]?.replace(/["']/g, '').trim() : '';
    const frontVal = frontIdx >= 0 ? values[frontIdx]?.replace(/["']/g, '').trim() : '';
    const lengthVal = lengthIdx >= 0 ? values[lengthIdx]?.replace(/["']/g, '').trim() : '';
    const demandVal = demandIdx >= 0 ? values[demandIdx]?.replace(/["']/g, '').trim() : '';
    const docsVal = docsIdx >= 0 ? values[docsIdx]?.replace(/["']/g, '').trim() : '';
    const customTitle = titleIdx >= 0 ? values[titleIdx]?.replace(/["']/g, '').trim() : '';
    const customDesc = descIdx >= 0 ? values[descIdx]?.replace(/["']/g, '').trim() : '';
    const rawTags = tagsIdx >= 0 ? values[tagsIdx]?.replace(/["']/g, '').trim() : '';

    // Auto-calculate serial number if empty
    const serial_no = rawSerial || `L-${currentListingCount + rows.length + 1}`;

    // Auto-generate title if empty
    let title = customTitle;
    if (!title) {
      const parts: string[] = [];
      if (sizeVal) parts.push(sizeVal);
      if (typeVal) parts.push(typeVal);
      if (areaVal) parts.push(`in ${areaVal}`);
      else if (cityVal) parts.push(`in ${cityVal}`);
      title = parts.length > 0 ? parts.join(' ') : `Property ${serial_no}`;
    }

    // Normalize phone number
    const contact_number = rawNumber ? normalizePhoneForImport(rawNumber) : undefined;

    // Normalize status: only 'available' and 'sold'
    const status: 'available' | 'sold' = rawStatus.includes('sold') ? 'sold' : 'available';

    // Auto-derive tags
    const rowTags: string[] = [];
    if (cityVal && !rowTags.includes(cityVal)) rowTags.push(cityVal);
    if (areaVal && !rowTags.includes(areaVal)) rowTags.push(areaVal);
    if (typeVal && !rowTags.includes(typeVal)) rowTags.push(typeVal);
    if (rawTags) {
      for (const t of rawTags.split(/[,;]/)) {
        const cleanTag = t.trim();
        if (cleanTag && !rowTags.includes(cleanTag)) {
          rowTags.push(cleanTag);
        }
      }
    }

    // Combine description
    const descParts: string[] = [];
    if (dateVal) descParts.push(`Listing Date: ${dateVal}`);
    if (customDesc) descParts.push(customDesc);
    const description = descParts.length > 0 ? descParts.join('\n') : undefined;

    // Collect custom columns
    const customValues: Record<string, string> = {};
    for (const cIdx of customColumnIndices) {
      const colName = rawHeaders[cIdx];
      const val = values[cIdx]?.replace(/["']/g, '').trim() ?? '';
      if (val) {
        customValues[colName] = val;
        if (customColSamples[colName].length < 10) {
          customColSamples[colName].push(val);
        }
      }
    }

    rows.push({
      serial_no,
      title,
      contact_number,
      city: cityVal || undefined,
      area: areaVal || undefined,
      address: addressVal || undefined,
      property_type: typeVal || undefined,
      size: sizeVal || undefined,
      storey: storeyVal || undefined,
      front_dimension: frontVal || undefined,
      length_dimension: lengthVal || undefined,
      demand_price: demandVal || undefined,
      potential_rent: rentVal || undefined,
      utilities: utilitiesVal || undefined,
      documents: docsVal || undefined,
      status,
      description,
      tags: rowTags,
      customFieldValues: Object.keys(customValues).length > 0 ? customValues : undefined,
    });
  }

  const discoveredCustomColumns: DiscoveredCustomColumn[] = customColumnIndices.map((cIdx) => ({
    name: rawHeaders[cIdx],
    sampleValues: customColSamples[rawHeaders[cIdx]] || [],
  }));

  return {
    rows,
    hasRecognizedColumns: true,
    discoveredCustomColumns,
  };
}
