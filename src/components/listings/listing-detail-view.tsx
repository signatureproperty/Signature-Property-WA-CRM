'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import type { PropertyListing, PropertyListingStatus } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Building2,
  MapPin,
  Ruler,
  DollarSign,
  FileText,
  Phone,
  Share2,
  Pencil,
  Trash2,
  CheckCircle2,
  Copy,
  ExternalLink,
} from 'lucide-react';

interface ListingDetailViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listing: PropertyListing | null;
  onEdit: (listing: PropertyListing) => void;
  onDelete: (listing: PropertyListing) => void;
  onStatusChange: (listingId: string, newStatus: PropertyListingStatus) => void;
}

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
  onEdit,
  onDelete,
  onStatusChange,
}: ListingDetailViewProps) {
  const [copying, setCopying] = useState(false);

  if (!listing) return null;

  const statusInfo = STATUS_BADGES[listing.status] || STATUS_BADGES.available;

  function generateWhatsAppSummary(): string {
    const lines = [
      `🏡 *[${listing?.serial_no || 'Property'}] ${listing?.title}*`,
      `🏢 *Type:* ${listing?.property_type || 'Property'}`,
      `📍 *Location:* ${[listing?.area, listing?.city].filter(Boolean).join(', ')}`,
    ];

    if (listing?.size) lines.push(`📐 *Size:* ${listing.size}`);
    if (listing?.front_dimension || listing?.length_dimension) {
      lines.push(
        `📏 *Dimensions:* Front ${listing.front_dimension || '-'} × Length ${listing.length_dimension || '-'}`
      );
    }
    if (listing?.storey) lines.push(`🏗️ *Storey:* ${listing.storey}`);
    if (listing?.demand_price) lines.push(`💰 *Demand:* ${listing.demand_price}`);
    if (listing?.potential_rent) lines.push(`📈 *Potential Rent:* ${listing.potential_rent}`);
    if (listing?.utilities) lines.push(`⚡ *Utilities:* ${listing.utilities}`);
    if (listing?.documents) lines.push(`📜 *Documents:* ${listing.documents}`);
    if (listing?.address) lines.push(`📌 *Address:* ${listing.address}`);
    if (listing?.description) lines.push(`\n📝 *Notes:* ${listing.description}`);

    lines.push('\n📞 *For more details & visit, contact us on WhatsApp!*');

    return lines.join('\n');
  }

  async function handleShareWhatsApp() {
    const text = generateWhatsAppSummary();
    try {
      await navigator.clipboard.writeText(text);
      setCopying(true);
      toast.success('Property details copied to clipboard ready for WhatsApp!');
      setTimeout(() => setCopying(false), 2000);
    } catch {
      toast.error('Could not copy to clipboard.');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto border-border bg-card text-foreground">
        <DialogHeader className="border-b border-border pb-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {listing.serial_no && (
                <Badge variant="outline" className="font-mono text-xs px-2 py-0.5 bg-muted">
                  {listing.serial_no}
                </Badge>
              )}
              <Badge className={`border text-xs px-2.5 py-0.5 ${statusInfo.className}`}>
                {statusInfo.label}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {listing.property_type || 'Property'}
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  onEdit(listing);
                }}
                className="gap-1.5 h-8 text-xs"
              >
                <Pencil className="size-3.5" />
                Edit
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  onDelete(listing);
                }}
                className="gap-1.5 h-8 text-xs"
              >
                <Trash2 className="size-3.5" />
                Delete
              </Button>
            </div>
          </div>

          <DialogTitle className="text-xl font-bold mt-3 text-foreground">
            {listing.title}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-1.5 text-muted-foreground text-sm">
            <MapPin className="size-3.5 text-emerald-500 shrink-0" />
            {[listing.address, listing.area, listing.city].filter(Boolean).join(', ') || 'No address provided'}
          </DialogDescription>
        </DialogHeader>

        {/* DETAILS GRID */}
        <div className="space-y-5 pt-3">
          {/* PRICE & KEY STATS BANNER */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-lg border border-border bg-muted/30">
            <div>
              <p className="text-xs text-muted-foreground">Demand / Price</p>
              <p className="text-base font-bold text-primary mt-0.5">
                {listing.demand_price || 'Price on request'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Size</p>
              <p className="text-sm font-semibold text-foreground mt-0.5">
                {listing.size || '-'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Dimensions</p>
              <p className="text-sm font-medium text-foreground mt-0.5">
                {listing.front_dimension || listing.length_dimension
                  ? `${listing.front_dimension || '-'} × ${listing.length_dimension || '-'}`
                  : '-'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Potential Rent</p>
              <p className="text-sm font-medium text-emerald-400 mt-0.5">
                {listing.potential_rent || '-'}
              </p>
            </div>
          </div>

          {/* SPECS & LEGAL DETAILS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-3 rounded-lg border border-border/80 p-3.5 bg-muted/10">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Ruler className="size-3.5 text-amber-500" />
                Property Specifications
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Property Type</span>
                  <span className="font-medium text-foreground">{listing.property_type || '-'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Storey / Floors</span>
                  <span className="font-medium text-foreground">{listing.storey || '-'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">City</span>
                  <span className="font-medium text-foreground">{listing.city || '-'}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Area / Society</span>
                  <span className="font-medium text-foreground">{listing.area || '-'}</span>
                </div>
              </div>
            </div>

            <div className="space-y-3 rounded-lg border border-border/80 p-3.5 bg-muted/10">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="size-3.5 text-purple-500" />
                Legal & Utilities
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Legal Docs</span>
                  <span className="font-medium text-foreground">{listing.documents || '-'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Utilities</span>
                  <span className="font-medium text-foreground">{listing.utilities || '-'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Contact Phone</span>
                  <span className="font-mono text-primary font-medium">{listing.contact_number || '-'}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Added Date</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(listing.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* TAGS */}
          {listing.tags && listing.tags.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {listing.tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className="text-xs bg-muted/50 border-border"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* DESCRIPTION / NOTES */}
          {listing.description && (
            <div className="space-y-1.5 p-3 rounded-lg border border-border bg-muted/20">
              <p className="text-xs font-medium text-muted-foreground">Description & Notes</p>
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                {listing.description}
              </p>
            </div>
          )}

          {/* ACTION BUTTONS & STATUS UPDATER */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border">
            {/* Quick Status Buttons */}
            <div className="flex items-center gap-1.5 w-full sm:w-auto">
              <span className="text-xs text-muted-foreground mr-1">Status:</span>
              {(['available', 'under_offer', 'sold', 'rented'] as PropertyListingStatus[]).map(
                (st) => (
                  <Button
                    key={st}
                    variant={listing.status === st ? 'default' : 'outline'}
                    size="sm"
                    className={`h-7 px-2.5 text-xs capitalize ${
                      listing.status === st ? 'bg-primary text-primary-foreground' : ''
                    }`}
                    onClick={() => onStatusChange(listing.id, st)}
                  >
                    {st.replace('_', ' ')}
                  </Button>
                )
              )}
            </div>

            {/* WhatsApp Share Button */}
            <Button
              onClick={handleShareWhatsApp}
              size="sm"
              className="w-full sm:w-auto gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
            >
              {copying ? (
                <>
                  <CheckCircle2 className="size-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Share2 className="size-4" />
                  Copy WhatsApp Summary
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

