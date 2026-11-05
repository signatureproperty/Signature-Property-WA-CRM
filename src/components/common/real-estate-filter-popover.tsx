'use client';

import { useState } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SlidersHorizontal, X, RotateCcw } from 'lucide-react';
import {
  type RealEstateFilters,
  INITIAL_FILTERS,
  countActiveFilters,
} from '@/lib/real-estate/filter-utils';
import type { Tag } from '@/types';

const PROPERTY_TYPES = [
  'House',
  'Plot',
  'Commercial',
  'Apartment',
  'Agricultural Land',
  'Building',
  'Other',
] as const;

const SIZE_UNITS = ['Marla', 'Kanal', 'Sq. Ft.', 'Acre', 'Maraba'] as const;

interface RealEstateFilterPopoverProps {
  filters: RealEstateFilters;
  onFiltersChange: (newFilters: RealEstateFilters) => void;
  availableCities?: string[];
  availableTags?: Tag[];
  showStatus?: boolean; // True for Listings (available / sold), false for Contacts
}

export function RealEstateFilterPopover({
  filters,
  onFiltersChange,
  availableCities = [],
  availableTags = [],
  showStatus = false,
}: RealEstateFilterPopoverProps) {
  const [open, setOpen] = useState(false);
  // Local draft state while editing inside popover
  const [draft, setDraft] = useState<RealEstateFilters>(filters);

  // Sync draft whenever popover is opened
  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setDraft(filters);
    }
    setOpen(nextOpen);
  }

  const activeCount = countActiveFilters(filters);

  function handleApply() {
    onFiltersChange(draft);
    setOpen(false);
  }

  function handleReset() {
    const cleared = { ...INITIAL_FILTERS };
    setDraft(cleared);
    onFiltersChange(cleared);
    setOpen(false);
  }

  function toggleTag(tagId: string) {
    const prev = draft.tagIds || [];
    const next = prev.includes(tagId)
      ? prev.filter((id) => id !== tagId)
      : [...prev, tagId];
    setDraft({ ...draft, tagIds: next });
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            className={`border-border hover:bg-muted shrink-0 text-xs h-9 ${
              activeCount > 0
                ? 'text-foreground font-medium border-primary/40 bg-primary/5'
                : 'text-muted-foreground'
            }`}
          />
        }
      >
        <SlidersHorizontal className="size-3.5 mr-1.5" />
        Filters
        {activeCount > 0 && (
          <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-primary px-1.5 py-0.2 text-[10px] font-semibold text-primary-foreground">
            {activeCount}
          </span>
        )}
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="w-[92vw] sm:w-[450px] max-h-[82vh] overflow-y-auto p-4 space-y-4 bg-popover border-border text-popover-foreground shadow-xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/70 pb-2.5">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="size-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Filter Records</h3>
          </div>
          {activeCount > 0 && (
            <button
              onClick={handleReset}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="size-3" />
              Reset All
            </button>
          )}
        </div>

        {/* Form Controls */}
        <div className="space-y-3.5 text-xs">
          {/* Property Type */}
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">Property Type</Label>
            <Select
              value={draft.propertyType || 'all'}
              onValueChange={(val) => setDraft({ ...draft, propertyType: val ?? 'all' })}
            >
              <SelectTrigger className="w-full h-8 bg-muted border-border text-foreground text-xs">
                <SelectValue placeholder="All Property Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">
                  All Property Types
                </SelectItem>
                {PROPERTY_TYPES.map((type) => (
                  <SelectItem key={type} value={type} className="text-xs">
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* City & Area */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">City</Label>
              {availableCities.length > 0 ? (
                <Select
                  value={draft.city || 'all'}
                  onValueChange={(val) => setDraft({ ...draft, city: val ?? 'all' })}
                >
                  <SelectTrigger className="w-full h-8 bg-muted border-border text-foreground text-xs">
                    <SelectValue placeholder="All Cities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">
                      All Cities
                    </SelectItem>
                    {availableCities.map((city) => (
                      <SelectItem key={city} value={city} className="text-xs">
                        {city}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={draft.city === 'all' ? '' : draft.city}
                  onChange={(e) => setDraft({ ...draft, city: e.target.value })}
                  placeholder="e.g. Lahore, Islamabad"
                  className="h-8 bg-muted border-border text-foreground text-xs placeholder:text-muted-foreground"
                />
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Area / Location</Label>
              <Input
                value={draft.area}
                onChange={(e) => setDraft({ ...draft, area: e.target.value })}
                placeholder="e.g. Samanabad, DHA"
                className="h-8 bg-muted border-border text-foreground text-xs placeholder:text-muted-foreground"
              />
            </div>
          </div>

          {/* Status (For Listings) */}
          {showStatus && (
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Listing Status</Label>
              <Select
                value={draft.status || 'all'}
                onValueChange={(val) => setDraft({ ...draft, status: val ?? 'all' })}
              >
                <SelectTrigger className="w-full h-8 bg-muted border-border text-foreground text-xs">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">
                    All Statuses
                  </SelectItem>
                  <SelectItem value="available" className="text-xs">
                    Available
                  </SelectItem>
                  <SelectItem value="sold" className="text-xs">
                    Sold
                  </SelectItem>
                  <SelectItem value="under_offer" className="text-xs">
                    Under Offer
                  </SelectItem>
                  <SelectItem value="rented" className="text-xs">
                    Rented
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Demand / Budget Range */}
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">Price / Demand / Budget</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                value={draft.minPrice}
                onChange={(e) => setDraft({ ...draft, minPrice: e.target.value })}
                placeholder="Min (e.g. 50 Lac, 1 Cr)"
                className="h-8 bg-muted border-border text-foreground text-xs placeholder:text-muted-foreground"
              />
              <Input
                value={draft.maxPrice}
                onChange={(e) => setDraft({ ...draft, maxPrice: e.target.value })}
                placeholder="Max (e.g. 2.5 Cr)"
                className="h-8 bg-muted border-border text-foreground text-xs placeholder:text-muted-foreground"
              />
            </div>
          </div>

          {/* Size Range with Unit */}
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">Property Size Range</Label>
            <div className="flex gap-2">
              <Input
                value={draft.minSize}
                onChange={(e) => setDraft({ ...draft, minSize: e.target.value })}
                placeholder="Min Size (e.g. 5)"
                className="h-8 bg-muted border-border text-foreground text-xs placeholder:text-muted-foreground flex-1"
              />
              <Input
                value={draft.maxSize}
                onChange={(e) => setDraft({ ...draft, maxSize: e.target.value })}
                placeholder="Max Size (e.g. 10)"
                className="h-8 bg-muted border-border text-foreground text-xs placeholder:text-muted-foreground flex-1"
              />
              <Select
                value={draft.sizeUnit || 'Marla'}
                onValueChange={(val) => setDraft({ ...draft, sizeUnit: val ?? 'Marla' })}
              >
                <SelectTrigger className="w-[95px] h-8 bg-muted border-border text-foreground text-xs shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SIZE_UNITS.map((unit) => (
                    <SelectItem key={unit} value={unit} className="text-xs">
                      {unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tags */}
          {availableTags.length > 0 && (
            <div className="space-y-1.5 pt-1 border-t border-border/60">
              <Label className="text-muted-foreground text-xs">Tags</Label>
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1">
                {availableTags.map((tag) => {
                  const selected = (draft.tagIds || []).includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer ${
                        selected
                          ? 'ring-2 ring-primary ring-offset-1 ring-offset-border'
                          : 'opacity-65 hover:opacity-100'
                      }`}
                      style={{
                        backgroundColor: tag.color + '25',
                        color: tag.color,
                        borderColor: tag.color,
                      }}
                    >
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border/70 pt-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="text-xs text-muted-foreground hover:text-foreground h-8"
          >
            Reset
          </Button>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              className="text-xs h-8 border-border"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleApply}
              className="text-xs h-8 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
            >
              Apply Filters
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Renders active filter pills / chips below the search bar.
 * Gives 1-click removal of individual filter criteria.
 */
interface RealEstateActiveFilterPillsProps {
  filters: RealEstateFilters;
  onRemoveFilter: (key: keyof RealEstateFilters, value?: string) => void;
  onClearAll: () => void;
  availableTags?: Tag[];
}

export function RealEstateActiveFilterPills({
  filters,
  onRemoveFilter,
  onClearAll,
  availableTags = [],
}: RealEstateActiveFilterPillsProps) {
  const activeCount = countActiveFilters(filters);
  if (activeCount === 0) return null;

  const tagMap = new Map(availableTags.map((t) => [t.id, t]));

  return (
    <div className="flex flex-wrap items-center gap-1.5 pt-1">
      {/* Property Type Pill */}
      {filters.propertyType && filters.propertyType !== 'all' && (
        <Badge
          variant="outline"
          className="bg-muted/60 border-border text-foreground text-xs gap-1 font-normal"
        >
          <span>Type: {filters.propertyType}</span>
          <button
            onClick={() => onRemoveFilter('propertyType')}
            className="hover:opacity-75"
          >
            <X className="size-3" />
          </button>
        </Badge>
      )}

      {/* City Pill */}
      {filters.city && filters.city !== 'all' && (
        <Badge
          variant="outline"
          className="bg-muted/60 border-border text-foreground text-xs gap-1 font-normal"
        >
          <span>City: {filters.city}</span>
          <button onClick={() => onRemoveFilter('city')} className="hover:opacity-75">
            <X className="size-3" />
          </button>
        </Badge>
      )}

      {/* Area Pill */}
      {filters.area && (
        <Badge
          variant="outline"
          className="bg-muted/60 border-border text-foreground text-xs gap-1 font-normal"
        >
          <span>Area: {filters.area}</span>
          <button onClick={() => onRemoveFilter('area')} className="hover:opacity-75">
            <X className="size-3" />
          </button>
        </Badge>
      )}

      {/* Status Pill */}
      {filters.status && filters.status !== 'all' && (
        <Badge
          variant="outline"
          className="bg-muted/60 border-border text-foreground text-xs gap-1 font-normal"
        >
          <span className="capitalize">Status: {filters.status}</span>
          <button onClick={() => onRemoveFilter('status')} className="hover:opacity-75">
            <X className="size-3" />
          </button>
        </Badge>
      )}

      {/* Price / Budget Range Pill */}
      {(filters.minPrice || filters.maxPrice) && (
        <Badge
          variant="outline"
          className="bg-muted/60 border-border text-foreground text-xs gap-1 font-normal"
        >
          <span>
            Price: {filters.minPrice || '0'} - {filters.maxPrice || 'Any'}
          </span>
          <button
            onClick={() => {
              onRemoveFilter('minPrice');
              onRemoveFilter('maxPrice');
            }}
            className="hover:opacity-75"
          >
            <X className="size-3" />
          </button>
        </Badge>
      )}

      {/* Size Range Pill */}
      {(filters.minSize || filters.maxSize) && (
        <Badge
          variant="outline"
          className="bg-muted/60 border-border text-foreground text-xs gap-1 font-normal"
        >
          <span>
            Size: {filters.minSize || '0'} - {filters.maxSize || 'Any'}{' '}
            {filters.sizeUnit}
          </span>
          <button
            onClick={() => {
              onRemoveFilter('minSize');
              onRemoveFilter('maxSize');
            }}
            className="hover:opacity-75"
          >
            <X className="size-3" />
          </button>
        </Badge>
      )}

      {/* Tag Pills */}
      {filters.tagIds &&
        filters.tagIds.map((tId) => {
          const tag = tagMap.get(tId);
          if (!tag) return null;
          return (
            <Badge
              key={tId}
              variant="outline"
              className="text-xs gap-1 font-normal"
              style={{
                backgroundColor: tag.color + '20',
                color: tag.color,
                borderColor: tag.color + '60',
              }}
            >
              <span>{tag.name}</span>
              <button
                onClick={() => onRemoveFilter('tagIds', tId)}
                className="hover:opacity-75"
              >
                <X className="size-3" />
              </button>
            </Badge>
          );
        })}

      {/* Clear All Link */}
      <button
        onClick={onClearAll}
        className="text-xs text-muted-foreground hover:text-foreground px-1 underline cursor-pointer"
      >
        Clear all
      </button>
    </div>
  );
}

