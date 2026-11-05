'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import type { CustomField, CustomFieldType, AccountColumnSetting } from '@/types';
import {
  DEFAULT_CONTACT_COLUMNS_DEF,
  DEFAULT_LISTING_COLUMNS_DEF,
  buildUnifiedContactColumns,
  buildUnifiedListingColumns,
  type ColumnDefinition,
} from '@/lib/columns/column-settings';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  Plus,
  Trash2,
  Pencil,
  Columns3,
  X,
  Check,
  RotateCcw,
  Sparkles,
} from 'lucide-react';

interface CustomColumnManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: 'contact' | 'listing';
  onFieldsChanged?: () => void;
}

export function CustomColumnManager({
  open,
  onOpenChange,
  entityType,
  onFieldsChanged,
}: CustomColumnManagerProps) {
  const supabase = createClient();
  const { user, accountId } = useAuth();

  const [loading, setLoading] = useState(true);
  const [columns, setColumns] = useState<ColumnDefinition[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [columnSettings, setColumnSettings] = useState<AccountColumnSetting[]>([]);

  // Form state (for creating or editing)
  const [editingColId, setEditingColId] = useState<string | null>(null);
  const [isEditingDefault, setIsEditingDefault] = useState(false);
  const [fieldName, setFieldName] = useState('');
  const [fieldType, setFieldType] = useState<CustomFieldType>('text');
  const [options, setOptions] = useState<string[]>([]);
  const [newOptionInput, setNewOptionInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const entityTitle = entityType === 'listing' ? 'Property Listings' : 'Contacts';

  const fetchData = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const [customRes, settingsRes] = await Promise.all([
        supabase
          .from('custom_fields')
          .select('*')
          .eq('account_id', accountId)
          .eq('entity_type', entityType)
          .order('field_name'),
        supabase
          .from('account_column_settings')
          .select('*')
          .eq('account_id', accountId)
          .eq('entity_type', entityType),
      ]);

      const cFields = (customRes.data as CustomField[]) || [];
      const cSettings = (settingsRes.data as AccountColumnSetting[]) || [];

      setCustomFields(cFields);
      setColumnSettings(cSettings);

      const unified =
        entityType === 'contact'
          ? buildUnifiedContactColumns(cFields, cSettings)
          : buildUnifiedListingColumns(cFields, cSettings);

      setColumns(unified);
    } catch (err) {
      console.error('[custom-column-manager] error fetching data:', err);
      toast.error('Failed to load columns.');
    } finally {
      setLoading(false);
    }
  }, [accountId, entityType, supabase]);

  useEffect(() => {
    if (open && accountId) {
      fetchData();
      resetForm();
    }
  }, [open, accountId, fetchData]);

  function resetForm() {
    setEditingColId(null);
    setIsEditingDefault(false);
    setFieldName('');
    setFieldType('text');
    setOptions([]);
    setNewOptionInput('');
  }

  function handleStartEdit(col: ColumnDefinition) {
    setEditingColId(col.id);
    setIsEditingDefault(col.isDefault);
    setFieldName(col.label);
    setFieldType(col.fieldType);
    setOptions(col.options || []);
    setNewOptionInput('');
  }

  function handleAddOption() {
    const trimmed = newOptionInput.trim();
    if (!trimmed) return;
    if (options.some((opt) => opt.toLowerCase() === trimmed.toLowerCase())) {
      toast.error(`Option "${trimmed}" already exists.`);
      return;
    }
    setOptions([...options, trimmed]);
    setNewOptionInput('');
  }

  function handleRemoveOption(index: number) {
    setOptions(options.filter((_, i) => i !== index));
  }

  async function handleSaveField() {
    const name = fieldName.trim();
    if (!name) {
      toast.error('Column name cannot be empty.');
      return;
    }

    if (!accountId || !user) {
      toast.error('Not authenticated.');
      return;
    }

    setSaving(true);
    try {
      if (editingColId && isEditingDefault) {
        // Editing a Default System Column (Renaming its display label)
        const { error } = await supabase.from('account_column_settings').upsert(
          {
            account_id: accountId,
            entity_type: entityType,
            column_id: editingColId,
            label: name,
            is_deleted: false,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'account_id,entity_type,column_id' }
        );

        if (error) throw error;
        toast.success(`Column renamed to "${name}".`);
      } else if (editingColId && !isEditingDefault) {
        // Updating an existing Custom Field
        const fieldOptionsPayload = fieldType === 'select' ? { options } : {};
        const { error } = await supabase
          .from('custom_fields')
          .update({
            field_name: name,
            field_type: fieldType,
            field_options: fieldOptionsPayload,
          })
          .eq('id', editingColId);

        if (error) throw error;
        toast.success(`Column "${name}" updated.`);
      } else {
        // Creating a new Custom Field
        if (fieldType === 'select' && options.length === 0) {
          toast.error('Please add at least one dropdown option.');
          setSaving(false);
          return;
        }

        const isDuplicate = columns.some(
          (c) => c.label.toLowerCase() === name.toLowerCase() && !c.isDeleted
        );
        if (isDuplicate) {
          toast.error(`A column named "${name}" already exists.`);
          setSaving(false);
          return;
        }

        const fieldOptionsPayload = fieldType === 'select' ? { options } : {};
        const { error } = await supabase.from('custom_fields').insert({
          account_id: accountId,
          user_id: user.id,
          entity_type: entityType,
          field_name: name,
          field_type: fieldType,
          field_options: fieldOptionsPayload,
        });

        if (error) throw error;
        toast.success(`Column "${name}" created.`);
      }

      resetForm();
      await fetchData();
      onFieldsChanged?.();
    } catch (err: unknown) {
      console.error('[custom-column-manager] save error:', err);
      toast.error('Failed to save column.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteColumn(col: ColumnDefinition) {
    if (col.required) {
      toast.error(
        `"${col.label}" is a required core column and cannot be deleted. You can rename it if needed.`
      );
      return;
    }

    if (
      !window.confirm(
        col.isDefault
          ? `Are you sure you want to remove column "${col.label}"? It will be hidden from tables and forms (you can restore it anytime).`
          : `Are you sure you want to delete custom column "${col.label}"? Existing custom data in this column will be removed.`
      )
    ) {
      return;
    }

    setDeletingId(col.id);
    try {
      if (col.isDefault) {
        // Default column: mark as is_deleted = true in account_column_settings
        const { error } = await supabase.from('account_column_settings').upsert(
          {
            account_id: accountId,
            entity_type: entityType,
            column_id: col.id,
            label: col.label,
            is_deleted: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'account_id,entity_type,column_id' }
        );

        if (error) throw error;
        toast.success(`Column "${col.label}" removed.`);
      } else {
        // Custom column: delete from custom_fields
        const { error } = await supabase
          .from('custom_fields')
          .delete()
          .eq('id', col.id);

        if (error) throw error;
        toast.success(`Column "${col.label}" deleted.`);
      }

      if (editingColId === col.id) resetForm();
      await fetchData();
      onFieldsChanged?.();
    } catch (err: unknown) {
      console.error('[custom-column-manager] delete error:', err);
      toast.error('Failed to delete column.');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleRestoreColumn(col: ColumnDefinition) {
    if (!accountId) return;
    setDeletingId(col.id);
    try {
      const { error } = await supabase.from('account_column_settings').upsert(
        {
          account_id: accountId,
          entity_type: entityType,
          column_id: col.id,
          label: col.label,
          is_deleted: false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'account_id,entity_type,column_id' }
      );

      if (error) throw error;
      toast.success(`Column "${col.label}" restored!`);
      await fetchData();
      onFieldsChanged?.();
    } catch (err) {
      console.error('[custom-column-manager] restore error:', err);
      toast.error('Failed to restore column.');
    } finally {
      setDeletingId(null);
    }
  }

  const activeColumns = columns.filter((c) => !c.isDeleted);
  const deletedColumns = columns.filter((c) => c.isDeleted);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-popover text-popover-foreground sm:max-w-3xl max-h-[85vh] overflow-y-auto p-6">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-foreground text-base">
              <Columns3 className="size-5 text-primary" />
              Manage {entityTitle} Columns
            </DialogTitle>
            <Badge variant="outline" className="text-xs font-normal border-primary/30 text-primary bg-primary/5">
              {entityType === 'listing' ? 'Listings Table' : 'Contacts Table'}
            </Badge>
          </div>
          <DialogDescription className="text-muted-foreground text-xs mt-1">
            Customize column names, hide default columns, or create new custom fields. All changes are automatically synced with tables and forms.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* CREATE / EDIT FORM */}
          <div className="rounded-xl border border-border bg-muted/25 p-4 space-y-3.5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                {editingColId
                  ? isEditingDefault
                    ? `Rename Default Column: "${fieldName}"`
                    : 'Edit Custom Column'
                  : 'Add New Custom Column'}
              </span>
              {editingColId && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetForm}
                  className="h-6 text-xs text-muted-foreground hover:text-foreground"
                >
                  Cancel Edit
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Column Name / Label
                </label>
                <Input
                  value={fieldName}
                  onChange={(e) => setFieldName(e.target.value)}
                  placeholder="e.g. Asking Price, City, Area, Investor"
                  className="h-9 text-xs bg-background border-border text-foreground"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Data Type
                </label>
                {isEditingDefault ? (
                  <div className="h-9 flex items-center px-3 rounded-md bg-muted border border-border text-xs text-muted-foreground">
                    <span className="capitalize font-medium">{fieldType}</span>
                    <span className="ml-1.5 text-[11px] text-muted-foreground/70">(Default System Field)</span>
                  </div>
                ) : (
                  <Select
                    value={fieldType}
                    onValueChange={(val) => {
                      if (val) setFieldType(val as CustomFieldType);
                    }}
                  >
                    <SelectTrigger className="h-9 text-xs bg-background border-border text-foreground">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text" className="text-xs">
                        Text
                      </SelectItem>
                      <SelectItem value="number" className="text-xs">
                        Number
                      </SelectItem>
                      <SelectItem value="select" className="text-xs">
                        Dropdown (Select)
                      </SelectItem>
                      <SelectItem value="date" className="text-xs">
                        Date
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            {/* DROPDOWN OPTIONS CONFIG (when fieldType === 'select' and custom) */}
            {fieldType === 'select' && !isEditingDefault && (
              <div className="space-y-2 pt-2 border-t border-border/60">
                <label className="text-xs font-medium text-muted-foreground">
                  Dropdown Options
                </label>
                <div className="flex gap-2">
                  <Input
                    value={newOptionInput}
                    onChange={(e) => setNewOptionInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddOption();
                      }
                    }}
                    placeholder="Type an option and press Add (e.g. Commercial, Direct Buyer)"
                    className="h-9 text-xs bg-background border-border flex-1 text-foreground"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleAddOption}
                    className="h-9 text-xs border-border shrink-0"
                  >
                    <Plus className="size-3.5 mr-1" />
                    Add Option
                  </Button>
                </div>

                {options.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {options.map((opt, i) => (
                      <Badge
                        key={i}
                        variant="secondary"
                        className="text-xs font-normal pl-2.5 pr-1 py-0.5 flex items-center gap-1 bg-muted border border-border"
                      >
                        {opt}
                        <button
                          type="button"
                          onClick={() => handleRemoveOption(i)}
                          className="hover:text-red-400 p-0.5 rounded-full"
                        >
                          <X className="size-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end pt-1">
              <Button
                size="sm"
                onClick={handleSaveField}
                disabled={saving || !fieldName.trim()}
                className="h-9 px-4 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
              >
                {saving ? (
                  <Loader2 className="size-3.5 animate-spin mr-1.5" />
                ) : (
                  <Check className="size-3.5 mr-1.5" />
                )}
                {editingColId ? 'Save Changes' : 'Create Column'}
              </Button>
            </div>
          </div>

          {/* ACTIVE COLUMNS LIST */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Active Columns ({activeColumns.length})
              </h4>
              <span className="text-[11px] text-muted-foreground">
                Showing in table & form
              </span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="size-6 animate-spin text-primary" />
              </div>
            ) : activeColumns.length === 0 ? (
              <div className="rounded-lg border border-border p-8 text-center text-xs text-muted-foreground">
                No active columns found.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {activeColumns.map((col) => {
                  const isRenamed = col.isDefault && col.label !== col.defaultLabel;
                  return (
                    <div
                      key={col.id}
                      className="rounded-lg border border-border bg-card/60 p-3 hover:border-primary/40 transition-colors flex items-center justify-between gap-2 shadow-xs"
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-xs text-foreground truncate">
                            {col.label}
                          </span>
                          <Badge
                            variant={col.isDefault ? 'outline' : 'secondary'}
                            className={`text-[10px] px-1.5 py-0 ${
                              col.isDefault
                                ? 'bg-muted/50 border-border text-muted-foreground'
                                : 'bg-primary/10 text-primary border-primary/20'
                            }`}
                          >
                            {col.isDefault ? 'Default' : 'Custom'}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] px-1 py-0 text-muted-foreground font-mono">
                            {col.fieldType}
                          </Badge>
                        </div>
                        {isRenamed && (
                          <p className="text-[11px] text-muted-foreground truncate">
                            Default: {col.defaultLabel}
                          </p>
                        )}
                        {col.options && col.options.length > 0 && (
                          <p className="text-[11px] text-muted-foreground truncate">
                            Options: {col.options.join(', ')}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleStartEdit(col)}
                          className="size-7 p-0 text-muted-foreground hover:text-foreground"
                          title="Rename / Edit column"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteColumn(col)}
                          disabled={deletingId === col.id || col.required}
                          className={`size-7 p-0 ${
                            col.required
                              ? 'text-muted-foreground/30 cursor-not-allowed'
                              : 'text-muted-foreground hover:text-red-400'
                          }`}
                          title={
                            col.required
                              ? 'Required core column (cannot be removed)'
                              : col.isDefault
                              ? 'Remove default column'
                              : 'Delete custom column'
                          }
                        >
                          {deletingId === col.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="size-3.5" />
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* REMOVED / HIDDEN DEFAULT COLUMNS (IF ANY) */}
          {deletedColumns.length > 0 && (
            <div className="space-y-2.5 pt-3 border-t border-border">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Removed Default Columns ({deletedColumns.length})
                </h4>
                <span className="text-[11px] text-muted-foreground">
                  Can be restored anytime
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {deletedColumns.map((col) => (
                  <div
                    key={col.id}
                    className="rounded-lg border border-border bg-muted/20 p-2.5 flex items-center justify-between opacity-80 hover:opacity-100 transition-opacity"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground line-through">
                        {col.label}
                      </span>
                      <Badge variant="outline" className="text-[10px] px-1 py-0 text-muted-foreground">
                        Hidden
                      </Badge>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRestoreColumn(col)}
                      disabled={deletingId === col.id}
                      className="h-7 text-xs border-border text-muted-foreground hover:text-foreground"
                    >
                      <RotateCcw className="size-3 mr-1" />
                      Restore
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
