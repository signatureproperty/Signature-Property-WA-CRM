'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import type { Contact, Tag, ContactTag, CustomField } from '@/types';
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
import { Checkbox } from '@/components/ui/checkbox';
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Search,
  Plus,
  Upload,
  MoreHorizontal,
  Pencil,
  Trash2,
  Loader2,
  Users,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  SlidersHorizontal,
  Columns3,
  Filter,
  X,
} from 'lucide-react';
import { ContactForm } from '@/components/contacts/contact-form';
import { ContactDetailView } from '@/components/contacts/contact-detail-view';
import { ImportModal } from '@/components/contacts/import-modal';
import { CustomColumnManager } from '@/components/common/custom-column-manager';
import {
  RealEstateFilterPopover,
  RealEstateActiveFilterPills,
} from '@/components/common/real-estate-filter-popover';
import {
  type RealEstateFilters,
  INITIAL_FILTERS,
  countActiveFilters,
  isPriceInRange,
  isSizeInRange,
} from '@/lib/real-estate/filter-utils';
import {
  buildUnifiedContactColumns,
  DEFAULT_CONTACT_COLUMNS_DEF,
  formatDateCompact,
  compareSerials,
  type ColumnDefinition,
} from '@/lib/columns/column-settings';
import type { AccountColumnSetting } from '@/types';
import { useCan } from '@/hooks/use-can';
import { GatedButton } from '@/components/ui/gated-button';
import { useTranslations } from 'next-intl';
import {
  contactSearchFilter,
  contactSearchPattern,
} from '@/lib/contacts/search-filter';
import { pageAfterRangeError, pageAfterShrink } from '@/lib/contacts/page-bounds';

const PAGE_SIZE = 25;

interface ContactWithTags extends Contact {
  tags?: Tag[];
}

interface ColumnConfig {
  id: string;
  label: string;
  visible: boolean;
  isCustom?: boolean;
  fieldType?: string;
  options?: string[];
}

const DEFAULT_CONTACT_COLUMNS: ColumnConfig[] = [
  { id: 'name', label: 'Name', visible: true },
  { id: 'phone', label: 'Phone', visible: true },
  { id: 'email', label: 'Email', visible: true },
  { id: 'company', label: 'Company', visible: true },
  { id: 'tags', label: 'Tags', visible: true },
  { id: 'created_at', label: 'Created', visible: true },
];

export default function ContactsPage() {
  const t = useTranslations('Contacts.page');
  const tGate = useTranslations('GatedButton');
  const supabase = createClient();
  const { accountId } = useAuth();
  const canEdit = useCan('send-messages');
  const canEditSettings = useCan('edit-settings');

  const [contacts, setContacts] = useState<ContactWithTags[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  // Real Estate Filters (Property Type, City, Area, Price, Size, Tags)
  const [filters, setFilters] = useState<RealEstateFilters>(INITIAL_FILTERS);
  const selectedTagIds = filters.tagIds;

  // Serial Sorting: 'asc' = 1 to forward; 'desc' = reverse
  const [serialSortDirection, setSerialSortDirection] = useState<'asc' | 'desc'>('asc');
  const toggleSerialSort = () => {
    setSerialSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  };

  const sortedContacts = useMemo(() => {
    const list = [...contacts];
    list.sort((a, b) => compareSerials(a.serial_no, b.serial_no, serialSortDirection));
    return list;
  }, [contacts, serialSortDirection]);

  // Columns & Custom Fields
  const [columns, setColumns] = useState<ColumnConfig[]>(DEFAULT_CONTACT_COLUMNS);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customValuesMap, setCustomValuesMap] = useState<Record<string, Record<string, string>>>({});

  // Modals
  const [formOpen, setFormOpen] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [editContactTags, setEditContactTags] = useState<ContactTag[]>([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailContactId, setDetailContactId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [customFieldsOpen, setCustomFieldsOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Bulk selection (page-scoped — only the loaded rows are selectable)
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  // All tags for display
  const [tagsMap, setTagsMap] = useState<Record<string, Tag>>({});

  function toggleColumn(colId: string) {
    setColumns((prev) =>
      prev.map((c) => (c.id === colId ? { ...c, visible: !c.visible } : c))
    );
  }

  function isColVisible(id: string): boolean {
    return columns.find((c) => c.id === id)?.visible ?? false;
  }

  function getColLabel(id: string, fallback: string): string {
    return columns.find((c) => c.id === id)?.label || fallback;
  }

  const fetchCustomFields = useCallback(async () => {
    if (!accountId) return;
    const [fieldsRes, settingsRes] = await Promise.all([
      supabase
        .from('custom_fields')
        .select('*')
        .eq('account_id', accountId)
        .eq('entity_type', 'contact')
        .order('field_name'),
      supabase
        .from('account_column_settings')
        .select('*')
        .eq('account_id', accountId)
        .eq('entity_type', 'contact'),
    ]);

    const fields = (fieldsRes.data as CustomField[]) || [];
    const settings = (settingsRes.data as AccountColumnSetting[]) || [];
    setCustomFields(fields);

    setColumns((prev) => {
      const prevVisibilityMap = new Map(prev.map((c) => [c.id, c.visible]));
      const unified = buildUnifiedContactColumns(fields, settings, prevVisibilityMap);
      return unified.filter((c) => !c.isDeleted);
    });
  }, [accountId, supabase]);

  // Guards against out-of-order fetch responses: each fetchContacts run
  // claims a sequence number and only the latest is allowed to commit its
  // results. Without this, rapidly toggling tag filters could let a slower
  // earlier request resolve last and render stale rows.
  const fetchSeq = useRef(0);

  const fetchTags = useCallback(async () => {
    const { data } = await supabase.from('tags').select('*');
    if (data) {
      const map: Record<string, Tag> = {};
      data.forEach((t) => (map[t.id] = t));
      setTagsMap(map);
      // Drop any filter selections whose tag no longer exists
      setFilters((prev) => {
        const pruned = (prev.tagIds || []).filter((id) => map[id]);
        return pruned.length === prev.tagIds.length ? prev : { ...prev, tagIds: pruned };
      });
    }
  }, [supabase]);

  const fetchContacts = useCallback(async () => {
    const seq = ++fetchSeq.current;
    setLoading(true);
    // The visible rows are about to change — drop any selection that
    // referred to the old page/search results so the bulk bar can't
    // act on rows the user can no longer see.
    setSelected(new Set());

    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const term = search.trim();

    let contactRows: Contact[];
    let count: number;
    let countIsExact = true;

    if (filters.tagIds.length > 0) {
      // Tag filter active — resolve it server-side
      const { data, error } = await supabase.rpc('filter_contacts_by_tags', {
        p_tag_ids: filters.tagIds,
        p_search: contactSearchPattern(term),
        p_limit: PAGE_SIZE,
        p_offset: from,
      });
      if (seq !== fetchSeq.current) return;
      if (error) {
        toast.error(t('toastFailedLoad'));
        setLoading(false);
        return;
      }
      const rows = (data ?? []) as { contact: Contact; total_count: number }[];
      contactRows = rows.map((r) => r.contact);
      count = rows.length > 0 ? Number(rows[0].total_count) : 0;
      countIsExact = rows.length > 0;
    } else {
      let query = supabase
        .from('contacts')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

      const searchFilter = contactSearchFilter(term, { includeEmail: true, includeRealEstate: true });
      if (searchFilter) query = query.or(searchFilter);

      if (filters.propertyType && filters.propertyType !== 'all') {
        query = query.eq('property_type', filters.propertyType);
      }
      if (filters.city && filters.city !== 'all') {
        query = query.ilike('city', `%${filters.city}%`);
      }
      if (filters.area?.trim()) {
        query = query.ilike('area', `%${filters.area.trim()}%`);
      }

      const { data, count: exactCount, error } = await query;
      if (seq !== fetchSeq.current) return;
      const pageInRange = error
        ? pageAfterRangeError(page, PAGE_SIZE, error)
        : null;
      if (pageInRange !== null && pageInRange !== page) {
        setPage(pageInRange);
        return;
      }
      if (error) {
        toast.error(t('toastFailedLoad'));
        setLoading(false);
        return;
      }
      contactRows = data ?? [];
      count = exactCount ?? 0;
    }

    // Client-side refinement for price and size range if present
    if (filters.minPrice?.trim() || filters.maxPrice?.trim()) {
      contactRows = contactRows.filter((c) =>
        isPriceInRange(c.budget, filters.minPrice, filters.maxPrice)
      );
    }
    if (filters.minSize?.trim() || filters.maxSize?.trim()) {
      contactRows = contactRows.filter((c) =>
        isSizeInRange(c.size, filters.minSize, filters.maxSize, filters.sizeUnit || 'Marla')
      );
    }

    setTotalCount(count);

    const boundedPage = pageAfterShrink(page, count, PAGE_SIZE, countIsExact);
    if (contactRows.length === 0 && boundedPage !== page) {
      setPage(boundedPage);
      return;
    }

    if (contactRows.length === 0) {
      setContacts([]);
      setLoading(false);
      return;
    }

    // Fetch tags and custom values for these contacts
    const contactIds = contactRows.map((c) => c.id);
    const [tagsRes, customValsRes] = await Promise.all([
      supabase
        .from('contact_tags')
        .select('contact_id, tag_id')
        .in('contact_id', contactIds),
      supabase
        .from('contact_custom_values')
        .select('contact_id, custom_field_id, value')
        .in('contact_id', contactIds),
    ]);
    if (seq !== fetchSeq.current) return;

    const tagsByContact: Record<string, string[]> = {};
    tagsRes.data?.forEach((ct) => {
      if (!tagsByContact[ct.contact_id]) tagsByContact[ct.contact_id] = [];
      tagsByContact[ct.contact_id].push(ct.tag_id);
    });

    const valMap: Record<string, Record<string, string>> = {};
    customValsRes.data?.forEach((v) => {
      if (!valMap[v.contact_id]) valMap[v.contact_id] = {};
      valMap[v.contact_id][v.custom_field_id] = v.value ?? '';
    });
    setCustomValuesMap(valMap);

    const enriched: ContactWithTags[] = contactRows.map((c) => ({
      ...c,
      tags: (tagsByContact[c.id] ?? [])
        .map((tid) => tagsMap[tid])
        .filter(Boolean),
    }));

    setContacts(enriched);
    setLoading(false);
  }, [supabase, page, search, filters, tagsMap, t]);

  // Load-once-on-mount-ish data fetches. Each setter inside runs
  // inside an async promise completion (Supabase await), not
  // synchronously in the effect body, so the cascade the lint rule
  // warns about doesn't apply here.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTags();
  }, [fetchTags]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCustomFields();
  }, [fetchCustomFields]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchContacts();
  }, [fetchContacts]);

  function openAddForm() {
    setEditContact(null);
    setEditContactTags([]);
    setFormOpen(true);
  }

  async function openEditForm(contact: Contact) {
    const { data } = await supabase
      .from('contact_tags')
      .select('*')
      .eq('contact_id', contact.id);
    setEditContact(contact);
    setEditContactTags(data ?? []);
    setFormOpen(true);
  }

  function openDetail(contactId: string) {
    setDetailContactId(contactId);
    setDetailOpen(true);
  }

  function confirmDelete(contact: Contact) {
    setDeleteTarget(contact);
    setDeleteConfirmOpen(true);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);

    const { error } = await supabase
      .from('contacts')
      .delete()
      .eq('id', deleteTarget.id);

    if (error) {
      toast.error(t('toastFailedDelete'));
    } else {
      toast.success(t('toastDeleted'));
      fetchContacts();
    }

    setDeleting(false);
    setDeleteConfirmOpen(false);
    setDeleteTarget(null);
  }

  const allOnPageSelected =
    contacts.length > 0 && contacts.every((c) => selected.has(c.id));
  const someOnPageSelected = contacts.some((c) => selected.has(c.id));

  function toggleSelectAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        contacts.forEach((c) => next.delete(c.id));
      } else {
        contacts.forEach((c) => next.add(c.id));
      }
      return next;
    });
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleBulkDelete() {
    const ids = [...selected];
    if (ids.length === 0) return;
    setDeleting(true);

    const { error } = await supabase.from('contacts').delete().in('id', ids);

    if (error) {
      toast.error(t('toastBulkFailedDelete'));
    } else {
      toast.success(t('toastBulkDeleted', { count: ids.length }));
      setSelected(new Set());
      fetchContacts();
    }

    setDeleting(false);
    setBulkDeleteOpen(false);
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const hasNext = page < totalPages - 1;
  const hasPrev = page > 0;

  const allTags = Object.values(tagsMap).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  const availableCities = useMemo(() => {
    const set = new Set<string>();
    contacts.forEach((c) => {
      if (c.city) set.add(c.city);
    });
    return Array.from(set);
  }, [contacts]);

  const hasActiveFilters = search.trim().length > 0 || countActiveFilters(filters) > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {totalCount > 0 ? t('subtitle', { count: totalCount }) : t('subtitleZero')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* VIEW / TOGGLE COLUMNS */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  className="border-border text-muted-foreground hover:bg-muted"
                >
                  <SlidersHorizontal className="size-4" />
                  Columns
                </Button>
              }
            />
            <DropdownMenuContent
              align="end"
              className="w-52 border-border bg-popover text-popover-foreground"
            >
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

          {canEditSettings && (
            <Button
              variant="outline"
              onClick={() => setCustomFieldsOpen(true)}
              className="border-border text-muted-foreground hover:bg-muted"
            >
              <Columns3 className="size-4" />
              Manage Columns
            </Button>
          )}
          <GatedButton
            variant="outline"
            canAct={canEdit}
            gateReason={tGate('reasons.addOrImportContacts')}
            onClick={() => setImportOpen(true)}
            className="border-border text-muted-foreground hover:bg-muted"
          >
            <Upload className="size-4" />
            {t('importBtn')}
          </GatedButton>
          <GatedButton
            canAct={canEdit}
            gateReason={tGate('reasons.addOrImportContacts')}
            onClick={openAddForm}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Plus className="size-4" />
            {t('addContactBtn')}
          </GatedButton>
        </div>
      </div>

      {/* Search + Real Estate Filters */}
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row gap-2 items-center">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              placeholder={t('searchPlaceholder')}
              className="pl-9 bg-muted border-border text-foreground placeholder:text-muted-foreground h-9 text-xs"
            />
          </div>

          <RealEstateFilterPopover
            filters={filters}
            onFiltersChange={(newFilters) => {
              setFilters(newFilters);
              setPage(0);
            }}
            availableCities={availableCities}
            availableTags={allTags}
            showStatus={false}
          />
        </div>

        {/* Active Filter Badges */}
        <RealEstateActiveFilterPills
          filters={filters}
          availableTags={allTags}
          onRemoveFilter={(key, val) => {
            if (key === 'tagIds' && val) {
              setFilters({
                ...filters,
                tagIds: filters.tagIds.filter((id) => id !== val),
              });
            } else {
              setFilters({
                ...filters,
                [key]: key === 'propertyType' || key === 'city' ? 'all' : '',
              });
            }
            setPage(0);
          }}
          onClearAll={() => {
            setFilters({ ...INITIAL_FILTERS });
            setPage(0);
          }}
        />
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/40 px-4 py-2">
          <p className="text-sm text-foreground">
            {t('selectedCount', { count: selected.size })}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelected(new Set())}
              className="text-muted-foreground hover:text-foreground"
            >
              {t('clearSelection')}
            </Button>
            <GatedButton
              variant="destructive"
              size="sm"
              canAct={canEdit}
              gateReason={tGate('reasons.deleteContacts')}
              onClick={() => setBulkDeleteOpen(true)}
            >
              <Trash2 className="size-4" />
              {t('deleteSelected')}
            </GatedButton>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="w-10">
                <Checkbox
                  checked={allOnPageSelected}
                  indeterminate={!allOnPageSelected && someOnPageSelected}
                  onCheckedChange={toggleSelectAll}
                  disabled={contacts.length === 0}
                  aria-label={t('selectAllOnPage')}
                />
              </TableHead>
              {isColVisible('serial_no') && (
                <TableHead className="w-24 text-xs text-muted-foreground select-none">
                  <button
                    type="button"
                    onClick={toggleSerialSort}
                    className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors group font-semibold text-xs py-1 cursor-pointer"
                    title={
                      serialSortDirection === 'asc'
                        ? 'Sorted 1 to forward (click for reverse)'
                        : 'Sorted reverse (click for 1 forward)'
                    }
                  >
                    <span>{getColLabel('serial_no', 'Sr No')}</span>
                    <span className="inline-flex flex-col -space-y-1">
                      <ChevronUp
                        className={`size-3 transition-colors ${
                          serialSortDirection === 'asc'
                            ? 'text-primary font-bold'
                            : 'text-muted-foreground/40 group-hover:text-muted-foreground'
                        }`}
                      />
                      <ChevronDown
                        className={`size-3 transition-colors ${
                          serialSortDirection === 'desc'
                            ? 'text-primary font-bold'
                            : 'text-muted-foreground/40 group-hover:text-muted-foreground'
                        }`}
                      />
                    </span>
                  </button>
                </TableHead>
              )}
              {isColVisible('phone') && (
                <TableHead className="text-xs text-muted-foreground">{getColLabel('phone', 'Number')}</TableHead>
              )}
              {isColVisible('name') && (
                <TableHead className="text-xs text-muted-foreground">{getColLabel('name', 'Name')}</TableHead>
              )}
              {isColVisible('city') && (
                <TableHead className="text-xs text-muted-foreground">{getColLabel('city', 'City')}</TableHead>
              )}
              {isColVisible('area') && (
                <TableHead className="text-xs text-muted-foreground">{getColLabel('area', 'Area')}</TableHead>
              )}
              {isColVisible('property_type') && (
                <TableHead className="text-xs text-muted-foreground">{getColLabel('property_type', 'Property Type')}</TableHead>
              )}
              {isColVisible('size') && (
                <TableHead className="text-xs text-muted-foreground">{getColLabel('size', 'Size')}</TableHead>
              )}
              {isColVisible('budget') && (
                <TableHead className="text-xs text-muted-foreground">{getColLabel('budget', 'Budget')}</TableHead>
              )}
              {isColVisible('notes') && (
                <TableHead className="text-xs text-muted-foreground">{getColLabel('notes', 'Notes')}</TableHead>
              )}
              {isColVisible('tags') && (
                <TableHead className="text-muted-foreground text-xs hidden md:table-cell">{getColLabel('tags', t('tableColumns.tags'))}</TableHead>
              )}
              {isColVisible('email') && (
                <TableHead className="text-muted-foreground text-xs hidden lg:table-cell">{getColLabel('email', t('tableColumns.email'))}</TableHead>
              )}
              {isColVisible('company') && (
                <TableHead className="text-muted-foreground text-xs hidden lg:table-cell">{getColLabel('company', t('tableColumns.company'))}</TableHead>
              )}
              {columns
                .filter((c) => c.isCustom && c.visible)
                .map((col) => (
                  <TableHead key={col.id} className="text-muted-foreground text-xs whitespace-nowrap">
                    {col.label}
                  </TableHead>
                ))}
              <TableHead className="text-muted-foreground w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow className="border-border">
                <TableCell colSpan={columns.filter((c) => c.visible).length + 2} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="size-6 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">{t('loading')}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : contacts.length === 0 ? (
              <TableRow className="border-border">
                <TableCell colSpan={columns.filter((c) => c.visible).length + 2} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2">
                    <Users className="size-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      {hasActiveFilters
                        ? t('noContactsMatch')
                        : t('noContactsYet')}
                    </p>
                    {!hasActiveFilters && (
                      <GatedButton
                        canAct={canEdit}
                        gateReason={tGate('reasons.addOrImportContacts')}
                        variant="outline"
                        size="sm"
                        onClick={openAddForm}
                        className="mt-2 border-border text-muted-foreground hover:bg-muted"
                      >
                        <Plus className="size-3.5" />
                        {t('addFirstContact')}
                      </GatedButton>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              sortedContacts.map((contact) => (
                <TableRow
                  key={contact.id}
                  className="border-border hover:bg-muted/50 cursor-pointer"
                  onClick={() => openDetail(contact.id)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selected.has(contact.id)}
                      onCheckedChange={() => toggleSelect(contact.id)}
                      aria-label={t('selectContact', { name: contact.name || contact.phone })}
                    />
                  </TableCell>
                  {/* Sr No with compact Creation Date (like 30 Sep 2026) */}
                  {isColVisible('serial_no') && (
                    <TableCell>
                      <div className="font-mono text-xs font-semibold text-primary">
                        {contact.serial_no || '-'}
                      </div>
                      {contact.created_at && (
                        <div className="text-[10px] text-muted-foreground whitespace-nowrap mt-0.5">
                          {formatDateCompact(contact.created_at)}
                        </div>
                      )}
                    </TableCell>
                  )}

                  {/* Phone / Number */}
                  {isColVisible('phone') && (
                    <TableCell className="text-muted-foreground font-mono text-xs whitespace-nowrap">
                      {contact.phone}
                    </TableCell>
                  )}

                  {/* Name (if serial_no is hidden, show date under name) */}
                  {isColVisible('name') && (
                    <TableCell>
                      <div className="text-foreground font-medium text-sm">
                        {contact.name || <span className="text-muted-foreground italic">{t('unnamed')}</span>}
                      </div>
                      {!isColVisible('serial_no') && contact.created_at && (
                        <div className="text-[10px] text-muted-foreground whitespace-nowrap mt-0.5">
                          {formatDateCompact(contact.created_at)}
                        </div>
                      )}
                    </TableCell>
                  )}

                  {/* City */}
                  {isColVisible('city') && (
                    <TableCell className="text-xs text-foreground whitespace-nowrap">
                      {contact.city || <span className="text-muted-foreground">-</span>}
                    </TableCell>
                  )}

                  {/* Area */}
                  {isColVisible('area') && (
                    <TableCell className="text-xs text-foreground">
                      {contact.area || <span className="text-muted-foreground">-</span>}
                    </TableCell>
                  )}

                  {/* Property Type */}
                  {isColVisible('property_type') && (
                    <TableCell>
                      {contact.property_type ? (
                        <Badge variant="outline" className="text-xs bg-muted/60 border-border text-foreground font-normal">
                          {contact.property_type}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </TableCell>
                  )}

                  {/* Size */}
                  {isColVisible('size') && (
                    <TableCell className="text-xs font-medium text-foreground whitespace-nowrap">
                      {contact.size || <span className="text-muted-foreground">-</span>}
                    </TableCell>
                  )}

                  {/* Budget */}
                  {isColVisible('budget') && (
                    <TableCell className="text-xs font-semibold text-primary whitespace-nowrap">
                      {contact.budget || <span className="text-muted-foreground font-normal">-</span>}
                    </TableCell>
                  )}

                  {/* Notes */}
                  {isColVisible('notes') && (
                    <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate" title={(contact as { notes?: string }).notes || undefined}>
                      {(contact as { notes?: string }).notes || <span className="text-muted-foreground">-</span>}
                    </TableCell>
                  )}

                  {/* Tags */}
                  {isColVisible('tags') && (
                    <TableCell className="hidden md:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {contact.tags && contact.tags.length > 0 ? (
                          contact.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag.id}
                              className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
                              style={{
                                backgroundColor: tag.color + '20',
                                color: tag.color,
                              }}
                            >
                              {tag.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                        {contact.tags && contact.tags.length > 3 && (
                          <span className="text-[10px] text-muted-foreground">
                            +{contact.tags.length - 3}
                          </span>
                        )}
                      </div>
                    </TableCell>
                  )}

                  {/* Email */}
                  {isColVisible('email') && (
                    <TableCell className="text-muted-foreground hidden lg:table-cell text-xs">
                      {contact.email || <span className="text-muted-foreground">-</span>}
                    </TableCell>
                  )}

                  {/* Company */}
                  {isColVisible('company') && (
                    <TableCell className="text-muted-foreground hidden lg:table-cell text-xs">
                      {contact.company || <span className="text-muted-foreground">-</span>}
                    </TableCell>
                  )}
                  {columns
                    .filter((c) => c.isCustom && c.visible)
                    .map((col) => {
                      const val = customValuesMap[contact.id]?.[col.id];
                      return (
                        <TableCell key={col.id} className="text-xs text-foreground">
                          {!val ? (
                            <span className="text-muted-foreground text-xs">-</span>
                          ) : col.fieldType === 'select' ? (
                            <Badge
                              variant="outline"
                              className="text-xs bg-muted/60 border-border text-foreground font-normal"
                            >
                              {val}
                            </Badge>
                          ) : col.fieldType === 'number' ? (
                            <span className="font-mono text-xs text-foreground">{val}</span>
                          ) : (
                            <span className="text-xs text-foreground truncate max-w-[180px] inline-block">
                              {val}
                            </span>
                          )}
                        </TableCell>
                      );
                    })}
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-muted-foreground hover:text-foreground"
                            onClick={(e) => e.stopPropagation()}
                          />
                        }
                      >
                        <MoreHorizontal className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="bg-popover border-border"
                      >
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditForm(contact);
                          }}
                          className="text-popover-foreground focus:bg-muted focus:text-foreground"
                        >
                          <Pencil className="size-4" />
                          {t('editAction')}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-border" />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            confirmDelete(contact);
                          }}
                        >
                          <Trash2 className="size-4" />
                          {t('deleteAction')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {t('showingPagination', {
              start: page * PAGE_SIZE + 1,
              end: Math.min((page + 1) * PAGE_SIZE, totalCount),
              total: totalCount
            })}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              disabled={!hasPrev}
              onClick={() => setPage((p) => p - 1)}
              className="border-border text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-xs text-muted-foreground px-2">
              {t('pageCount', { page: page + 1, total: totalPages })}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              disabled={!hasNext}
              onClick={() => setPage((p) => p + 1)}
              className="border-border text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Contact Form Dialog */}
      <ContactForm
        open={formOpen}
        onOpenChange={setFormOpen}
        contact={editContact}
        contactTags={editContactTags}
        onSaved={() => {
          fetchCustomFields();
          fetchContacts();
          fetchTags();
        }}
        onViewExisting={(id) => {
          setFormOpen(false);
          openDetail(id);
        }}
      />

      {/* Contact Detail Sheet */}
      <ContactDetailView
        open={detailOpen}
        onOpenChange={setDetailOpen}
        contactId={detailContactId}
        onUpdated={() => {
          fetchCustomFields();
          fetchContacts();
        }}
      />

      {/* Import Modal */}
      <ImportModal
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => {
          fetchCustomFields();
          fetchContacts();
        }}
      />

      {/* Custom Column Manager (admin+) */}
      {canEditSettings && (
        <CustomColumnManager
          open={customFieldsOpen}
          onOpenChange={setCustomFieldsOpen}
          entityType="contact"
          onFieldsChanged={() => {
            fetchCustomFields();
            fetchContacts();
          }}
        />
      )}

      {/* Delete Confirmation */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="bg-popover border-border text-popover-foreground sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-popover-foreground">{t('deleteContactTitle')}</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {t('deleteContactDesc', { name: deleteTarget?.name || deleteTarget?.phone || '' })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="bg-popover border-border">
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmOpen(false)}
              className="border-border text-muted-foreground hover:bg-muted"
            >
              {t('cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="size-4 animate-spin" />}
              {t('deleteBtn')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation */}
      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent className="bg-popover border-border text-popover-foreground sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-popover-foreground">
              {t('deleteBulkTitle')}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {t('deleteBulkDesc', { count: selected.size })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="bg-popover border-border">
            <Button
              variant="outline"
              onClick={() => setBulkDeleteOpen(false)}
              className="border-border text-muted-foreground hover:bg-muted"
            >
              {t('cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="size-4 animate-spin" />}
              {t('deleteBtn')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
