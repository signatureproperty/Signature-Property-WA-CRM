'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import type { PropertyListing, PropertyListingStatus, CustomField } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Plus, Sparkles, Building2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface ListingFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listing?: PropertyListing | null;
  onSaved: () => void;
}

const PROPERTY_TYPES = [
  'House',
  'Old House',
  'Plot',
  'Commercial',
  'Apartment',
  'Villa',
  'Portion',
  'Farmhouse',
  'Office',
  'Shop',
  'Other',
];

const SIZE_UNITS = ['Marla', 'Kanal', 'Sq. Ft.', 'Acre', 'Maraba'] as const;
type SizeUnit = (typeof SIZE_UNITS)[number];

const STATUS_OPTIONS: { value: PropertyListingStatus; label: string }[] = [
  { value: 'available', label: 'Available' },
  { value: 'sold', label: 'Sold' },
];

export function ListingForm({
  open,
  onOpenChange,
  listing,
  onSaved,
}: ListingFormProps) {
  const t = useTranslations('Listings.form');
  const supabase = createClient();
  const { account, user } = useAuth();
  const isEdit = !!listing;

  const [saving, setSaving] = useState(false);

  // Auto-calculated Serial No (e.g. L-1, L-2)
  const [serialNo, setSerialNo] = useState('');

  // Primary Fields
  const [propertyType, setPropertyType] = useState('House');
  const [sizeValue, setSizeValue] = useState('');
  const [sizeUnit, setSizeUnit] = useState<SizeUnit>('Marla');
  const [area, setArea] = useState('');
  const [city, setCity] = useState('Lahore');
  const [title, setTitle] = useState('');
  const [isTitleManual, setIsTitleManual] = useState(false);

  // Status & Contact
  const [status, setStatus] = useState<PropertyListingStatus>('available');
  const [contactNumber, setContactNumber] = useState('');

  // Pricing & Dimensions
  const [demandPrice, setDemandPrice] = useState('');
  const [potentialRent, setPotentialRent] = useState('');
  const [frontDimension, setFrontDimension] = useState('');
  const [lengthDimension, setLengthDimension] = useState('');
  const [storey, setStorey] = useState('');

  // Legal & Address
  const [address, setAddress] = useState('');
  const [utilities, setUtilities] = useState('');
  const [documents, setDocuments] = useState('');
  const [description, setDescription] = useState('');

  // Tags
  const [tags, setTags] = useState<string[]>([]);
  const [newTagName, setNewTagName] = useState('');

  // Custom Fields (Dynamic Columns) & Column Settings
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [columnSettings, setColumnSettings] = useState<Record<string, { label: string; is_deleted: boolean }>>({});

  // Auto-generate title helper: "{Size} {Unit} {Type} in {Area}"
  function buildAutoTitle(sz: string, un: string, typ: string, ar: string) {
    const parts: string[] = [];
    if (sz.trim()) {
      parts.push(`${sz.trim()} ${un}`);
    }
    if (typ.trim()) {
      parts.push(typ.trim());
    }
    if (ar.trim()) {
      parts.push(`in ${ar.trim()}`);
    }
    return parts.join(' ');
  }

  // Sync auto-generated title when size, unit, type, or area changes
  function updateAutoTitle(newSz: string, newUn: string, newTyp: string, newAr: string) {
    if (!isTitleManual) {
      const generated = buildAutoTitle(newSz, newUn, newTyp, newAr);
      setTitle(generated);
    }
  }

  useEffect(() => {
    if (open) {
      if (listing) {
        setSerialNo(listing.serial_no || '');
        setTitle(listing.title || '');
        setIsTitleManual(true); // Don't override existing title on edit
        setContactNumber(listing.contact_number || '');
        setPropertyType(listing.property_type || 'House');
        setStatus(listing.status === 'sold' ? 'sold' : 'available');
        setCity(listing.city || 'Lahore');
        setArea(listing.area || '');
        setAddress(listing.address || '');

        // Parse size and unit
        if (listing.size) {
          const match = listing.size.match(/^([\d.]+)\s*(.*)$/);
          if (match) {
            setSizeValue(match[1]);
            const matchedUnit = SIZE_UNITS.find((u) => u.toLowerCase() === match[2].trim().toLowerCase());
            setSizeUnit(matchedUnit || 'Marla');
          } else {
            setSizeValue(listing.size);
            setSizeUnit('Marla');
          }
        } else {
          setSizeValue('');
          setSizeUnit('Marla');
        }

        setStorey(listing.storey || '');
        setFrontDimension(listing.front_dimension || '');
        setLengthDimension(listing.length_dimension || '');
        setDemandPrice(listing.demand_price || '');
        setPotentialRent(listing.potential_rent || '');
        setUtilities(listing.utilities || '');
        setDocuments(listing.documents || '');
        setDescription(listing.description || '');
        setTags(listing.tags || []);
      } else {
        // Reset form for fresh entry
        setIsTitleManual(false);
        setPropertyType('House');
        setSizeValue('');
        setSizeUnit('Marla');
        setArea('');
        setCity('Lahore');
        setTitle('');
        setContactNumber('');
        setStatus('available');
        setStorey('');
        setFrontDimension('');
        setLengthDimension('');
        setDemandPrice('');
        setPotentialRent('');
        setAddress('');
        setUtilities('');
        setDocuments('');
        setDescription('');
        setTags([]);

        // Auto-assign next L- number based on count
        if (account?.id) {
          supabase
            .from('property_listings')
            .select('*', { count: 'exact', head: true })
            .eq('account_id', account.id)
            .then(({ count }) => {
              const nextNum = (count ?? 0) + 1;
              setSerialNo(`L-${nextNum}`);
            });
        }
      }
      setNewTagName('');
      fetchCustomFields();
    }
  }, [open, listing, account?.id, supabase]);

  async function fetchCustomFields() {
    if (!account?.id) return;
    const [fieldsRes, settingsRes] = await Promise.all([
      supabase
        .from('custom_fields')
        .select('*')
        .eq('account_id', account.id)
        .eq('entity_type', 'listing')
        .order('field_name'),
      supabase
        .from('account_column_settings')
        .select('*')
        .eq('account_id', account.id)
        .eq('entity_type', 'listing'),
    ]);

    if (fieldsRes.data) setCustomFields(fieldsRes.data as CustomField[]);

    if (settingsRes.data) {
      const sMap: Record<string, { label: string; is_deleted: boolean }> = {};
      for (const s of settingsRes.data) {
        sMap[s.column_id] = { label: s.label, is_deleted: s.is_deleted };
      }
      setColumnSettings(sMap);
    }

    if (listing?.custom_fields) {
      setCustomValues(listing.custom_fields as Record<string, string>);
    } else {
      setCustomValues({});
    }
  }

  function handleAddTag() {
    const trimmed = newTagName.trim();
    if (!trimmed) return;
    if (!tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
    }
    setNewTagName('');
  }

  function handleRemoveTag(tagToRemove: string) {
    setTags(tags.filter((t) => t !== tagToRemove));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!account?.id) {
      toast.error('Account not loaded. Please try again.');
      return;
    }

    const finalTitle = title.trim() || buildAutoTitle(sizeValue, sizeUnit, propertyType, area) || 'Property Listing';
    const finalSize = sizeValue.trim() ? `${sizeValue.trim()} ${sizeUnit}` : null;

    setSaving(true);
    try {
      const payload = {
        account_id: account.id,
        serial_no: serialNo.trim() || null,
        title: finalTitle,
        contact_number: contactNumber.trim() || null,
        property_type: propertyType,
        status,
        city: city.trim() || null,
        area: area.trim() || null,
        address: address.trim() || null,
        size: finalSize,
        storey: storey.trim() || null,
        front_dimension: frontDimension.trim() || null,
        length_dimension: lengthDimension.trim() || null,
        demand_price: demandPrice.trim() || null,
        potential_rent: potentialRent.trim() || null,
        utilities: utilities.trim() || null,
        documents: documents.trim() || null,
        description: description.trim() || null,
        notes: description.trim() || null,
        tags,
        custom_fields: customValues,
        created_by: user?.id || null,
      };

      if (listing) {
        const { error } = await supabase
          .from('property_listings')
          .update(payload)
          .eq('id', listing.id);

        if (error) throw error;
        toast.success(t('savedSuccess'));
      } else {
        const { error } = await supabase
          .from('property_listings')
          .insert(payload);

        if (error) throw error;
        toast.success(t('savedSuccess'));
      }

      onSaved();
      onOpenChange(false);
    } catch (err: unknown) {
      console.error('Error saving property listing:', err);
      toast.error(t('saveError'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-popover border-border text-popover-foreground sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-popover-foreground text-lg font-semibold flex items-center gap-2">
              <Building2 className="size-5 text-primary" />
              {isEdit ? t('editTitle') : t('addTitle')}
            </DialogTitle>
            {serialNo && (
              <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                {serialNo}
              </span>
            )}
          </div>
          <DialogDescription className="text-muted-foreground text-sm">
            {isEdit
              ? 'Update this property listing’s specs, pricing, and availability.'
              : 'Add a new property or plot listing to your real estate inventory.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* 1. SIZE & UNIT + PROPERTY TYPE */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Size & Unit inline group */}
            <div className="space-y-2">
              <Label className="text-muted-foreground text-sm font-medium">
                Size / Area <span className="text-red-400">*</span>
              </Label>
              <div className="flex rounded-md shadow-xs">
                <Input
                  type="text"
                  placeholder="e.g. 5 or 7.5"
                  value={sizeValue}
                  onChange={(e) => {
                    setSizeValue(e.target.value);
                    updateAutoTitle(e.target.value, sizeUnit, propertyType, area);
                  }}
                  className="rounded-r-none border-r-0 bg-muted border-border text-foreground placeholder:text-muted-foreground flex-1"
                  required
                />
                <Select
                  value={sizeUnit}
                  onValueChange={(val) => {
                    const nextUnit = (val as SizeUnit) || 'Marla';
                    setSizeUnit(nextUnit);
                    updateAutoTitle(sizeValue, nextUnit, propertyType, area);
                  }}
                >
                  <SelectTrigger className="w-28 rounded-l-none bg-muted border-border text-foreground font-medium text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SIZE_UNITS.map((u) => (
                      <SelectItem key={u} value={u} className="text-xs">
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Property Type */}
            <div className="space-y-2">
              <Label className="text-muted-foreground text-sm font-medium">
                Property Type
              </Label>
              <Select
                value={propertyType}
                onValueChange={(val) => {
                  const nextType = val || 'House';
                  setPropertyType(nextType);
                  updateAutoTitle(sizeValue, sizeUnit, nextType, area);
                }}
              >
                <SelectTrigger className="w-full bg-muted border-border text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROPERTY_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 2. AREA / SOCIETY & CITY */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-muted-foreground text-sm font-medium">
                Area / Society <span className="text-red-400">*</span>
              </Label>
              <Input
                placeholder="e.g. Harbanspura, DHA Phase 6"
                value={area}
                onChange={(e) => {
                  setArea(e.target.value);
                  updateAutoTitle(sizeValue, sizeUnit, propertyType, e.target.value);
                }}
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                required
              />
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground text-sm font-medium">
                City
              </Label>
              <Input
                placeholder="e.g. Lahore, Islamabad"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
          </div>

          {/* 3. AUTO-GENERATED TITLE */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-muted-foreground text-sm font-medium flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-primary" />
                Property Title (Auto-Generated)
              </Label>
              {isTitleManual && (
                <button
                  type="button"
                  onClick={() => {
                    setIsTitleManual(false);
                    setTitle(buildAutoTitle(sizeValue, sizeUnit, propertyType, area));
                  }}
                  className="text-xs text-primary hover:underline"
                >
                  Reset to Auto
                </button>
              )}
            </div>
            <Input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setIsTitleManual(true);
              }}
              placeholder="e.g. 5 Marla House in Harbanspura"
              className="bg-muted border-border text-foreground font-medium placeholder:text-muted-foreground"
              required
            />
          </div>

          {/* 4. DEMAND & STATUS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {!columnSettings['demand_price']?.is_deleted && (
              <div className="space-y-2">
                <Label className="text-muted-foreground text-sm font-medium">
                  {columnSettings['demand_price']?.label || 'Demand / Price'}
                </Label>
                <Input
                  placeholder="e.g. 2.2 Cr, 85 Lac"
                  value={demandPrice}
                  onChange={(e) => setDemandPrice(e.target.value)}
                  className="bg-muted border-border text-foreground font-semibold placeholder:text-muted-foreground"
                />
              </div>
            )}

            {!columnSettings['status']?.is_deleted && (
              <div className="space-y-2">
                <Label className="text-muted-foreground text-sm font-medium">
                  {columnSettings['status']?.label || 'Listing Status'}
                </Label>
                <Select
                  value={status}
                  onValueChange={(val) => setStatus((val as PropertyListingStatus) || 'available')}
                >
                  <SelectTrigger className="w-full bg-muted border-border text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* 5. CONTACT NUMBER & STOREY */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {!columnSettings['contact_number']?.is_deleted && (
              <div className="space-y-2">
                <Label className="text-muted-foreground text-sm font-medium">
                  {columnSettings['contact_number']?.label || 'Contact / Seller Phone'}
                </Label>
                <Input
                  placeholder="e.g. 03278572797"
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  className="bg-muted border-border text-foreground font-mono text-sm placeholder:text-muted-foreground"
                />
              </div>
            )}

            {!columnSettings['storey']?.is_deleted && (
              <div className="space-y-2">
                <Label className="text-muted-foreground text-sm font-medium">
                  {columnSettings['storey']?.label || 'Storey / Floors'}
                </Label>
                <Input
                  placeholder="e.g. Single Storey, Double Storey"
                  value={storey}
                  onChange={(e) => setStorey(e.target.value)}
                  className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                />
              </div>
            )}
          </div>

          {/* 6. DIMENSIONS & FINANCIALS (Front, Length, Potential Rent) */}
          {(!columnSettings['dimensions']?.is_deleted || !columnSettings['potential_rent']?.is_deleted) && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {!columnSettings['dimensions']?.is_deleted && (
                <>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-sm font-medium">
                      Front
                    </Label>
                    <Input
                      placeholder="e.g. 30 ft"
                      value={frontDimension}
                      onChange={(e) => setFrontDimension(e.target.value)}
                      className="bg-muted border-border text-foreground placeholder:text-muted-foreground text-xs sm:text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-sm font-medium">
                      Length
                    </Label>
                    <Input
                      placeholder="e.g. 55 ft"
                      value={lengthDimension}
                      onChange={(e) => setLengthDimension(e.target.value)}
                      className="bg-muted border-border text-foreground placeholder:text-muted-foreground text-xs sm:text-sm"
                    />
                  </div>
                </>
              )}

              {!columnSettings['potential_rent']?.is_deleted && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-sm font-medium">
                    {columnSettings['potential_rent']?.label || 'Potential Rent'}
                  </Label>
                  <Input
                    placeholder="e.g. 75,000/mo"
                    value={potentialRent}
                    onChange={(e) => setPotentialRent(e.target.value)}
                    className="bg-muted border-border text-foreground placeholder:text-muted-foreground text-xs sm:text-sm"
                  />
                </div>
              )}
            </div>
          )}

          {/* 7. ADDRESS & LANDMARKS */}
          <div className="space-y-2">
            <Label className="text-muted-foreground text-sm font-medium">
              Detailed Address & Landmarks
            </Label>
            <Textarea
              placeholder="e.g. Near Chirag Market, Farooq Medical store wali street..."
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={2}
              className="bg-muted border-border text-foreground resize-none text-sm placeholder:text-muted-foreground"
            />
          </div>

          {/* 8. LEGAL DOCUMENTS & UTILITIES */}
          {(!columnSettings['documents']?.is_deleted || !columnSettings['utilities']?.is_deleted) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {!columnSettings['documents']?.is_deleted && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-sm font-medium">
                    {columnSettings['documents']?.label || 'Documents / Ownership'}
                  </Label>
                  <Input
                    placeholder="e.g. Registry Inteqal, Fard"
                    value={documents}
                    onChange={(e) => setDocuments(e.target.value)}
                    className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                  />
                </div>
              )}

              {!columnSettings['utilities']?.is_deleted && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-sm font-medium">
                    {columnSettings['utilities']?.label || 'Utilities Available'}
                  </Label>
                  <Input
                    placeholder="e.g. Electricity, Gas, Water"
                    value={utilities}
                    onChange={(e) => setUtilities(e.target.value)}
                    className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
                  />
                </div>
              )}
            </div>
          )}

          {/* 9. TAGS */}
          <div className="space-y-2">
            <Label className="text-muted-foreground text-sm font-medium">Tags</Label>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Add tag (e.g. Urgent Sale, Corner, Main Boulevard)..."
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                className="bg-muted border-border text-xs h-8 flex-1 placeholder:text-muted-foreground"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddTag}
                disabled={!newTagName.trim()}
                className="h-8 text-xs shrink-0"
              >
                <Plus className="size-3 mr-1" />
                Add Tag
              </Button>
            </div>

            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-muted text-foreground border border-border"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="text-muted-foreground hover:text-foreground text-xs"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* 10. NOTES / DESCRIPTION */}
          <div className="space-y-2">
            <Label className="text-muted-foreground text-sm font-medium">
              Additional Notes
            </Label>
            <Textarea
              placeholder="e.g. Key selling points, possession ready, owner meeting details..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="bg-muted border-border text-foreground resize-none text-sm placeholder:text-muted-foreground"
            />
          </div>

          {/* DYNAMIC CUSTOM FIELDS */}
          {customFields.length > 0 && (
            <div className="space-y-3 pt-3 border-t border-border">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                Custom Fields ({customFields.length})
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {customFields.map((field) => {
                  const val = customValues[field.field_name] || '';
                  const opts =
                    (field.field_options as { options?: string[] })?.options || [];
                  return (
                    <div key={field.id} className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">
                        {field.field_name}
                      </Label>
                      {field.field_type === 'select' ? (
                        <Select
                          value={val || undefined}
                          onValueChange={(v) =>
                            setCustomValues((prev) => ({
                              ...prev,
                              [field.field_name]: v ?? '',
                            }))
                          }
                        >
                          <SelectTrigger className="w-full bg-muted border-border text-foreground text-xs h-9">
                            <SelectValue placeholder={`Select ${field.field_name}`} />
                          </SelectTrigger>
                          <SelectContent>
                            {opts.map((opt) => (
                              <SelectItem key={opt} value={opt} className="text-xs">
                                {opt}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : field.field_type === 'number' ? (
                        <Input
                          type="number"
                          value={val}
                          onChange={(e) =>
                            setCustomValues((prev) => ({
                              ...prev,
                              [field.field_name]: e.target.value,
                            }))
                          }
                          placeholder={field.field_name}
                          className="bg-muted border-border text-foreground text-xs h-9"
                        />
                      ) : field.field_type === 'date' ? (
                        <Input
                          type="date"
                          value={val}
                          onChange={(e) =>
                            setCustomValues((prev) => ({
                              ...prev,
                              [field.field_name]: e.target.value,
                            }))
                          }
                          className="bg-muted border-border text-foreground text-xs h-9"
                        />
                      ) : (
                        <Input
                          value={val}
                          onChange={(e) =>
                            setCustomValues((prev) => ({
                              ...prev,
                              [field.field_name]: e.target.value,
                            }))
                          }
                          placeholder={field.field_name}
                          className="bg-muted border-border text-foreground text-xs h-9"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* MODAL FOOTER - Matches ContactForm perfectly */}
          <DialogFooter className="bg-popover border-border pt-2 border-t mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
              className="border-border text-muted-foreground hover:bg-muted"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : isEdit ? (
                'Save Changes'
              ) : (
                'Add Property'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
