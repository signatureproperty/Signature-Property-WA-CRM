'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { addContactTag, deleteContactTag } from '@/lib/contacts/tag-api';
import { toast } from 'sonner';
import type { Contact, Tag, ContactTag, CustomField } from '@/types';
import {
  findExistingContact,
  isExactMatch,
  isUniqueViolation,
  type ExistingContact,
} from '@/lib/contacts/dedupe';
import { parseInternationalPhone } from '@/lib/whatsapp/phone-utils';
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
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, AlertTriangle, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';

const SIZE_UNITS = ['Marla', 'Kanal', 'Sq. Ft.', 'Acre', 'Maraba'] as const;
type SizeUnit = (typeof SIZE_UNITS)[number];

const PROPERTY_TYPES = [
  'House',
  'Plot',
  'Commercial',
  'Apartment',
  'Agricultural Land',
  'Building',
  'Other',
] as const;

interface ContactFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact?: Contact | null;
  contactTags?: ContactTag[];
  onSaved: () => void;
  /** Open an existing contact's detail view — used by the duplicate
   *  notice to jump to the contact that already owns this number. */
  onViewExisting?: (contactId: string) => void;
}

export function ContactForm({
  open,
  onOpenChange,
  contact,
  contactTags = [],
  onSaved,
  onViewExisting,
}: ContactFormProps) {
  const t = useTranslations('Contacts.form');
  const supabase = createClient();
  const { accountId, user } = useAuth();
  const isEdit = !!contact;

  const [serialNo, setSerialNo] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [city, setCity] = useState('Lahore');
  const [area, setArea] = useState('');
  const [propertyType, setPropertyType] = useState('House');
  const [sizeValue, setSizeValue] = useState('');
  const [sizeUnit, setSizeUnit] = useState<SizeUnit>('Marla');
  const [budget, setBudget] = useState('');
  const [saving, setSaving] = useState(false);

  // Duplicate-phone detection for NEW contacts. `exact` (same digits)
  // hard-blocks the save; a fuzzy trunk-variant match only warns. The
  // DB unique index (migration 022) is the real backstop — this is the
  // friendly heads-up before we get there.
  const [dupMatch, setDupMatch] = useState<
    { contact: ExistingContact; exact: boolean } | null
  >(null);
  const [checkingDup, setCheckingDup] = useState(false);

  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [loadingTags, setLoadingTags] = useState(false);

  // Custom Fields & Column Overrides
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [columnSettings, setColumnSettings] = useState<Record<string, { label: string; is_deleted: boolean }>>({});
  const [newTagName, setNewTagName] = useState('');
  const [creatingTag, setCreatingTag] = useState(false);

  const TAG_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

  async function handleCreateTag() {
    const trimmed = newTagName.trim();
    if (!trimmed || !accountId) return;
    setCreatingTag(true);
    try {
      const randomColor = TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];
      const { data, error } = await supabase
        .from('tags')
        .insert({
          account_id: accountId,
          user_id: user?.id,
          name: trimmed,
          color: randomColor,
        })
        .select('*')
        .single();

      if (error) throw error;
      if (data) {
        setTags((prev) => [...prev, data]);
        setSelectedTagIds((prev) => [...prev, data.id]);
        setNewTagName('');
        toast.success(`Tag "${data.name}" created`);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to create tag');
    } finally {
      setCreatingTag(false);
    }
  }

  useEffect(() => {
    if (open) {
      setName(contact?.name ?? '');
      setPhone(contact?.phone ?? '');
      setEmail(contact?.email ?? '');
      setCompany(contact?.company ?? '');
      setCity(contact?.city ?? 'Lahore');
      setArea(contact?.area ?? '');
      setPropertyType(contact?.property_type ?? 'House');
      setBudget(contact?.budget ?? '');

      if (contact?.size) {
        const match = contact.size.match(/^([\d.]+)\s*(.*)$/);
        if (match) {
          setSizeValue(match[1]);
          const matchedUnit = SIZE_UNITS.find(
            (u) => u.toLowerCase() === match[2].trim().toLowerCase()
          );
          setSizeUnit(matchedUnit || 'Marla');
        } else {
          setSizeValue(contact.size);
          setSizeUnit('Marla');
        }
      } else {
        setSizeValue('');
        setSizeUnit('Marla');
      }

      if (contact?.serial_no) {
        setSerialNo(contact.serial_no);
      } else if (!contact && accountId) {
        supabase
          .from('contacts')
          .select('*', { count: 'exact', head: true })
          .eq('account_id', accountId)
          .then(({ count }) => {
            const nextNum = (count ?? 0) + 1;
            setSerialNo(`C-${nextNum}`);
          });
      } else {
        setSerialNo('');
      }

      setSelectedTagIds(contactTags.map((ct) => ct.tag_id));
      setDupMatch(null);
      fetchTags();
      fetchCustomFields();
    }
  }, [open, contact, accountId]);

  async function fetchCustomFields() {
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

    if (fieldsRes.data) setCustomFields(fieldsRes.data as CustomField[]);

    if (settingsRes.data) {
      const sMap: Record<string, { label: string; is_deleted: boolean }> = {};
      for (const s of settingsRes.data) {
        sMap[s.column_id] = { label: s.label, is_deleted: s.is_deleted };
      }
      setColumnSettings(sMap);
    }

    if (contact?.id) {
      const { data: valData } = await supabase
        .from('contact_custom_values')
        .select('*')
        .eq('contact_id', contact.id);

      if (valData) {
        const map: Record<string, string> = {};
        for (const v of valData) {
          map[v.custom_field_id] = v.value ?? '';
        }
        setCustomValues(map);
      }
    } else {
      setCustomValues({});
    }
  }

  // Look up an existing contact with this number (new contacts only).
  // Runs on blur so we don't query on every keystroke.
  async function checkDuplicate() {
    if (isEdit || !accountId) return;
    const value = phone.trim();
    if (!value) {
      setDupMatch(null);
      return;
    }
    setCheckingDup(true);
    try {
      const existing = await findExistingContact(supabase, accountId, value);
      setDupMatch(
        existing
          ? { contact: existing, exact: isExactMatch(existing, value) }
          : null,
      );
    } finally {
      setCheckingDup(false);
    }
  }

  async function fetchTags() {
    setLoadingTags(true);
    const { data } = await supabase
      .from('tags')
      .select('*')
      .order('name');
    if (data) setTags(data);
    setLoadingTags(false);
  }

  function toggleTag(tagId: string) {
    setSelectedTagIds((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!phone.trim()) {
      toast.error(t('phoneRequired'));
      return;
    }

    // A number typed here must carry its country code (leading `+`):
    // "4155551212" reads as a US number to the person typing it but is
    // delivered to +41 (Switzerland) by Meta (issue #586). Only checked
    // when the number actually changed — contacts created by the inbound
    // webhook store Meta's digits-only form, and editing their name must
    // not be blocked by a phone the user never touched.
    const phoneChanged = !isEdit || phone.trim() !== (contact?.phone ?? '');
    if (phoneChanged && !parseInternationalPhone(phone)) {
      toast.error(t('phoneNeedsCountryCode'));
      return;
    }

    // Hard-block an exact duplicate on create (the DB unique index is
    // the real backstop; this avoids a round-trip + a raw error toast).
    if (!isEdit && dupMatch?.exact) {
      toast.error(t('toastConflict'));
      return;
    }

    setSaving(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error(t('notAuthenticated'));
      if (!accountId) throw new Error(t('notLinkedToAccount'));

      let contactId = contact?.id;
      const fullSize = sizeValue.trim() ? `${sizeValue.trim()} ${sizeUnit}` : null;

      if (isEdit && contactId) {
        const { error } = await supabase
          .from('contacts')
          .update({
            serial_no: serialNo.trim() || null,
            name: name.trim() || null,
            phone: phone.trim(),
            email: email.trim() || null,
            company: company.trim() || null,
            city: city.trim() || null,
            area: area.trim() || null,
            property_type: propertyType || null,
            size: fullSize,
            budget: budget.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', contactId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('contacts')
          .insert({
            user_id: user.id,
            account_id: accountId,
            serial_no: serialNo.trim() || null,
            name: name.trim() || null,
            phone: phone.trim(),
            email: email.trim() || null,
            company: company.trim() || null,
            city: city.trim() || null,
            area: area.trim() || null,
            property_type: propertyType || null,
            size: fullSize,
            budget: budget.trim() || null,
          })
          .select('id')
          .single();
        if (error) throw error;
        contactId = data.id;
      }

      // Sync tags
      if (contactId) {
        const existingTagIds = new Set(contactTags.map((tag) => tag.tag_id));
        const desiredTagIds = new Set(selectedTagIds);
        const toRemove = [...existingTagIds].filter((id) => !desiredTagIds.has(id));
        const toAdd = [...desiredTagIds].filter((id) => !existingTagIds.has(id));

        for (const tagId of toRemove) {
          await deleteContactTag(contactId, tagId);
        }
        for (const tagId of toAdd) {
          await addContactTag(contactId, tagId);
        }

        // Sync custom values
        if (Object.keys(customValues).length > 0) {
          const customUpserts = Object.entries(customValues)
            .filter(([_, val]) => val !== undefined && val !== '')
            .map(([fId, val]) => ({
              contact_id: contactId,
              custom_field_id: fId,
              value: val,
            }));

          if (customUpserts.length > 0) {
            await supabase.from('contact_custom_values').upsert(customUpserts, {
              onConflict: 'contact_id,custom_field_id',
            });
          }
        }
      }

      toast.success(isEdit ? t('toastSuccessEdit') : t('toastSuccessAdd'));
      onOpenChange(false);
      onSaved();
    } catch (err: unknown) {
      // The unique index (migration 022) rejects a duplicate phone that
      // slipped past the on-blur check (race, or a format that
      // normalizes equal). Surface it as the friendly duplicate notice
      // and, for new contacts, point the user at the existing record.
      if (isUniqueViolation(err)) {
        toast.error(t('toastConflict'));
        if (!isEdit && accountId) {
          const existing = await findExistingContact(
            supabase,
            accountId,
            phone.trim(),
          );
          if (existing) setDupMatch({ contact: existing, exact: true });
        }
        return;
      }
      const message = err instanceof Error ? err.message : t('toastError');
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-popover border-border text-popover-foreground sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-popover-foreground">
            {isEdit ? t('editTitle') : t('addTitle')}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {isEdit
              ? t('editDesc')
              : t('addDesc')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Row 1: Sr No (Auto) & Phone (Number) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {!columnSettings['serial_no']?.is_deleted && (
              <div className="space-y-1.5">
                <Label htmlFor="cf-serial" className="text-muted-foreground text-xs">
                  {columnSettings['serial_no']?.label || 'Sr No'}
                </Label>
                <Input
                  id="cf-serial"
                  value={serialNo}
                  onChange={(e) => setSerialNo(e.target.value)}
                  placeholder="e.g. C-1"
                  className="bg-muted border-border font-mono text-xs text-foreground placeholder:text-muted-foreground h-9"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="cf-phone" className="text-muted-foreground text-xs">
                {columnSettings['phone']?.label || 'Number / Phone'}{' '}
                <span className="text-red-400">*</span>
              </Label>
              <Input
                id="cf-phone"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  if (dupMatch) setDupMatch(null);
                }}
                onBlur={checkDuplicate}
                placeholder={t('phonePlaceholder')}
                className="bg-muted border-border text-xs text-foreground placeholder:text-muted-foreground h-9"
              />
            </div>
          </div>

          {dupMatch && (
            <div
              className={`flex items-start gap-2 rounded-md border px-2.5 py-2 text-xs ${
                dupMatch.exact
                  ? 'border-red-500/40 bg-red-500/10 text-red-300'
                  : 'border-amber-500/40 bg-amber-500/10 text-amber-300'
              }`}
            >
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <div className="space-y-1">
                <p>
                  {dupMatch.exact
                    ? t('dupExact')
                    : t('dupSimilar')}
                </p>
                {onViewExisting && (
                  <button
                    type="button"
                    onClick={() => onViewExisting(dupMatch.contact.id)}
                    className="font-medium underline underline-offset-2 hover:no-underline"
                  >
                    {t('viewExisting', { name: dupMatch.contact.name || dupMatch.contact.phone })}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Row 2: Name & Budget */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cf-name" className="text-muted-foreground text-xs">
                {columnSettings['name']?.label || t('nameLabel')}
              </Label>
              <Input
                id="cf-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('namePlaceholder')}
                className="bg-muted border-border text-xs text-foreground placeholder:text-muted-foreground h-9"
              />
            </div>

            {!columnSettings['budget']?.is_deleted && (
              <div className="space-y-1.5">
                <Label htmlFor="cf-budget" className="text-muted-foreground text-xs">
                  {columnSettings['budget']?.label || 'Budget'}
                </Label>
                <Input
                  id="cf-budget"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="e.g. 2.5 Cr / 80 Lac"
                  className="bg-muted border-border text-xs text-foreground placeholder:text-muted-foreground h-9"
                />
              </div>
            )}
          </div>

          {/* Row 3: City & Area */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {!columnSettings['city']?.is_deleted && (
              <div className="space-y-1.5">
                <Label htmlFor="cf-city" className="text-muted-foreground text-xs">
                  {columnSettings['city']?.label || 'City'}
                </Label>
                <Input
                  id="cf-city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Lahore, Islamabad"
                  className="bg-muted border-border text-xs text-foreground placeholder:text-muted-foreground h-9"
                />
              </div>
            )}

            {!columnSettings['area']?.is_deleted && (
              <div className="space-y-1.5">
                <Label htmlFor="cf-area" className="text-muted-foreground text-xs">
                  {columnSettings['area']?.label || 'Area'}
                </Label>
                <Input
                  id="cf-area"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  placeholder="e.g. Samanabad, DHA Phase 5"
                  className="bg-muted border-border text-xs text-foreground placeholder:text-muted-foreground h-9"
                />
              </div>
            )}
          </div>

          {/* Row 4: Property Type & Size with Unit */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {!columnSettings['property_type']?.is_deleted && (
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs">
                  {columnSettings['property_type']?.label || 'Property Type'}
                </Label>
                <Select value={propertyType} onValueChange={(val) => setPropertyType(val ?? 'House')}>
                  <SelectTrigger className="bg-muted border-border text-xs text-foreground h-9 w-full">
                    <SelectValue placeholder="Select type" />
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
            )}

            {!columnSettings['size']?.is_deleted && (
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs">
                  {columnSettings['size']?.label || 'Size'}
                </Label>
                <div className="flex gap-1.5">
                  <Input
                    value={sizeValue}
                    onChange={(e) => setSizeValue(e.target.value)}
                    placeholder="e.g. 5, 10, 1"
                    className="bg-muted border-border text-xs text-foreground placeholder:text-muted-foreground flex-1 h-9"
                  />
                  <Select
                    value={sizeUnit}
                    onValueChange={(val) => {
                      if (val) setSizeUnit(val as SizeUnit);
                    }}
                  >
                    <SelectTrigger className="w-[100px] bg-muted border-border text-xs text-foreground h-9 shrink-0">
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
            )}
          </div>

          {/* Optional: Email & Company */}
          {(!columnSettings['email']?.is_deleted || !columnSettings['company']?.is_deleted) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {!columnSettings['email']?.is_deleted && (
                <div className="space-y-1.5">
                  <Label htmlFor="cf-email" className="text-muted-foreground text-xs">
                    {columnSettings['email']?.label || t('emailLabel')}
                  </Label>
                  <Input
                    id="cf-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('emailPlaceholder')}
                    className="bg-muted border-border text-xs text-foreground placeholder:text-muted-foreground h-9"
                  />
                </div>
              )}

              {!columnSettings['company']?.is_deleted && (
                <div className="space-y-1.5">
                  <Label htmlFor="cf-company" className="text-muted-foreground text-xs">
                    {columnSettings['company']?.label || t('companyLabel')}
                  </Label>
                  <Input
                    id="cf-company"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder={t('companyPlaceholder')}
                    className="bg-muted border-border text-xs text-foreground placeholder:text-muted-foreground h-9"
                  />
                </div>
              )}
            </div>
          )}

          {!columnSettings['tags']?.is_deleted && (
            <div className="space-y-2">
              <Label className="text-muted-foreground">
                {columnSettings['tags']?.label || t('tagsLabel')}
              </Label>
              
              {/* Inline Quick Tag Creator */}
              <div className="flex items-center gap-2">
                <Input
                  placeholder="New tag name (e.g. Urgent Buyer, DHA)..."
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCreateTag();
                    }
                  }}
                  className="bg-muted border-border text-xs h-8 flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCreateTag}
                  disabled={creatingTag || !newTagName.trim()}
                  className="h-8 text-xs shrink-0"
                >
                  {creatingTag ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3 mr-1" />}
                  Add Tag
                </Button>
              </div>

              {loadingTags ? (
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Loader2 className="size-3 animate-spin" />
                  {t('loadingTags')}
                </div>
              ) : tags.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {t('noTagsAvailable')}
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((tag) => {
                  const selected = selectedTagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors cursor-pointer ${
                        selected
                          ? 'ring-2 ring-primary ring-offset-1 ring-offset-border'
                          : 'opacity-60 hover:opacity-100'
                      }`}
                      style={{
                        backgroundColor: tag.color + '20',
                        color: tag.color,
                        borderColor: tag.color,
                      }}
                    >
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          )}

          {/* DYNAMIC CUSTOM FIELDS */}
          {customFields.length > 0 && (
            <div className="space-y-3 pt-3 border-t border-border">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                Custom Fields ({customFields.length})
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {customFields.map((field) => {
                  const val = customValues[field.id] || '';
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
                              [field.id]: v ?? '',
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
                              [field.id]: e.target.value,
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
                              [field.id]: e.target.value,
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
                              [field.id]: e.target.value,
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

          <DialogFooter className="bg-popover border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-border text-muted-foreground hover:bg-muted"
            >
              {t('cancel')}
            </Button>
            <Button
              type="submit"
              disabled={saving || checkingDup || (!isEdit && !!dupMatch?.exact)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {saving && <Loader2 className="size-4 animate-spin" />}
              {isEdit ? t('update') : t('create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
