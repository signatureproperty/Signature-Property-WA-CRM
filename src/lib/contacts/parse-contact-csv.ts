/**
 * CSV parsing for the contacts import modal. Shared + unit-tested so
 * tag-column handling stays aligned with phone/name/email/company.
 * Enhanced to support Real Estate sheets and dynamic custom columns.
 */

export interface ParsedContactRow {
  phone: string;
  name?: string;
  email?: string;
  company?: string;
  serial_no?: string;
  city?: string;
  area?: string;
  property_type?: string;
  size?: string;
  budget?: string;
  created_at?: string;
  /** Tag names from the optional `tags` column or auto-derived from Real Estate columns. */
  tagNames: string[];
  /** Consolidated lead notes from Real Estate fields. */
  notes?: string;
  /** Key-value map of all custom columns for this row (e.g. { 'Investor': 'Yes', 'Notes': 'Urgent' }) */
  customFieldValues?: Record<string, string>;
}

export interface DiscoveredCustomColumn {
  name: string;
  sampleValues: string[];
}

/** Split a CSV cell into unique tag names (case-insensitive de-dupe). */
export function parseTagCell(value: string | undefined): string[] {
  if (!value?.trim()) return [];

  const seen = new Set<string>();
  const names: string[] = [];

  for (const part of value.split(/[,;]/)) {
    const name = part.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }

  return names;
}

/**
 * Normalizes phone numbers for import:
 * - Tolerates local Pakistani formats (0300... or 300... -> +92300...)
 * - Prepending + when appropriate so international validator accepts it
 */
export function normalizePhoneForImport(raw: string): string {
  const val = raw.trim().replace(/["']/g, '');
  if (!val) return '';
  if (val.startsWith('+')) {
    return val;
  }
  const digits = val.replace(/\D/g, '');
  if (!digits) return val;

  // Pakistani 11-digit mobile (e.g. 03278572797 -> +923278572797)
  if (digits.length === 11 && digits.startsWith('03')) {
    return '+92' + digits.slice(1);
  }
  // Pakistani 10-digit mobile without leading 0 (e.g. 3278572797 -> +923278572797)
  if (digits.length === 10 && digits.startsWith('3')) {
    return '+92' + digits;
  }
  // Pakistani 12-digit with 92 prefix (e.g. 923278572797 -> +923278572797)
  if (digits.length === 12 && digits.startsWith('923')) {
    return '+' + digits;
  }

  return val;
}

export interface ParseContactCsvResult {
  rows: ParsedContactRow[];
  /** True when the CSV header includes a recognized phone/number column. */
  hasPhoneColumn: boolean;
  /** True when the CSV header includes an explicit `tags` column. */
  hasTagsColumn: boolean;
  /** True when the CSV header includes a `company` column. */
  hasCompanyColumn: boolean;
  /** Discovered custom columns not covered by base fields (e.g. Investor, 100ft road). */
  discoveredCustomColumns: DiscoveredCustomColumn[];
  /** All raw headers from the CSV in order. */
  headers: string[];
}

export function normalizeHeaderName(name: string): string {
  return name.trim().toLowerCase().replace(/["']/g, '').replace(/[_\s]+/g, ' ');
}

export function findHeaderIndex(headers: string[], synonyms: string[]): number {
  return headers.findIndex((h) => synonyms.includes(normalizeHeaderName(h)));
}

/**
 * Splits CSV text into logical records/lines, properly handling
 * double-quoted fields that contain newlines and CRLF/LF endings.
 */
export function splitCsvRecords(csvText: string): string[] {
  const records: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    if (char === '"') {
      if (inQuotes && csvText[i + 1] === '"') {
        current += '""';
        i++;
      } else {
        inQuotes = !inQuotes;
        current += char;
      }
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && csvText[i + 1] === '\n') {
        i++;
      }
      if (current.trim().length > 0) {
        records.push(current);
      }
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim().length > 0) {
    records.push(current);
  }
  return records;
}

/**
 * Automatically locates the header row within the first few lines of a CSV/TSV,
 * tolerating title/banner rows (e.g. from Google Sheets exports like "Signature Property,,,,,,,")
 * and detects the best delimiter (\t, ,, ;).
 */
export function detectHeaderRowAndDelimiter(
  records: string[],
  candidateKeywords: string[]
): { headerLineIdx: number; delimiter: string; score: number } {
  if (records.length === 0) {
    return { headerLineIdx: 0, delimiter: ',', score: 0 };
  }

  let bestIdx = 0;
  let bestScore = 0;
  let bestDelimiter = ',';

  const firstLine = records[0] || '';
  const fallbackDelimiter = firstLine.includes('\t')
    ? '\t'
    : firstLine.includes(';') && !firstLine.includes(',')
      ? ';'
      : ',';

  const maxScan = Math.min(15, records.length);
  for (let i = 0; i < maxScan; i++) {
    const record = records[i];
    if (!record || !record.trim()) continue;

    for (const del of ['\t', ',', ';']) {
      const cells = parseCsvLine(record, del).map(normalizeHeaderName);
      let score = 0;
      for (const cell of cells) {
        if (!cell) continue;
        if (candidateKeywords.some((k) => cell === k || cell.includes(k))) {
          score++;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
        bestDelimiter = del;
      }
    }
  }

  if (bestScore === 0) {
    return { headerLineIdx: 0, delimiter: fallbackDelimiter, score: 0 };
  }

  return { headerLineIdx: bestIdx, delimiter: bestDelimiter, score: bestScore };
}

export const CONTACT_HEADER_KEYWORDS = [
  'phone',
  'number',
  'phone number',
  'phonenumber',
  'mobile',
  'mobile number',
  'contact',
  'contact number',
  'cell',
  'whatsapp',
  'wa',
  'ph',
  'name',
  'customer name',
  'client name',
  'full name',
  'buyer name',
  'buyer',
  'lead name',
  'email',
  'e mail',
  'email address',
  'company',
  'organization',
  'agency',
  'tags',
  'tag',
  'sr no',
  'sr',
  'srno',
  'serial',
  'serial no',
  'serial_no',
  's.no',
  's no',
  'id',
  'city',
  'area',
  'location',
  'sector',
  'phase',
  'property type',
  'propertytype',
  'type',
  'category',
  'size',
  'area size',
  'plot size',
  'budget',
  'demand',
  'price',
  'notes',
  'note',
  'remarks',
  'comments',
  'detail',
  'date',
  'created date',
  'date entered',
  'created_at',
];

export function parseContactCsv(text: string): ParseContactCsvResult {
  const records = splitCsvRecords(text);
  if (records.length < 2) {
    return {
      rows: [],
      hasPhoneColumn: false,
      hasTagsColumn: false,
      hasCompanyColumn: false,
      discoveredCustomColumns: [],
      headers: [],
    };
  }

  const { headerLineIdx, delimiter } = detectHeaderRowAndDelimiter(records, CONTACT_HEADER_KEYWORDS);
  const rawHeaders = parseCsvLine(records[headerLineIdx], delimiter).map((h) => h.replace(/["']/g, '').trim());
  const headers = rawHeaders.map(normalizeHeaderName);

  // Phone column synonyms
  const phoneIdx = findHeaderIndex(headers, [
    'phone',
    'number',
    'phone number',
    'phonenumber',
    'mobile',
    'mobile number',
    'contact',
    'contact number',
    'cell',
    'whatsapp',
    'wa',
    'ph',
  ]);

  if (phoneIdx === -1) {
    return {
      rows: [],
      hasPhoneColumn: false,
      hasTagsColumn: false,
      hasCompanyColumn: false,
      discoveredCustomColumns: [],
      headers: rawHeaders,
    };
  }

  const nameIdx = findHeaderIndex(headers, [
    'name',
    'customer name',
    'client name',
    'full name',
    'buyer name',
    'buyer',
    'lead name',
  ]);
  const emailIdx = findHeaderIndex(headers, ['email', 'e mail', 'email address']);
  const companyIdx = findHeaderIndex(headers, ['company', 'organization', 'agency']);
  const tagsIdx = findHeaderIndex(headers, ['tags', 'tag']);

  // Real estate lead fields (default columns)
  const serialIdx = findHeaderIndex(headers, [
    'sr no',
    'sr',
    'srno',
    'serial',
    'serial no',
    'serial_no',
    's.no',
    's no',
    'id',
  ]);
  const cityIdx = findHeaderIndex(headers, ['city']);
  const areaIdx = findHeaderIndex(headers, ['area', 'location', 'sector', 'phase']);
  const typeIdx = findHeaderIndex(headers, ['property type', 'propertytype', 'type', 'category']);
  const sizeIdx = findHeaderIndex(headers, ['size', 'area size', 'plot size']);
  const budgetIdx = findHeaderIndex(headers, ['budget', 'demand', 'price']);
  const notesIdx = findHeaderIndex(headers, ['notes', 'note', 'remarks', 'comments', 'detail']);
  const dateIdx = findHeaderIndex(headers, ['date', 'created date', 'date entered', 'created_at']);

  // Any non-base column is considered a dynamic custom column
  const baseIndices = new Set(
    [
      phoneIdx,
      nameIdx,
      emailIdx,
      companyIdx,
      tagsIdx,
      serialIdx,
      cityIdx,
      areaIdx,
      typeIdx,
      sizeIdx,
      budgetIdx,
      dateIdx,
      notesIdx,
    ].filter((idx) => idx >= 0)
  );

  const customColumnIndices: number[] = [];
  for (let idx = 0; idx < rawHeaders.length; idx++) {
    if (!baseIndices.has(idx) && rawHeaders[idx]) {
      customColumnIndices.push(idx);
    }
  }

  const rows: ParsedContactRow[] = [];
  const customColSamples: Record<string, string[]> = {};
  for (const cIdx of customColumnIndices) {
    customColSamples[rawHeaders[cIdx]] = [];
  }

  for (let i = headerLineIdx + 1; i < records.length; i++) {
    const line = records[i].trim();
    if (!line) continue;

    const values = parseCsvLine(line, delimiter);
    if (values.every((v) => !v.trim())) continue;
    const rawPhone = values[phoneIdx]?.replace(/["']/g, '').trim() ?? '';
    const phone = normalizePhoneForImport(rawPhone);

    // ONLY populate tags from an actual tags/tag column. Never dump City/Area/Type into tags!
    const rowTags: string[] = [];
    if (tagsIdx >= 0) {
      rowTags.push(...parseTagCell(values[tagsIdx]?.replace(/["']/g, '')));
    }

    const cityVal = cityIdx >= 0 ? values[cityIdx]?.replace(/["']/g, '').trim() : '';
    const areaVal = areaIdx >= 0 ? values[areaIdx]?.replace(/["']/g, '').trim() : '';
    const typeVal = typeIdx >= 0 ? values[typeIdx]?.replace(/["']/g, '').trim() : '';
    const sizeVal = sizeIdx >= 0 ? values[sizeIdx]?.replace(/["']/g, '').trim() : '';
    const budgetVal = budgetIdx >= 0 ? values[budgetIdx]?.replace(/["']/g, '').trim() : '';
    const userNotes = notesIdx >= 0 ? values[notesIdx]?.replace(/["']/g, '').trim() : '';
    const dateVal = dateIdx >= 0 ? values[dateIdx]?.replace(/["']/g, '').trim() : '';

    // Collect custom column values for this row
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

    let parsedCreatedAt: string | undefined = undefined;
    if (dateVal) {
      const d = new Date(dateVal);
      if (!isNaN(d.getTime())) {
        parsedCreatedAt = d.toISOString();
      }
    }

    rows.push({
      phone,
      name: nameIdx >= 0 ? values[nameIdx]?.replace(/["']/g, '').trim() || undefined : undefined,
      email: emailIdx >= 0 ? values[emailIdx]?.replace(/["']/g, '').trim() || undefined : undefined,
      company: companyIdx >= 0 ? values[companyIdx]?.replace(/["']/g, '').trim() || undefined : undefined,
      serial_no: serialIdx >= 0 ? values[serialIdx]?.replace(/["']/g, '').trim() || undefined : undefined,
      city: cityVal || undefined,
      area: areaVal || undefined,
      property_type: typeVal || undefined,
      size: sizeVal || undefined,
      budget: budgetVal || undefined,
      created_at: parsedCreatedAt,
      tagNames: rowTags,
      notes: userNotes || undefined,
      customFieldValues: Object.keys(customValues).length > 0 ? customValues : undefined,
    });
  }

  const hasTags = tagsIdx >= 0 && rows.some((r) => r.tagNames.length > 0);

  const discoveredCustomColumns: DiscoveredCustomColumn[] = customColumnIndices.map((cIdx) => ({
    name: rawHeaders[cIdx],
    sampleValues: customColSamples[rawHeaders[cIdx]] || [],
  }));

  return {
    rows,
    hasPhoneColumn: true,
    hasTagsColumn: hasTags,
    hasCompanyColumn: companyIdx >= 0,
    discoveredCustomColumns,
    headers: rawHeaders,
  };
}

/** Simple CSV line parse (handles quoted fields and custom delimiters). */
export function parseCsvLine(line: string, delimiter = ','): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}
