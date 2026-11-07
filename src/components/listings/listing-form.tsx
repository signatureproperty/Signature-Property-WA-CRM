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
import { Loader2, Plus, X } from 'lucide-react';
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

  // Editable Serial No (e.g. P-1, L-1)
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
  const [columnSettings, setColumnSettings] = useState<
    Record<string, { label: string; is_deleted: boolean }>
  >({});

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
        setIsTitleManual(true);
        setContactNumber(listing.contact_number || '');
        setPropertyType(listing.property_type || 'House');
        setStatus(listing.status === 'sold' ? 'sold' : 'available');
        setCity(listing.city || 'Lahore');
        setArea(listing.area || '');
        setAddress(listing.address || '');

        if (listing.size) {
          const match = listing.size.match(/^([\d.]+)\s*(.*)$/);
          if (match) {
            setSizeValue(match[1]);
            const matchedUnit = SIZE_UNITS.find(
              (u) => u.toLowerCase() === match[2].trim().toLowerCase()
            );
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
        setDescription(listing.description || listing.notes || '');
        setTags(listing.tags || []);
      } else {
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

        if (account?.id) {
          supabase
            .from('property_listings')
            .select('*', { count: 'exact', head: true })
            .eq('account_id', account.id)
            .then(({ count }) => {
              const nextNum = (count ?? 0) + 1;
              setSerialNo(`P-${nextNum}`);
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

    const finalTitle =
      title.trim() ||
      buildAutoTitle(sizeValue, sizeUnit, propertyType, area) ||
      `Property ${serialNo || ''}`;
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
      <DialogContent className="sm:max-w-xl max-h-[88vh] overflow-y-auto border-border bg-card text-foreground">
        <DialogHeader>
          <DialogTitle className="text-foreground text-base">
            {isEdit ? t('editTitle') : t('addTitle')}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">
            {isEdit
              ? 'Update this property listing’s specs, pricing, and availability.'
              : 'Add a new property or plot listing to your real estate inventory.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3.5 pt-2">
          {/* Row 1: Sr No & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="lf-serial" className="text-muted-foreground text-xs">
                {columnSettings['serial_no']?.label || 'Sr No'}
              </Label>
              <Input
                id="lf-serial"
                value={serialNo}
                onChange={(e) => setSerialNo(e.target.value)}
                placeholder="e.g. P-1 or L-1"
                className="bg-muted border-border font-mono text-xs text-foreground placeholder:text-muted-foreground h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lf-phone" className="text-muted-foreground text-xs">
                {columnSettings['contact_number']?.label || 'Contact Phone'}
              </Label>
              <Input
                id="lf-phone"
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
                placeholder="e.g. 03278572797"
                className="bg-muted border-border font-mono text-xs text-foreground placeholder:text-muted-foreground h-9"
              />
            </div>
          </div>

          {/* Row 2: Property Title & Listing Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="lf-title" className="text-muted-foreground text-xs">
                  {columnSettings['title']?.label || 'Property Title'}{' '}
                  <span className="text-red-400">*</span>
                </Label>
                {isTitleManual && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsTitleManual(false);
                      setTitle(buildAutoTitle(sizeValue, sizeUnit, propertyType, area));
                    }}
                    className="text-[11px] text-primary hover:underline cursor-pointer"
                  >
                    Reset Auto
                  </button>
                )}
              </div>
              <Input
                id="lf-title"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setIsTitleManual(true);
                }}
                placeholder="e.g. 5 Marla House in Samanabad"
                className="bg-muted border-border text-xs text-foreground placeholder:text-muted-foreground h-9 font-medium"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">
                {columnSettings['status']?.label || 'Listing Status'}
              </Label>
              <Select
                value={status}
                onValueChange={(val) =>
                  setStatus((val as PropertyListingStatus) || 'available')
                }
              >
                <SelectTrigger className="bg-muted border-border text-xs text-foreground h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 3: City & Area / Society */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="lf-city" className="text-muted-foreground text-xs">
                City
              </Label>
              <Input
                id="lf-city"
                placeholder="e.g. Lahore, Islamabad"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="bg-muted border-border text-xs text-foreground placeholder:text-muted-foreground h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lf-area" className="text-muted-foreground text-xs">
                Area / Society <span className="text-red-400">*</span>
              </Label>
              <Input
                id="lf-area"
                placeholder="e.g. Samanabad, DHA Phase 6"
                value={area}
                onChange={(e) => {
                  setArea(e.target.value);
                  updateAutoTitle(sizeValue, sizeUnit, propertyType, e.target.value);
                }}
                className="bg-muted border-border text-xs text-foreground placeholder:text-muted-foreground h-9"
                required
              />
            </div>
          </div>

          {/* Row 4: Property Type & Size with Unit */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Property Type</Label>
              <Select
                value={propertyType}
                onValueChange={(val) => {
                  const nextType = val || 'House';
                  setPropertyType(nextType);
                  updateAutoTitle(sizeValue, sizeUnit, nextType, area);
                }}
              >
                <SelectTrigger className="bg-muted border-border text-xs text-foreground h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROPERTY_TYPES.map((type) => (
                    <SelectItem key={type} value={type} className="text-xs">
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">
                Size <span className="text-red-400">*</span>
              </Label>
              <div className="flex gap-1.5">
                <Input
                  type="text"
                  placeholder="e.g. 5 or 7.5"
                  value={sizeValue}
                  onChange={(e) => {
                    setSizeValue(e.target.value);
                    updateAutoTitle(e.target.value, sizeUnit, propertyType, area);
                  }}
                  className="bg-muted border-border text-xs text-foreground placeholder:text-muted-foreground flex-1 h-9"
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
                  <SelectTrigger className="w-24 bg-muted border-border text-xs text-foreground font-medium h-9">
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
          </div>

          {/* Row 5: Demand & Potential Rent */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {!columnSettings['demand_price']?.is_deleted && (
              <div className="space-y-1.5">
                <Label htmlFor="lf-demand" className="text-muted-foreground text-xs">
                  {columnSettings['demand_price']?.label || 'Demand / Price'}
                </Label>
                <Input
                  id="lf-demand"
                  placeholder="e.g. 2.2 Cr, 85 Lac"
                  value={demandPrice}
                  onChange={(e) => setDemandPrice(e.target.value)}
                  className="bg-muted border-border text-xs text-foreground font-semibold placeholder:text-muted-foreground h-9"
                />
              </div>
            )}
            {!columnSettings['potential_rent']?.is_deleted && (
              <div className="space-y-1.5">
                <Label htmlFor="lf-rent" className="text-muted-foreground text-xs">
                  {columnSettings['potential_rent']?.label || 'Potential Rent'}
                </Label>
                <Input
                  id="lf-rent"
                  placeholder="e.g. 45,000 / month"
                  value={potentialRent}
                  onChange={(e) => setPotentialRent(e.target.value)}
                  className="bg-muted border-border text-xs text-foreground placeholder:text-muted-foreground h-9"
                />
              </div>
            )}
          </div>

          {/* Row 6: Dimensions & Storey */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {!columnSettings['storey']?.is_deleted && (
              <div className="space-y-1.5">
                <Label htmlFor="lf-storey" className="text-muted-foreground text-xs">
                  {columnSettings['storey']?.label || 'Storey / Floors'}
                </Label>
                <Input
                  id="lf-storey"
                  placeholder="e.g. Double Storey"
                  value={storey}
                  onChange={(e) => setStorey(e.target.value)}
                  className="bg-muted border-border text-xs text-foreground placeholder:text-muted-foreground h-9"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="lf-front" className="text-muted-foreground text-xs">
                Front Dimension
              </Label>
              <Input
                id="lf-front"
                placeholder="e.g. 25 ft"
                value={frontDimension}
                onChange={(e) => setFrontDimension(e.target.value)}
                className="bg-muted border-border text-xs text-foreground placeholder:text-muted-foreground h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lf-length" className="text-muted-foreground text-xs">
                Length Dimension
              </Label>
              <Input
                id="lf-length"
                placeholder="e.g. 50 ft"
                value={lengthDimension}
                onChange={(e) => setLengthDimension(e.target.value)}
                className="bg-muted border-border text-xs text-foreground placeholder:text-muted-foreground h-9"
              />
            </div>
          </div>

          {/* Row 7: Utilities & Documents */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {!columnSettings['utilities']?.is_deleted && (
              <div className="space-y-1.5">
                <Label htmlFor="lf-utilities" className="text-muted-foreground text-xs">
                  {columnSettings['utilities']?.label || 'Utilities'}
                </Label>
                <Input
                  id="lf-utilities"
                  placeholder="e.g. Electricity, Gas, Water"
                  value={utilities}
                  onChange={(e) => setUtilities(e.target.value)}
                  className="bg-muted border-border text-xs text-foreground placeholder:text-muted-foreground h-9"
                />
              </div>
            )}
            {!columnSettings['documents']?.is_deleted && (
              <div className="space-y-1.5">
                <Label htmlFor="lf-docs" className="text-muted-foreground text-xs">
                  {columnSettings['documents']?.label || 'Legal Documents'}
                </Label>
                <Input
                  id="lf-docs"
                  placeholder="e.g. Registry Inteqal, Transfer"
                  value={documents}
                  onChange={(e) => setDocuments(e.target.value)}
                  className="bg-muted border-border text-xs text-foreground placeholder:text-muted-foreground h-9"
                />
              </div>
            )}
          </div>

          {/* Row 8: Full Address */}
          <div className="space-y-1.5">
            <Label htmlFor="lf-address" className="text-muted-foreground text-xs">
              Address
            </Label>
            <Input
              id="lf-address"
              placeholder="e.g. House 14, Street 2, Near Farooq Hospital"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="bg-muted border-border text-xs text-foreground placeholder:text-muted-foreground h-9"
            />
          </div>

          {/* Row 9: Notes / Description */}
          <div className="space-y-1.5">
            <Label htmlFor="lf-desc" className="text-muted-foreground text-xs">
              Notes / Description
            </Label>
            <Textarea
              id="lf-desc"
              rows={2}
              placeholder="Additional remarks, owner details, or key highlights..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-muted border-border text-xs text-foreground placeholder:text-muted-foreground resize-none"
            />
          </div>

          {/* Row 10: Tags */}
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">Tags</Label>
            <div className="flex gap-1.5">
              <Input
                placeholder="Add tag and click +"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                className="bg-muted border-border text-xs text-foreground placeholder:text-muted-foreground h-9"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddTag}
                className="h-9 px-3 border-border text-xs"
              >
                <Plus className="size-3.5 mr-1" />
                Add
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-muted text-foreground border border-border"
                  >
                    {t}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(t)}
                      className="text-muted-foreground hover:text-red-400 cursor-pointer"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Row 11: Dynamic Custom Fields */}
          {customFields.length > 0 && (
            <div className="border-t border-border pt-3 space-y-2.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Custom Fields
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {customFields.map((field) => {
                  const opts = (
                    field.field_options as { options?: string[] } | null
                  )?.options;
                  return (
                    <div key={field.id} className="space-y-1.5">
                      <Label className="text-muted-foreground text-xs">
                        {field.field_name}
                      </Label>
                      {field.field_type === 'select' && Array.isArray(opts) ? (
                        <Select
                          value={customValues[field.field_name] || ''}
                          onValueChange={(val) =>
                            setCustomValues((prev) => ({
                              ...prev,
                              [field.field_name]: val ?? '',
                            }))
                          }
                        >
                          <SelectTrigger className="bg-muted border-border text-xs text-foreground h-9 w-full">
                            <SelectValue placeholder="Select..." />
                          </SelectTrigger>
                          <SelectContent>
                            {opts.map((op) => (
                              <SelectItem key={op} value={op} className="text-xs">
                                {op}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          type={field.field_type === 'number' ? 'number' : 'text'}
                          value={customValues[field.field_name] || ''}
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

          {/* MODAL FOOTER */}
          <DialogFooter className="border-t border-border pt-3 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
              className="border-border text-muted-foreground hover:bg-muted text-xs h-9"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs h-9"
            >
              {saving && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
              {isEdit ? 'Save Changes' : 'Add Property'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
