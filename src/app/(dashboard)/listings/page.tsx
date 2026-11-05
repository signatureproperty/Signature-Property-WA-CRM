'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import type { PropertyListing, PropertyListingStatus } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Building2,
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Pencil,
  Trash2,
  Eye,
  Share2,
  MapPin,
  Ruler,
  DollarSign,
  LayoutGrid,
  List as ListIcon,
  SlidersHorizontal,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { ListingForm } from '@/components/listings/listing-form';
import { ListingDetailView } from '@/components/listings/listing-detail-view';
import { useTranslations } from 'next-intl';

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

type ViewMode = 'table' | 'cards';

// Column toggles for table view customization
interface ColumnConfig {
  id: string;
  label: string;
  visible: boolean;
}

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: 'serial_no', label: 'Sr No', visible: true },
  { id: 'title', label: 'Title', visible: true },
  { id: 'property_type', label: 'Type', visible: true },
  { id: 'size', label: 'Size', visible: true },
  { id: 'demand_price', label: 'Demand', visible: true },
  { id: 'status', label: 'Status', visible: true },
  { id: 'area_city', label: 'City & Area', visible: true },
  { id: 'potential_rent', label: 'Potential Rent', visible: false },
  { id: 'dimensions', label: 'Dimensions', visible: false },
  { id: 'contact_number', label: 'Contact Phone', visible: false },
  { id: 'documents', label: 'Documents', visible: false },
];

export default function ListingsPage() {
  const t = useTranslations('Listings.page');
  const supabase = createClient();
  const { account } = useAuth();

  const [listings, setListings] = useState<PropertyListing[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [cityFilter, setCityFilter] = useState<string>('all');

  // View mode
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [columns, setColumns] = useState<ColumnConfig[]>(DEFAULT_COLUMNS);

  // Modals
  const [formOpen, setFormOpen] = useState(false);
  const [selectedListing, setSelectedListing] = useState<PropertyListing | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailListing, setDetailListing] = useState<PropertyListing | null>(null);

  // Delete Confirm
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [listingToDelete, setListingToDelete] = useState<PropertyListing | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchListings = useCallback(async () => {
    if (!account?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('property_listings')
        .select('*')
        .eq('account_id', account.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setListings((data as PropertyListing[]) || []);
    } catch (err: unknown) {
      console.error('Error fetching listings:', err);
      toast.error('Could not load property listings.');
    } finally {
      setLoading(false);
    }
  }, [account?.id, supabase]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  // Unique types and cities for filter dropdowns
  const availableTypes = useMemo(() => {
    const set = new Set<string>();
    listings.forEach((l) => {
      if (l.property_type) set.add(l.property_type);
    });
    return Array.from(set);
  }, [listings]);

  const availableCities = useMemo(() => {
    const set = new Set<string>();
    listings.forEach((l) => {
      if (l.city) set.add(l.city);
    });
    return Array.from(set);
  }, [listings]);

  // Filtered listings
  const filteredListings = useMemo(() => {
    return listings.filter((l) => {
      // Search
      if (search.trim()) {
        const query = search.toLowerCase();
        const matchesTitle = l.title?.toLowerCase().includes(query);
        const matchesSerial = l.serial_no?.toLowerCase().includes(query);
        const matchesCity = l.city?.toLowerCase().includes(query);
        const matchesArea = l.area?.toLowerCase().includes(query);
        const matchesAddress = l.address?.toLowerCase().includes(query);
        const matchesDemand = l.demand_price?.toLowerCase().includes(query);
        const matchesType = l.property_type?.toLowerCase().includes(query);
        const matchesPhone = l.contact_number?.toLowerCase().includes(query);

        if (
          !matchesTitle &&
          !matchesSerial &&
          !matchesCity &&
          !matchesArea &&
          !matchesAddress &&
          !matchesDemand &&
          !matchesType &&
          !matchesPhone
        ) {
          return false;
        }
      }

      // Status
      if (statusFilter !== 'all' && l.status !== statusFilter) {
        return false;
      }

      // Type
      if (typeFilter !== 'all' && l.property_type !== typeFilter) {
        return false;
      }

      // City
      if (cityFilter !== 'all' && l.city !== cityFilter) {
        return false;
      }

      return true;
    });
  }, [listings, search, statusFilter, typeFilter, cityFilter]);

  async function handleQuickStatusChange(listingId: string, newStatus: PropertyListingStatus) {
    try {
      const { error } = await supabase
        .from('property_listings')
        .update({ status: newStatus })
        .eq('id', listingId);

      if (error) throw error;
      setListings((prev) =>
        prev.map((item) => (item.id === listingId ? { ...item, status: newStatus } : item))
      );
      if (detailListing && detailListing.id === listingId) {
        setDetailListing({ ...detailListing, status: newStatus });
      }
      toast.success('Status updated successfully');
    } catch {
      toast.error('Failed to update status');
    }
  }

  async function handleDeleteConfirm() {
    if (!listingToDelete) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('property_listings')
        .delete()
        .eq('id', listingToDelete.id);

      if (error) throw error;
      setListings((prev) => prev.filter((item) => item.id !== listingToDelete.id));
      toast.success('Property listing deleted');
      setDeleteDialogOpen(false);
      setListingToDelete(null);
    } catch {
      toast.error('Failed to delete property listing');
    } finally {
      setDeleting(false);
    }
  }

  function toggleColumn(columnId: string) {
    setColumns((prev) =>
      prev.map((col) => (col.id === columnId ? { ...col, visible: !col.visible } : col))
    );
  }

  const isColVisible = (colId: string) => columns.find((c) => c.id === colId)?.visible;

  return (
    <div className="space-y-6">
      {/* PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {t('title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {listings.length > 0
              ? t('subtitle', { count: listings.length })
              : t('subtitleZero')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* VIEW MODE TOGGLE */}
          <div className="flex items-center rounded-lg border border-border p-1 bg-muted/40">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'table'
                  ? 'bg-background shadow-xs text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title={t('viewModeTable')}
            >
              <ListIcon className="size-4" />
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'cards'
                  ? 'bg-background shadow-xs text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title={t('viewModeCards')}
            >
              <LayoutGrid className="size-4" />
            </button>
          </div>

          {/* COLUMN CUSTOMIZER (TABLE VIEW) */}
          {viewMode === 'table' && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="outline" className="border-border text-muted-foreground hover:bg-muted">
                    <SlidersHorizontal className="size-4" />
                    {t('customizeColumns')}
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="w-52 border-border bg-popover text-popover-foreground">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-xs">Toggle Columns</DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                {columns.map((col) => (
                  <DropdownMenuCheckboxItem
                    key={col.id}
                    checked={col.visible}
                    onCheckedChange={() => toggleColumn(col.id)}
                    className="text-xs"
                  >
                    {col.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* ADD PROPERTY BUTTON */}
          <Button
            onClick={() => {
              setSelectedListing(null);
              setFormOpen(true);
            }}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
          >
            <Plus className="size-4" />
            {t('addListingBtn')}
          </Button>
        </div>
      </div>

      {/* SEARCH & FILTERS BAR */}
      <div className="flex flex-col sm:flex-row gap-2 items-center">
        {/* Search Input */}
        <div className="relative w-full sm:w-72 md:w-80">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-muted border-border text-foreground placeholder:text-muted-foreground"
          />
        </div>

        {/* Status Filter */}
        <div className="w-full sm:w-36">
          <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val ?? 'all')}>
            <SelectTrigger className="w-full bg-muted border-border text-foreground">
              <SelectValue placeholder={t('filterAllStatus')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('filterAllStatus')}</SelectItem>
              <SelectItem value="available">{t('statusAvailable')}</SelectItem>
              <SelectItem value="sold">{t('statusSold')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Property Type Filter */}
        <div className="w-full sm:w-44">
          <Select value={typeFilter} onValueChange={(val) => setTypeFilter(val ?? 'all')}>
            <SelectTrigger className="w-full bg-muted border-border text-foreground">
              <SelectValue placeholder={t('filterAllTypes')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('filterAllTypes')}</SelectItem>
              {availableTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* City Filter */}
        <div className="w-full sm:w-36">
          <Select value={cityFilter} onValueChange={(val) => setCityFilter(val ?? 'all')}>
            <SelectTrigger className="w-full bg-muted border-border text-foreground">
              <SelectValue placeholder={t('allCities')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('allCities')}</SelectItem>
              {availableCities.map((city) => (
                <SelectItem key={city} value={city}>
                  {city}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* CONTENT LISTINGS */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 border rounded-xl border-border bg-card">
          <Loader2 className="size-7 animate-spin text-primary mb-2" />
          <p className="text-sm text-muted-foreground">Loading property listings...</p>
        </div>
      ) : filteredListings.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center border rounded-xl border-dashed border-border bg-card">
          <div className="p-3 rounded-full bg-muted/60 mb-3 text-muted-foreground">
            <Building2 className="size-8" />
          </div>
          <h3 className="font-semibold text-lg text-foreground">{t('noListingsFound')}</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            {t('noListingsDesc')}
          </p>
          <Button
            onClick={() => {
              setSelectedListing(null);
              setFormOpen(true);
            }}
            variant="outline"
            size="sm"
            className="mt-4 gap-1.5"
          >
            <Plus className="size-4" />
            {t('addListingBtn')}
          </Button>
        </div>
      ) : viewMode === 'table' ? (
        /* TABLE VIEW */
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  {isColVisible('serial_no') && (
                    <TableHead className="w-20 text-xs">Sr No</TableHead>
                  )}
                  {isColVisible('title') && <TableHead className="text-xs">Title & Details</TableHead>}
                  {isColVisible('property_type') && (
                    <TableHead className="text-xs">Type</TableHead>
                  )}
                  {isColVisible('size') && <TableHead className="text-xs">Size</TableHead>}
                  {isColVisible('demand_price') && (
                    <TableHead className="text-xs">Demand</TableHead>
                  )}
                  {isColVisible('status') && <TableHead className="text-xs">Status</TableHead>}
                  {isColVisible('area_city') && (
                    <TableHead className="text-xs">City & Area</TableHead>
                  )}
                  {isColVisible('potential_rent') && (
                    <TableHead className="text-xs">Potential Rent</TableHead>
                  )}
                  {isColVisible('dimensions') && (
                    <TableHead className="text-xs">Dimensions</TableHead>
                  )}
                  {isColVisible('contact_number') && (
                    <TableHead className="text-xs">Phone</TableHead>
                  )}
                  {isColVisible('documents') && (
                    <TableHead className="text-xs">Documents</TableHead>
                  )}
                  <TableHead className="w-12 text-right text-xs">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredListings.map((item) => {
                  const statusInfo =
                    STATUS_BADGES[item.status] || STATUS_BADGES.available;
                  return (
                    <TableRow
                      key={item.id}
                      className="border-border hover:bg-muted/40 transition-colors cursor-pointer"
                      onClick={() => {
                        setDetailListing(item);
                        setDetailOpen(true);
                      }}
                    >
                      {/* Serial No */}
                      {isColVisible('serial_no') && (
                        <TableCell className="font-mono text-xs font-semibold text-primary">
                          {item.serial_no || '-'}
                        </TableCell>
                      )}

                      {/* Title */}
                      {isColVisible('title') && (
                        <TableCell>
                          <div className="font-medium text-foreground text-sm line-clamp-1">
                            {item.title}
                          </div>
                          {item.address && (
                            <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                              {item.address}
                            </div>
                          )}
                        </TableCell>
                      )}

                      {/* Type */}
                      {isColVisible('property_type') && (
                        <TableCell>
                          <Badge variant="secondary" className="text-xs font-normal">
                            {item.property_type || '-'}
                          </Badge>
                        </TableCell>
                      )}

                      {/* Size */}
                      {isColVisible('size') && (
                        <TableCell className="text-sm font-medium text-foreground">
                          {item.size || '-'}
                        </TableCell>
                      )}

                      {/* Demand */}
                      {isColVisible('demand_price') && (
                        <TableCell className="font-semibold text-sm text-primary">
                          {item.demand_price || '-'}
                        </TableCell>
                      )}

                      {/* Status */}
                      {isColVisible('status') && (
                        <TableCell>
                          <Badge className={`border text-xs px-2 py-0.5 ${statusInfo.className}`}>
                            {statusInfo.label}
                          </Badge>
                        </TableCell>
                      )}

                      {/* City & Area */}
                      {isColVisible('area_city') && (
                        <TableCell className="text-xs text-muted-foreground">
                          {[item.area, item.city].filter(Boolean).join(', ') || '-'}
                        </TableCell>
                      )}

                      {/* Potential Rent */}
                      {isColVisible('potential_rent') && (
                        <TableCell className="text-xs font-medium text-emerald-400">
                          {item.potential_rent || '-'}
                        </TableCell>
                      )}

                      {/* Dimensions */}
                      {isColVisible('dimensions') && (
                        <TableCell className="text-xs text-muted-foreground">
                          {item.front_dimension || item.length_dimension
                            ? `${item.front_dimension || '-'} × ${item.length_dimension || '-'}`
                            : '-'}
                        </TableCell>
                      )}

                      {/* Phone */}
                      {isColVisible('contact_number') && (
                        <TableCell className="font-mono text-xs text-foreground">
                          {item.contact_number || '-'}
                        </TableCell>
                      )}

                      {/* Documents */}
                      {isColVisible('documents') && (
                        <TableCell className="text-xs text-muted-foreground">
                          {item.documents || '-'}
                        </TableCell>
                      )}

                      {/* 3 DOTS ACTIONS MENU */}
                      <TableCell
                        className="text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-muted-foreground hover:text-foreground"
                              >
                                <MoreHorizontal className="size-4" />
                              </Button>
                            }
                          />
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem
                              onClick={() => {
                                setDetailListing(item);
                                setDetailOpen(true);
                              }}
                              className="gap-2 text-xs"
                            >
                              <Eye className="size-3.5" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedListing(item);
                                setFormOpen(true);
                              }}
                              className="gap-2 text-xs"
                            >
                              <Pencil className="size-3.5" />
                              Edit Listing
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />

                            {/* Status Shortcuts */}
                            <DropdownMenuItem
                              onClick={() => handleQuickStatusChange(item.id, 'available')}
                              className="gap-2 text-xs"
                              disabled={item.status === 'available'}
                            >
                              <CheckCircle2 className="size-3.5 text-emerald-500" />
                              Mark Available
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleQuickStatusChange(item.id, 'sold')}
                              className="gap-2 text-xs"
                              disabled={item.status === 'sold'}
                            >
                              <CheckCircle2 className="size-3.5 text-red-500" />
                              Mark Sold
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />

                            <DropdownMenuItem
                              onClick={() => {
                                setListingToDelete(item);
                                setDeleteDialogOpen(true);
                              }}
                              className="gap-2 text-xs text-red-400 focus:text-red-400"
                            >
                              <Trash2 className="size-3.5" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : (
        /* CARDS VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredListings.map((item) => {
            const statusInfo =
              STATUS_BADGES[item.status] || STATUS_BADGES.available;
            return (
              <div
                key={item.id}
                onClick={() => {
                  setDetailListing(item);
                  setDetailOpen(true);
                }}
                className="group relative rounded-xl border border-border bg-card p-4 hover:border-primary/50 transition-all cursor-pointer shadow-xs hover:shadow-md flex flex-col justify-between"
              >
                <div>
                  {/* Card Header: Sr No + Status + 3 Dots */}
                  <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-border/60">
                    <div className="flex items-center gap-1.5">
                      {item.serial_no && (
                        <span className="font-mono text-xs font-bold text-primary px-2 py-0.5 rounded bg-primary/10">
                          {item.serial_no}
                        </span>
                      )}
                      <Badge className={`border text-xs px-2 py-0.5 ${statusInfo.className}`}>
                        {statusInfo.label}
                      </Badge>
                    </div>

                    <div onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button variant="ghost" size="icon" className="size-7">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          }
                        />
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedListing(item);
                              setFormOpen(true);
                            }}
                            className="gap-2 text-xs"
                          >
                            <Pencil className="size-3.5" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setListingToDelete(item);
                              setDeleteDialogOpen(true);
                            }}
                            className="gap-2 text-xs text-red-400"
                          >
                            <Trash2 className="size-3.5" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* Title & Location */}
                  <div className="pt-3">
                    <h3 className="font-semibold text-foreground text-base line-clamp-1 group-hover:text-primary transition-colors">
                      {item.title}
                    </h3>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground mt-1 line-clamp-1">
                      <MapPin className="size-3 text-emerald-500 shrink-0" />
                      {[item.area, item.city].filter(Boolean).join(', ') || 'No area set'}
                    </p>
                  </div>

                  {/* Key Stats: Demand, Size, Type */}
                  <div className="grid grid-cols-2 gap-2 mt-4 p-2.5 rounded-lg bg-muted/30 border border-border/70">
                    <div>
                      <span className="text-[11px] text-muted-foreground block">Demand</span>
                      <span className="font-bold text-sm text-primary">
                        {item.demand_price || 'Call for price'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-muted-foreground block">Size / Type</span>
                      <span className="font-medium text-xs text-foreground block truncate">
                        {item.size || '-'} {item.property_type ? `· ${item.property_type}` : ''}
                      </span>
                    </div>
                  </div>

                  {/* Tags */}
                  {item.tags && item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {item.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border"
                        >
                          {tag}
                        </span>
                      ))}
                      {item.tags.length > 3 && (
                        <span className="text-[10px] text-muted-foreground self-center">
                          +{item.tags.length - 3} more
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Footer: Quick Details */}
                <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {item.front_dimension || item.length_dimension
                      ? `${item.front_dimension || '-'} × ${item.length_dimension || '-'}`
                      : item.storey || item.documents || 'Standard'}
                  </span>
                  <span className="text-primary font-medium group-hover:underline">
                    View Details →
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ADD / EDIT FORM MODAL */}
      <ListingForm
        open={formOpen}
        onOpenChange={setFormOpen}
        listing={selectedListing}
        onSaved={fetchListings}
      />

      {/* DETAIL VIEW MODAL */}
      <ListingDetailView
        open={detailOpen}
        onOpenChange={setDetailOpen}
        listing={detailListing}
        onEdit={(item) => {
          setSelectedListing(item);
          setFormOpen(true);
        }}
        onDelete={(item) => {
          setListingToDelete(item);
          setDeleteDialogOpen(true);
        }}
        onStatusChange={handleQuickStatusChange}
      />

      {/* DELETE CONFIRMATION DIALOG */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="border-border bg-card text-foreground sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-red-400 flex items-center gap-2">
              <Trash2 className="size-5" />
              {t('deleteConfirmTitle')}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm">
              {listingToDelete
                ? t('deleteConfirmDesc', { title: listingToDelete.title })
                : 'Are you sure you want to delete this listing?'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleting}
            >
              {t('cancelBtn')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  {t('deleting')}
                </>
              ) : (
                t('deleteBtn')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

