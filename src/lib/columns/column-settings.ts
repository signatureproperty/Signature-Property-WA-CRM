import type { CustomField, CustomFieldType, AccountColumnSetting } from '@/types';

export interface ColumnDefinition {
  id: string;
  label: string;
  defaultLabel: string;
  visible: boolean;
  isDefault: boolean;
  isCustom: boolean;
  required?: boolean;
  fieldType: CustomFieldType;
  options?: string[];
  isDeleted: boolean;
  displayOrder?: number;
}

export const DEFAULT_CONTACT_COLUMNS_DEF: {
  id: string;
  defaultLabel: string;
  fieldType: CustomFieldType;
  required?: boolean;
  options?: string[];
}[] = [
  { id: 'serial_no', defaultLabel: 'Sr No', fieldType: 'text' },
  { id: 'phone', defaultLabel: 'Number', fieldType: 'text', required: true },
  { id: 'name', defaultLabel: 'Name', fieldType: 'text' },
  { id: 'city', defaultLabel: 'City', fieldType: 'text' },
  { id: 'area', defaultLabel: 'Area', fieldType: 'text' },
  {
    id: 'property_type',
    defaultLabel: 'Property Type',
    fieldType: 'select',
    options: ['House', 'Plot', 'Commercial', 'Apartment', 'Agricultural Land', 'Building', 'Other'],
  },
  { id: 'size', defaultLabel: 'Size', fieldType: 'text' },
  { id: 'budget', defaultLabel: 'Budget', fieldType: 'text' },
  { id: 'notes', defaultLabel: 'Notes', fieldType: 'text' },
  { id: 'tags', defaultLabel: 'Tags', fieldType: 'select' },
  { id: 'email', defaultLabel: 'Email', fieldType: 'text' },
  { id: 'company', defaultLabel: 'Company', fieldType: 'text' },
];

export const DEFAULT_LISTING_COLUMNS_DEF: {
  id: string;
  defaultLabel: string;
  fieldType: CustomFieldType;
  required?: boolean;
  options?: string[];
}[] = [
  { id: 'serial_no', defaultLabel: 'Sr No', fieldType: 'text' },
  { id: 'title', defaultLabel: 'Title', fieldType: 'text', required: true },
  {
    id: 'property_type',
    defaultLabel: 'Type',
    fieldType: 'select',
    options: ['House', 'Plot', 'Commercial', 'Apartment', 'Agricultural Land', 'Building'],
  },
  { id: 'size', defaultLabel: 'Size', fieldType: 'text' },
  { id: 'demand_price', defaultLabel: 'Demand', fieldType: 'text' },
  {
    id: 'status',
    defaultLabel: 'Status',
    fieldType: 'select',
    options: ['Available', 'Sold', 'Under Offer', 'Rented'],
  },
  { id: 'area_city', defaultLabel: 'City & Area', fieldType: 'text' },
  { id: 'notes', defaultLabel: 'Notes', fieldType: 'text' },
  { id: 'potential_rent', defaultLabel: 'Potential Rent', fieldType: 'text' },
  { id: 'dimensions', defaultLabel: 'Dimensions', fieldType: 'text' },
  { id: 'contact_number', defaultLabel: 'Contact Phone', fieldType: 'text' },
  { id: 'documents', defaultLabel: 'Documents', fieldType: 'text' },
];

/**
 * Builds the unified column list for contacts by merging default column definitions,
 * account-level overrides (custom names, deleted/hidden flags), and custom fields.
 */
export function buildUnifiedContactColumns(
  customFields: CustomField[] = [],
  settings: AccountColumnSetting[] = [],
  prevVisibilityMap?: Map<string, boolean>
): ColumnDefinition[] {
  const settingsMap = new Map(settings.map((s) => [s.column_id, s]));

  // Default secondary columns hidden initially unless toggled
  const defaultHiddenByDefault = new Set(['email', 'company']);

  const defaultCols: ColumnDefinition[] = DEFAULT_CONTACT_COLUMNS_DEF.map((def, idx) => {
    const s = settingsMap.get(def.id);
    const label = s?.label?.trim() || def.defaultLabel;
    const isDeleted = s?.is_deleted ?? false;
    const initialVisible = !defaultHiddenByDefault.has(def.id);
    const isVis = prevVisibilityMap?.has(def.id)
      ? (prevVisibilityMap.get(def.id) as boolean)
      : initialVisible;
    const displayOrder = typeof s?.display_order === 'number' ? s.display_order : idx;

    return {
      id: def.id,
      label,
      defaultLabel: def.defaultLabel,
      visible: isVis && !isDeleted,
      isDefault: true,
      isCustom: false,
      required: def.required,
      fieldType: def.fieldType,
      options: def.options,
      isDeleted,
      displayOrder,
    };
  });

  const customCols: ColumnDefinition[] = customFields.map((f, fIdx) => {
    const s = settingsMap.get(f.id);
    const isVis = prevVisibilityMap?.has(f.id)
      ? (prevVisibilityMap.get(f.id) as boolean)
      : true;
    const rawOpts = (f.field_options as { options?: string[] } | null)?.options;
    const displayOrder =
      typeof s?.display_order === 'number'
        ? s.display_order
        : DEFAULT_CONTACT_COLUMNS_DEF.length + fIdx;

    return {
      id: f.id,
      label: s?.label?.trim() || f.field_name,
      defaultLabel: f.field_name,
      visible: isVis,
      isDefault: false,
      isCustom: true,
      fieldType: (f.field_type as CustomFieldType) || 'text',
      options: Array.isArray(rawOpts) ? rawOpts : undefined,
      isDeleted: false,
      displayOrder,
    };
  });

  return [...defaultCols, ...customCols].sort(
    (a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)
  );
}

/**
 * Builds the unified column list for listings by merging default column definitions,
 * account-level overrides, and custom fields.
 */
export function buildUnifiedListingColumns(
  customFields: CustomField[] = [],
  settings: AccountColumnSetting[] = [],
  prevVisibilityMap?: Map<string, boolean>
): ColumnDefinition[] {
  const settingsMap = new Map(settings.map((s) => [s.column_id, s]));

  // Default listing column initial visibility defaults (some secondary columns were hidden by default)
  const defaultHiddenByDefault = new Set([
    'potential_rent',
    'dimensions',
    'contact_number',
    'documents',
  ]);

  const defaultCols: ColumnDefinition[] = DEFAULT_LISTING_COLUMNS_DEF.map((def, idx) => {
    const s = settingsMap.get(def.id);
    const label = s?.label?.trim() || def.defaultLabel;
    const isDeleted = s?.is_deleted ?? false;
    const initialVisible = !defaultHiddenByDefault.has(def.id);
    const isVis = prevVisibilityMap?.has(def.id)
      ? (prevVisibilityMap.get(def.id) as boolean)
      : initialVisible;
    const displayOrder = typeof s?.display_order === 'number' ? s.display_order : idx;

    return {
      id: def.id,
      label,
      defaultLabel: def.defaultLabel,
      visible: isVis && !isDeleted,
      isDefault: true,
      isCustom: false,
      required: def.required,
      fieldType: def.fieldType,
      options: def.options,
      isDeleted,
      displayOrder,
    };
  });

  const customCols: ColumnDefinition[] = customFields.map((f, fIdx) => {
    const s = settingsMap.get(f.id);
    const isVis = prevVisibilityMap?.has(f.id)
      ? (prevVisibilityMap.get(f.id) as boolean)
      : true;
    const rawOpts = (f.field_options as { options?: string[] } | null)?.options;
    const displayOrder =
      typeof s?.display_order === 'number'
        ? s.display_order
        : DEFAULT_LISTING_COLUMNS_DEF.length + fIdx;

    return {
      id: f.id,
      label: s?.label?.trim() || f.field_name,
      defaultLabel: f.field_name,
      visible: isVis,
      isDefault: false,
      isCustom: true,
      fieldType: (f.field_type as CustomFieldType) || 'text',
      options: Array.isArray(rawOpts) ? rawOpts : undefined,
      isDeleted: false,
      displayOrder,
    };
  });

  return [...defaultCols, ...customCols].sort(
    (a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)
  );
}

/**
 * Compact date formatter for leads and listings (e.g. "30 Sep 2026").
 * Displayed subtly in row/card view without needing a wide standalone column.
 */
export function formatDateCompact(dateStr?: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}


