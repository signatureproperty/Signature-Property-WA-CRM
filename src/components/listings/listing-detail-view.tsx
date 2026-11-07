'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import type { PropertyListing, PropertyListingStatus, CustomField } from '@/types';
import { formatDateCompact } from '@/lib/columns/column-settings';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Building2,
  Phone,
  Copy,
  Check,
  Loader2,
  Trash2,
  Share2,
  CheckCircle2,
  Save,
  Plus,
  X,
  MapPin,
  Tag as TagIcon,
} from 'lucide-react';

interface ListingDetailViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listing: PropertyListing | null;
  onEdit?: (listing: PropertyListing) => void;
  onDelete?: (listing: PropertyListing) => void;
  onStatusChange?: (listingId: string, newStatus: PropertyListingStatus) => void;
  onUpdated?: () => void;
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

const STATUS_BADGES: Record<
  PropertyListingStatus,
  { label: string; className: string }
> = {
  available: {
    label: 'Available',
    className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  },
  under_offer: {
    label: 'Under Offer',
    className: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  },
  sold: {
    label: 'Sold',
    className: 'bg-red-500/10 text-red-400 border-red-500/30',
  },
  rented: {
    label: 'Rented',
    className: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  },
};

export function ListingDetailView({
  open,
  onOpenChange,
  listing,
  onDelete,
  onStatusChange,
  onUpdated,
}: ListingDetailViewProps) {
  const supabase = createClient();
  const { account } = useAuth();

  const [copiedPhone, setCopiedPhone] = useState(false);
  const [copyingSummary, setCopyingSummary] = useState(false);
  const [savingDetails, setSavingDetails] = useState(false);
  const [savingCustom, setSavingCustom] = useState(false);

  // Editable fields
  const [serialNo, setSerialNo] = useState('');
  const [title, setTitle] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [status, setStatus] = useState<PropertyListingStatus>('available');
  const [city, setCity] = useState('');
  const [area, setArea] = useState('');
  const [address, setAddress] = useState('');
  const [propertyType, setPropertyType] = useState('House');
  const [sizeValue, setSizeValue] = useState('');
  const [sizeUnit, setSizeUnit] = useState<SizeUnit>('Marla');
  const [demandPrice, setDemandPrice] = useState('');
  const [potentialRent, setPotentialRent] = useState('');
  const [frontDimension, setFrontDimension] = useState('');
  const [lengthDimension, setLengthDimension] = useState('');
  const [storey, setStorey] = useState('');
  const [utilities, setUtilities] = useState('');
  const [documents, setDocuments] = useState('');
  const [description, setDescription] = useState('');

  // Tags
  const [tags, setTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');

  // Custom Fields
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customValues, setCustomValues] = useState<Record<string, string>>({});

  // Sync form state when listing changes
  useEffect(() => {
    if (listing && open) {
      setSerialNo(listing.serial_no || '');
      setTitle(listing.title || '');
      setContactNumber(listing.contact_number || '');
      setStatus(listing.status || 'available');
      setCity(listing.city || '');
      setArea(listing.area || '');
      setAddress(listing.address || '');
      setPropertyType(listing.property_type || 'House');

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

      setDemandPrice(listing.demand_price || '');
      setPotentialRent(listing.potential_rent || '');
      setFrontDimension(listing.front_dimension || '');
      setLengthDimension(listing.length_dimension || '');
      setStorey(listing.storey || '');
      setUtilities(listing.utilities || '');
      setDocuments(listing.documents || '');
      setDescription(listing.description || listing.notes || '');
      setTags(listing.tags || []);
      setCustomValues((listing.custom_fields as Record<string, string>) || {});
      setNewTagInput('');

      // Fetch dynamic custom columns for listings
      if (account?.id) {
        supabase
          .from('custom_fields')
          .select('*')
          .eq('account_id', account.id)
          .eq('entity_type', 'listing')
          .order('field_name')
          .then(({ data }) => {
            setCustomFields((data as CustomField[]) || []);
          });
      }
    }
  }, [listing, open, account?.id, supabase]);

  if (!listing) return null;

  const statusInfo = STATUS_BADGES[status] || STATUS_BADGES.available;

  function generateWhatsAppSummary(): string {
    const lines = [
      `🏡 *[${serialNo || listing?.serial_no || 'Property'}] ${title || listing?.title}*`,
      `🏢 *Type:* ${propertyType || listing?.property_type || 'Property'}`,
      `📍 *Location:* ${[area || listing?.area, city || listing?.city].filter(Boolean).join(', ')}`,
    ];

    const currentSize = sizeValue.trim() ? `${sizeValue.trim()} ${sizeUnit}` : listing?.size;
    if (currentSize) lines.push(`📐 *Size:* ${currentSize}`);
    if (frontDimension || lengthDimension) {
      lines.push(
        `📏 *Dimensions:* Front ${frontDimension || '-'} × Length ${lengthDimension || '-'}`
      );
    }
    if (storey) lines.push(`🏗️ *Storey:* ${storey}`);
    if (demandPrice) lines.push(`💰 *Demand:* ${demandPrice}`);
    if (potentialRent) lines.push(`📈 *Potential Rent:* ${potentialRent}`);
    if (utilities) lines.push(`⚡ *Utilities:* ${utilities}`);
    if (documents) lines.push(`📜 *Documents:* ${documents}`);
    if (address) lines.push(`📌 *Address:* ${address}`);
    if (description) lines.push(`\n📝 *Notes:* ${description}`);

    lines.push('\n📞 *For more details & visit, contact us on WhatsApp!*');
    return lines.join('\n');
  }

  async function copyPhone() {
    if (!contactNumber) return;
    await navigator.clipboard.writeText(contactNumber);
    setCopiedPhone(true);
    toast.success('Contact number copied!');
    setTimeout(() => setCopiedPhone(false), 2000);
  }

  async function handleShareWhatsApp() {
    const text = generateWhatsAppSummary();
    try {
      await navigator.clipboard.writeText(text);
      setCopyingSummary(true);
      toast.success('Property details copied to clipboard ready for WhatsApp!');
      setTimeout(() => setCopyingSummary(false), 2000);
    } catch {
      toast.error('Could not copy to clipboard.');
    }
  }

  async function handleSaveDetails() {
    if (!listing?.id) return;
    setSavingDetails(true);

    const formattedSize = sizeValue.trim() ? `${sizeValue.trim()} ${sizeUnit}` : null;

    try {
      const { error } = await supabase
        .from('property_listings')
        .update({
          serial_no: serialNo.trim() || null,
          title: title.trim() || `Property ${serialNo || ''}`,
          contact_number: contactNumber.trim() || null,
          status,
          city: city.trim() || null,
          area: area.trim() || null,
          address: address.trim() || null,
          property_type: propertyType || null,
          size: formattedSize,
          demand_price: demandPrice.trim() || null,
          potential_rent: potentialRent.trim() || null,
          front_dimension: frontDimension.trim() || null,
          length_dimension: lengthDimension.trim() || null,
          storey: storey.trim() || null,
          utilities: utilities.trim() || null,
          documents: documents.trim() || null,
          description: description.trim() || null,
          notes: description.trim() || null,
          tags,
          updated_at: new Date().toISOString(),
        })
        .eq('id', listing.id);

      if (error) throw error;

      toast.success('Property listing updated successfully!');
      onUpdated?.();
    } catch (err: unknown) {
      console.error('Error updating listing:', err);
      toast.error('Failed to update listing.');
    } finally {
      setSavingDetails(false);
    }
  }

  async function handleSaveCustomFields() {
    if (!listing?.id) return;
    setSavingCustom(true);
    try {
      const { error } = await supabase
        .from('property_listings')
        .update({
          custom_fields: customValues,
          updated_at: new Date().toISOString(),
        })
        .eq('id', listing.id);

      if (error) throw error;
      toast.success('Custom fields saved!');
      onUpdated?.();
    } catch (err) {
      console.error('Error updating custom fields:', err);
      toast.error('Failed to save custom fields.');
    } finally {
      setSavingCustom(false);
    }
  }

  function handleAddTag() {
    const trimmed = newTagInput.trim();
    if (!trimmed) return;
    if (!tags.includes(trimmed)) {
      const nextTags = [...tags, trimmed];
      setTags(nextTags);
      // Auto-save tags to listing
      supabase
        .from('property_listings')
        .update({ tags: nextTags, updated_at: new Date().toISOString() })
        .eq('id', listing!.id)
        .then(() => onUpdated?.());
    }
    setNewTagInput('');
  }

  function handleRemoveTag(tagToRemove: string) {
    const nextTags = tags.filter((t) => t !== tagToRemove);
    setTags(nextTags);
    supabase
      .from('property_listings')
      .update({ tags: nextTags, updated_at: new Date().toISOString() })
      .eq('id', listing!.id)
      .then(() => onUpdated?.());
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="bg-card border-border text-foreground sm:max-w-xl w-full p-0 flex flex-col h-full"
      >
        {/* HEADER */}
        <SheetHeader className="p-4 border-b border-border/60 bg-muted/20">
          <div className="flex items-start gap-3">
            <div className="size-11 rounded-lg bg-primary/10 border border-border flex items-center justify-center shrink-0 text-primary">
              <Building2 className="size-5" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {serialNo && (
                  <span className="font-mono text-xs font-semibold text-primary px-2 py-0.5 rounded bg-primary/10 border border-primary/20">
                    {serialNo}
                  </span>
                )}
                <Badge className={`border text-xs px-2.5 py-0.5 ${statusInfo.className}`}>
                  {statusInfo.label}
                </Badge>
                <Badge variant="secondary" className="text-xs font-normal">
                  {propertyType || 'Property'}
                </Badge>
              </div>

              <SheetTitle className="text-foreground text-base font-bold truncate mt-1">
                {title || 'Property Listing'}
              </SheetTitle>

              <SheetDescription className="text-muted-foreground text-xs mt-0.5 flex items-center gap-1.5 flex-wrap">
                <MapPin className="size-3 text-emerald-500 shrink-0" />
                {[area, city].filter(Boolean).join(', ') || 'No area set'}
                {listing.created_at && (
                  <span className="text-muted-foreground/70">
                    · Entered on {formatDateCompact(listing.created_at)}
                  </span>
                )}
              </SheetDescription>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-border/40">
            <div className="flex items-center gap-2">
              {contactNumber ? (
                <button
                  type="button"
                  onClick={copyPhone}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground bg-muted/60 hover:bg-muted px-2.5 py-1.5 rounded-md border border-border transition-colors cursor-pointer"
                >
                  <Phone className="size-3 text-primary" />
                  <span className="font-mono">{contactNumber}</span>
                  {copiedPhone ? (
                    <Check className="size-3 text-emerald-500" />
                  ) : (
                    <Copy className="size-3" />
                  )}
                </button>
              ) : (
                <span className="text-xs text-muted-foreground">No phone listed</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleShareWhatsApp}
                className="h-8 text-xs gap-1.5 border-border bg-emerald-600/10 text-emerald-400 hover:bg-emerald-600/20 hover:text-emerald-300"
              >
                {copyingSummary ? (
                  <>
                    <CheckCircle2 className="size-3.5 text-emerald-400" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Share2 className="size-3.5" />
                    Share WhatsApp
                  </>
                )}
              </Button>

              {onDelete && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    onOpenChange(false);
                    onDelete(listing);
                  }}
                  className="h-8 px-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  title="Delete listing"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              )}
            </div>
          </div>
        </SheetHeader>

        {/* TABS: Details, Tags, Notes, Custom Fields */}
        <Tabs defaultValue="details" className="flex-1 flex flex-col min-h-0">
          <TabsList className="bg-muted/50 border-b border-border mx-4 mt-3">
            <TabsTrigger
              value="details"
              className="data-active:bg-muted data-active:text-primary text-muted-foreground text-xs"
            >
              Details
            </TabsTrigger>
            <TabsTrigger
              value="tags"
              className="data-active:bg-muted data-active:text-primary text-muted-foreground text-xs"
            >
              Tags ({tags.length})
            </TabsTrigger>
            <TabsTrigger
              value="notes"
              className="data-active:bg-muted data-active:text-primary text-muted-foreground text-xs"
            >
              Notes
            </TabsTrigger>
            <TabsTrigger
              value="custom"
              className="data-active:bg-muted data-active:text-primary text-muted-foreground text-xs"
            >
              Custom Fields ({customFields.length})
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: DETAILS */}
          <TabsContent value="details" className="flex-1 overflow-y-auto px-4 py-3">
            <div className="space-y-3 pb-6">
              {/* Row 1: Sr No & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Sr No</Label>
                  <Input
                    value={serialNo}
                    onChange={(e) => setSerialNo(e.target.value)}
                    placeholder="e.g. P-1"
                    className="bg-muted border-border font-mono text-foreground h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Contact Number</Label>
                  <Input
                    value={contactNumber}
                    onChange={(e) => setContactNumber(e.target.value)}
                    placeholder="e.g. 03278572797"
                    className="bg-muted border-border font-mono text-foreground h-8 text-xs"
                  />
                </div>
              </div>

              {/* Row 2: Title & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Title</Label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Property Title"
                    className="bg-muted border-border text-foreground h-8 text-xs font-medium"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Status</Label>
                  <Select
                    value={status}
                    onValueChange={(val) => {
                      const nextStatus = (val as PropertyListingStatus) || 'available';
                      setStatus(nextStatus);
                      onStatusChange?.(listing.id, nextStatus);
                    }}
                  >
                    <SelectTrigger className="bg-muted border-border text-foreground h-8 text-xs w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="available" className="text-xs">
                        Available
                      </SelectItem>
                      <SelectItem value="sold" className="text-xs">
                        Sold
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Row 3: City & Area */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">City</Label>
                  <Input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="City"
                    className="bg-muted border-border text-foreground h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Area / Society</Label>
                  <Input
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    placeholder="Area"
                    className="bg-muted border-border text-foreground h-8 text-xs"
                  />
                </div>
              </div>

              {/* Row 4: Property Type & Size */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Property Type</Label>
                  <Select
                    value={propertyType}
                    onValueChange={(val) => setPropertyType(val || 'House')}
                  >
                    <SelectTrigger className="bg-muted border-border text-foreground h-8 text-xs w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROPERTY_TYPES.map((pt) => (
                        <SelectItem key={pt} value={pt} className="text-xs">
                          {pt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Size</Label>
                  <div className="flex gap-1.5">
                    <Input
                      value={sizeValue}
                      onChange={(e) => setSizeValue(e.target.value)}
                      placeholder="e.g. 5, 10"
                      className="bg-muted border-border text-foreground h-8 text-xs flex-1"
                    />
                    <Select
                      value={sizeUnit}
                      onValueChange={(val) => setSizeUnit((val as SizeUnit) || 'Marla')}
                    >
                      <SelectTrigger className="w-24 bg-muted border-border text-foreground h-8 text-xs font-medium">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Demand / Price</Label>
                  <Input
                    value={demandPrice}
                    onChange={(e) => setDemandPrice(e.target.value)}
                    placeholder="e.g. 2.2 Cr"
                    className="bg-muted border-border text-foreground h-8 text-xs font-semibold text-primary"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Potential Rent</Label>
                  <Input
                    value={potentialRent}
                    onChange={(e) => setPotentialRent(e.target.value)}
                    placeholder="e.g. 45,000"
                    className="bg-muted border-border text-foreground h-8 text-xs"
                  />
                </div>
              </div>

              {/* Row 6: Dimensions & Storey */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Storey</Label>
                  <Input
                    value={storey}
                    onChange={(e) => setStorey(e.target.value)}
                    placeholder="e.g. Double"
                    className="bg-muted border-border text-foreground h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Front Dimension</Label>
                  <Input
                    value={frontDimension}
                    onChange={(e) => setFrontDimension(e.target.value)}
                    placeholder="e.g. 25 ft"
                    className="bg-muted border-border text-foreground h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Length Dimension</Label>
                  <Input
                    value={lengthDimension}
                    onChange={(e) => setLengthDimension(e.target.value)}
                    placeholder="e.g. 50 ft"
                    className="bg-muted border-border text-foreground h-8 text-xs"
                  />
                </div>
              </div>

              {/* Row 7: Utilities & Documents */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Utilities</Label>
                  <Input
                    value={utilities}
                    onChange={(e) => setUtilities(e.target.value)}
                    placeholder="e.g. Electricity, Gas, Water"
                    className="bg-muted border-border text-foreground h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Documents</Label>
                  <Input
                    value={documents}
                    onChange={(e) => setDocuments(e.target.value)}
                    placeholder="e.g. Registry Inteqal"
                    className="bg-muted border-border text-foreground h-8 text-xs"
                  />
                </div>
              </div>

              {/* Row 8: Address */}
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Address</Label>
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Full address"
                  className="bg-muted border-border text-foreground h-8 text-xs"
                />
              </div>

              <div className="pt-2">
                <Button
                  onClick={handleSaveDetails}
                  disabled={savingDetails}
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-9 text-xs font-medium"
                >
                  {savingDetails ? (
                    <Loader2 className="size-4 animate-spin mr-1.5" />
                  ) : (
                    <Save className="size-4 mr-1.5" />
                  )}
                  Save Changes
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* TAB 2: TAGS */}
          <TabsContent value="tags" className="flex-1 overflow-y-auto px-4 py-3">
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  placeholder="Type new tag and press Enter"
                  className="bg-muted border-border text-foreground h-8 text-xs"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAddTag}
                  className="h-8 px-3 text-xs"
                >
                  <Plus className="size-3.5 mr-1" />
                  Add
                </Button>
              </div>

              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium">Assigned Tags</p>
                {tags.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No tags assigned yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((tg) => (
                      <span
                        key={tg}
                        className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md bg-muted text-foreground border border-border"
                      >
                        <TagIcon className="size-3 text-primary" />
                        {tg}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tg)}
                          className="text-muted-foreground hover:text-red-400 cursor-pointer"
                        >
                          <X className="size-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* TAB 3: NOTES */}
          <TabsContent value="notes" className="flex-1 overflow-y-auto px-4 py-3">
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Property Description & Notes</Label>
                <Textarea
                  rows={6}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Enter detailed notes, owner remarks, visit instructions..."
                  className="bg-muted border-border text-foreground text-xs resize-none"
                />
              </div>

              <Button
                size="sm"
                onClick={handleSaveDetails}
                disabled={savingDetails}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 text-xs h-9"
              >
                {savingDetails ? (
                  <Loader2 className="size-4 animate-spin mr-1.5" />
                ) : (
                  <Save className="size-4 mr-1.5" />
                )}
                Save Notes
              </Button>
            </div>
          </TabsContent>

          {/* TAB 4: CUSTOM FIELDS */}
          <TabsContent value="custom" className="flex-1 overflow-y-auto px-4 py-3">
            <div className="space-y-3 pb-6">
              {customFields.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-xs text-muted-foreground">
                    No custom fields configured for property listings.
                  </p>
                  <p className="text-[11px] text-muted-foreground/70 mt-1">
                    Manage columns to add new dynamic custom fields.
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-2.5">
                    {customFields.map((field) => {
                      const val = customValues[field.field_name] ?? '';
                      return (
                        <div key={field.id} className="space-y-1">
                          <Label className="text-muted-foreground text-xs">
                            {field.field_name}
                          </Label>
                          {field.field_type === 'select' &&
                          Array.isArray(
                            (field.field_options as { options?: string[] } | null)?.options
                          ) ? (
                            <Select
                              value={val}
                              onValueChange={(newVal) =>
                                setCustomValues((prev) => ({
                                  ...prev,
                                  [field.field_name]: newVal ?? '',
                                }))
                              }
                            >
                              <SelectTrigger className="bg-muted border-border text-foreground h-8 text-xs w-full">
                                <SelectValue placeholder="Select..." />
                              </SelectTrigger>
                              <SelectContent>
                                {(
                                  field.field_options as { options: string[] }
                                ).options.map((opt) => (
                                  <SelectItem key={opt} value={opt} className="text-xs">
                                    {opt}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
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
                              className="bg-muted border-border text-foreground h-8 text-xs"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="pt-2">
                    <Button
                      size="sm"
                      onClick={handleSaveCustomFields}
                      disabled={savingCustom}
                      className="w-full bg-primary text-primary-foreground hover:bg-primary/90 text-xs h-9"
                    >
                      {savingCustom ? (
                        <Loader2 className="size-4 animate-spin mr-1.5" />
                      ) : (
                        <Save className="size-4 mr-1.5" />
                      )}
                      Save Custom Fields
                    </Button>
                  </div>
                </>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
