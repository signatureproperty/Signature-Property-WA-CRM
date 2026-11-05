'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import type { PropertyListing, PropertyListingStatus } from '@/types';
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
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, X, Building2, MapPin, Ruler, DollarSign, FileText } from 'lucide-react';
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

const STATUS_OPTIONS: { value: PropertyListingStatus; label: string }[] = [
  { value: 'available', label: 'Available' },
  { value: 'under_offer', label: 'Under Offer' },
  { value: 'sold', label: 'Sold' },
  { value: 'rented', label: 'Rented' },
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

  const [saving, setSaving] = useState(false);

  // Form Fields
  const [serialNo, setSerialNo] = useState('');
  const [title, setTitle] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [propertyType, setPropertyType] = useState('House');
  const [status, setStatus] = useState<PropertyListingStatus>('available');

  const [city, setCity] = useState('');
  const [area, setArea] = useState('');
  const [address, setAddress] = useState('');

  const [size, setSize] = useState('');
  const [storey, setStorey] = useState('');
  const [frontDimension, setFrontDimension] = useState('');
  const [lengthDimension, setLengthDimension] = useState('');

  const [demandPrice, setDemandPrice] = useState('');
  const [potentialRent, setPotentialRent] = useState('');

  const [utilities, setUtilities] = useState('');
  const [documents, setDocuments] = useState('');
  const [description, setDescription] = useState('');

  // Tags
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    if (open) {
      if (listing) {
        setSerialNo(listing.serial_no || '');
        setTitle(listing.title || '');
        setContactNumber(listing.contact_number || '');
        setPropertyType(listing.property_type || 'House');
        setStatus(listing.status || 'available');
        setCity(listing.city || '');
        setArea(listing.area || '');
        setAddress(listing.address || '');
        setSize(listing.size || '');
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
        setSerialNo('');
        setTitle('');
        setContactNumber('');
        setPropertyType('House');
        setStatus('available');
        setCity('Lahore');
        setArea('');
        setAddress('');
        setSize('');
        setStorey('');
        setFrontDimension('');
        setLengthDimension('');
        setDemandPrice('');
        setPotentialRent('');
        setUtilities('');
        setDocuments('');
        setDescription('');
        setTags([]);
      }
      setTagInput('');
    }
  }, [open, listing]);

  function handleAddTag() {
    const trimmed = tagInput.trim();
    if (!trimmed) return;
    if (!tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
    }
    setTagInput('');
  }

  function handleRemoveTag(tagToRemove: string) {
    setTags(tags.filter((t) => t !== tagToRemove));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error(t('titleRequired'));
      return;
    }
    if (!account?.id) {
      toast.error('Account not loaded. Please try again.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        account_id: account.id,
        serial_no: serialNo.trim() || null,
        title: title.trim(),
        contact_number: contactNumber.trim() || null,
        property_type: propertyType,
        status,
        city: city.trim() || null,
        area: area.trim() || null,
        address: address.trim() || null,
        size: size.trim() || null,
        storey: storey.trim() || null,
        front_dimension: frontDimension.trim() || null,
        length_dimension: lengthDimension.trim() || null,
        demand_price: demandPrice.trim() || null,
        potential_rent: potentialRent.trim() || null,
        utilities: utilities.trim() || null,
        documents: documents.trim() || null,
        description: description.trim() || null,
        tags,
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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto border-border bg-card text-foreground">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary">
            <Building2 className="size-5" />
            <DialogTitle className="text-xl font-semibold">
              {listing ? t('editTitle') : t('addTitle')}
            </DialogTitle>
          </div>
          <DialogDescription className="text-muted-foreground text-sm">
            {t('desc')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 pt-2">
          {/* SECTION 1: BASIC INFORMATION */}
          <div className="space-y-4 rounded-lg border border-border/70 p-4 bg-muted/20">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Building2 className="size-4 text-primary" />
              <span>{t('basicSection')}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t('serialNo')}</Label>
                <Input
                  placeholder={t('serialNoPlaceholder')}
                  value={serialNo}
                  onChange={(e) => setSerialNo(e.target.value)}
                  className="bg-background"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs text-foreground font-medium">
                  {t('title')} <span className="text-red-500">*</span>
                </Label>
                <Input
                  placeholder={t('titlePlaceholder')}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="bg-background font-medium"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t('propertyType')}</Label>
                <Select value={propertyType} onValueChange={(val) => setPropertyType(val || 'House')}>
                  <SelectTrigger className="bg-background">
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

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t('status')}</Label>
                <Select
                  value={status}
                  onValueChange={(val) => setStatus((val as PropertyListingStatus) || 'available')}
                >
                  <SelectTrigger className="bg-background">
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

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t('contactNumber')}</Label>
                <Input
                  placeholder={t('contactNumberPlaceholder')}
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  className="bg-background font-mono text-sm"
                />
              </div>
            </div>
          </div>

          {/* SECTION 2: LOCATION & ADDRESS */}
          <div className="space-y-4 rounded-lg border border-border/70 p-4 bg-muted/20">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <MapPin className="size-4 text-emerald-500" />
              <span>{t('locationSection')}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t('city')}</Label>
                <Input
                  placeholder={t('cityPlaceholder')}
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="bg-background"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t('area')}</Label>
                <Input
                  placeholder={t('areaPlaceholder')}
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  className="bg-background"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t('address')}</Label>
              <Textarea
                placeholder={t('addressPlaceholder')}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={2}
                className="bg-background resize-none text-sm"
              />
            </div>
          </div>

          {/* SECTION 3: DIMENSIONS & SPECS */}
          <div className="space-y-4 rounded-lg border border-border/70 p-4 bg-muted/20">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Ruler className="size-4 text-amber-500" />
              <span>{t('specsSection')}</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t('size')}</Label>
                <Input
                  placeholder={t('sizePlaceholder')}
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  className="bg-background"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t('storey')}</Label>
                <Input
                  placeholder={t('storeyPlaceholder')}
                  value={storey}
                  onChange={(e) => setStorey(e.target.value)}
                  className="bg-background"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t('front')}</Label>
                <Input
                  placeholder={t('frontPlaceholder')}
                  value={frontDimension}
                  onChange={(e) => setFrontDimension(e.target.value)}
                  className="bg-background"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t('length')}</Label>
                <Input
                  placeholder={t('lengthPlaceholder')}
                  value={lengthDimension}
                  onChange={(e) => setLengthDimension(e.target.value)}
                  className="bg-background"
                />
              </div>
            </div>
          </div>

          {/* SECTION 4: FINANCIALS & DEMAND */}
          <div className="space-y-4 rounded-lg border border-border/70 p-4 bg-muted/20">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <DollarSign className="size-4 text-green-500" />
              <span>{t('financialsSection')}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-foreground font-medium">{t('demand')}</Label>
                <Input
                  placeholder={t('demandPlaceholder')}
                  value={demandPrice}
                  onChange={(e) => setDemandPrice(e.target.value)}
                  className="bg-background font-semibold text-primary"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t('potentialRent')}</Label>
                <Input
                  placeholder={t('potentialRentPlaceholder')}
                  value={potentialRent}
                  onChange={(e) => setPotentialRent(e.target.value)}
                  className="bg-background"
                />
              </div>
            </div>
          </div>

          {/* SECTION 5: UTILITIES, DOCUMENTS & NOTES */}
          <div className="space-y-4 rounded-lg border border-border/70 p-4 bg-muted/20">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <FileText className="size-4 text-purple-500" />
              <span>{t('legalSection')}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t('utilities')}</Label>
                <Input
                  placeholder={t('utilitiesPlaceholder')}
                  value={utilities}
                  onChange={(e) => setUtilities(e.target.value)}
                  className="bg-background"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t('documents')}</Label>
                <Input
                  placeholder={t('documentsPlaceholder')}
                  value={documents}
                  onChange={(e) => setDocuments(e.target.value)}
                  className="bg-background"
                />
              </div>
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">{t('tags')}</Label>
              <div className="flex items-center gap-2">
                <Input
                  placeholder={t('tagsPlaceholder')}
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  className="bg-background text-sm flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddTag}
                  disabled={!tagInput.trim()}
                >
                  <Plus className="size-3.5 mr-1" /> Add
                </Button>
              </div>

              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="gap-1 px-2.5 py-0.5 text-xs bg-muted text-foreground border border-border"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t('description')}</Label>
              <Textarea
                placeholder={t('descriptionPlaceholder')}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="bg-background resize-none text-sm"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              {saving ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  {t('savingBtn')}
                </>
              ) : (
                t('saveBtn')
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

