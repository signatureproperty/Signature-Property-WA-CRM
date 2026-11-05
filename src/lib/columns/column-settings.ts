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
}

export const DEFAULT_CONTACT_COLUMNS_DEF: {
  id: string;
  defaultLabel: string;
  fieldType: CustomFieldType;
  required?: boolean;
}[] = [
  { id: 'name', defaultLabel: 'Name', fieldType: 'text' },
  { id: 'phone', defaultLabel: 'Phone', fieldType: 'text', required: true },
  { id: 'email', defaultLabel: 'Email', fieldType: 'text' },
  { id: 'company', defaultLabel: 'Company', fieldType: 'text' },
  { id: 'tags', defaultLabel: 'Tags', fieldType: 'select' },
  { id: 'created_at', defaultLabel: 'Created', fieldType: 'date' },
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

  const defaultCols: ColumnDefinition[] = DEFAULT_CONTACT_COLUMNS_DEF.map((def) => {
    const s = settingsMap.get(def.id);
    const label = s?.label?.trim() || def.defaultLabel;
    const isDeleted = s?.is_deleted ?? false;
    const isVis = prevVisibilityMap?.has(def.id)
      ? (prevVisibilityMap.get(def.id) as boolean)
      : true;

    return {
      id: def.id,
      label,
      defaultLabel: def.defaultLabel,
      visible: isVis && !isDeleted,
      isDefault: true,
      isCustom: false,
      required: def.required,
      fieldType: def.fieldType,
      isDeleted,
    };
  });

  const customCols: ColumnDefinition[] = customFields.map((f) => {
    const isVis = prevVisibilityMap?.has(f.id)
      ? (prevVisibilityMap.get(f.id) as boolean)
      : true;
    const rawOpts = (f.field_options as { options?: string[] } | null)?.options;

    return {
      id: f.id,
      label: f.field_name,
      defaultLabel: f.field_name,
      visible: isVis,
      isDefault: false,
      isCustom: true,
      fieldType: (f.field_type as CustomFieldType) || 'text',
      options: Array.isArray(rawOpts) ? rawOpts : undefined,
      isDeleted: false,
    };
  });

  return [...defaultCols, ...customCols];
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

  const defaultCols: ColumnDefinition[] = DEFAULT_LISTING_COLUMNS_DEF.map((def) => {
    const s = settingsMap.get(def.id);
    const label = s?.label?.trim() || def.defaultLabel;
    const isDeleted = s?.is_deleted ?? false;
    const initialVisible = !defaultHiddenByDefault.has(def.id);
    const isVis = prevVisibilityMap?.has(def.id)
      ? (prevVisibilityMap.get(def.id) as boolean)
      : initialVisible;

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
    };
  });

  const customCols: ColumnDefinition[] = customFields.map((f) => {
    const isVis = prevVisibilityMap?.has(f.id)
      ? (prevVisibilityMap.get(f.id) as boolean)
      : true;
    const rawOpts = (f.field_options as { options?: string[] } | null)?.options;

    return {
      id: f.id,
      label: f.field_name,
      defaultLabel: f.field_name,
      visible: isVis,
      isDefault: false,
      isCustom: true,
      fieldType: (f.field_type as CustomFieldType) || 'text',
      options: Array.isArray(rawOpts) ? rawOpts : undefined,
      isDeleted: false,
    };
  });

  return [...defaultCols, ...customCols];
}

